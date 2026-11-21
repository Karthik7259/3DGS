"""Render synchronized 10% Gaussian-selection comparison frames.

Uses the existing Graphdeco renderer plus the project's validated score and
temporal-selection functions. Writes only beneath visual_comparison/.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torchvision
from PIL import Image

PROJECT = Path(r"D:\3DGS-Research")
REPO = PROJECT / "gaussian-splatting"
OUT = PROJECT / "visual_comparison"
BASE = PROJECT / "experiments" / "baseline_truck"
DATA = PROJECT / "training_data" / "truck_baseline"
SENSITIVITY_FILE = PROJECT / "experiments" / "sensitivity_full_219views" / "sensitivity_scores_219views.npy"
SENSITIVITY_IDS_FILE = PROJECT / "experiments" / "sensitivity_topk_benchmark" / "results" / "selected_gaussian_ids.json"
SCORER_FILE = PROJECT / "experiments" / "view_dependent_scoring_pilot" / "compute_view_dependent_scores.py"
TEMPORAL_FILE = PROJECT / "experiments" / "temporal_selection_pilot" / "temporal_selection.py"
OPACITY_FILE = REPO / "experiments" / "fixed_topk" / "opacity_topk.py"
N_EXPECTED = 2_050_123
ITERATION = 30_000
CAMERA_COUNT = 40
PERCENT = 10
K = N_EXPECTED * PERCENT // 100
ALPHA, BETA = 0.75, 0.25
RETENTION = 0.95
WIDTH, HEIGHT = 979, 546
METHOD_DIRS = {
    "baseline": "baseline",
    "opacity_topk_10": "opacity_10",
    "global_sensitivity_topk_10": "sensitivity_10",
    "hybrid_sensitivity_view_10": "hybrid_10",
    "temporal_hybrid_r095_10": "temporal_hybrid_10",
}

if OUT.exists():
    allowed = {"render_visual_sequence.py", *METHOD_DIRS.values()} if "METHOD_DIRS" in globals() else {"render_visual_sequence.py"}
    unexpected = [p for p in OUT.iterdir() if p.name not in allowed or
                  (p.is_dir() and p.name in allowed and any(p.iterdir()))]
    if unexpected:
        raise FileExistsError(f"Refusing to overwrite existing output files: {unexpected}")
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from argparse import ArgumentParser
from arguments import ModelParams, PipelineParams, get_combined_args
from experiments.fixed_topk.opacity_topk import GaussianSubset
from gaussian_renderer import render
from render import SPARSE_ADAM_AVAILABLE
from scene import GaussianModel, Scene


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import validated component: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def save_png(image: torch.Tensor, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torchvision.utils.save_image(image[:3].detach().clamp(0, 1), str(path))


def load_args():
    parser = ArgumentParser(description=__doc__)
    model_params = ModelParams(parser, sentinel=True)
    pipeline_params = PipelineParams(parser)
    parser.set_defaults(model_path=str(BASE), source_path=str(DATA))
    args = get_combined_args(parser)
    if Path(args.model_path).resolve() != BASE.resolve() or Path(args.source_path).resolve() != DATA.resolve():
        raise RuntimeError(f"Unexpected paths from Graphdeco configuration: {args.model_path}, {args.source_path}")
    data_args = model_params.extract(args)
    pipeline = pipeline_params.extract(args)
    data_args.data_device = "cpu"
    return data_args, pipeline


def selected_camera_indices(total: int) -> list[int]:
    values = np.rint(np.linspace(0, total - 1, CAMERA_COUNT)).astype(np.int64).tolist()
    if len(values) != CAMERA_COUNT or len(set(values)) != CAMERA_COUNT or values[0] != 0 or values[-1] != total - 1:
        raise RuntimeError(f"Could not create unique, distributed camera path: {values}")
    return values


def validate_ids(ids: np.ndarray, expected_k: int, n: int, label: str) -> np.ndarray:
    ids = np.asarray(ids)
    if ids.ndim != 1 or ids.size != expected_k or not np.issubdtype(ids.dtype, np.integer):
        raise RuntimeError(f"{label}: wrong ID vector shape/type: {ids.shape}, {ids.dtype}")
    if ids.min() < 0 or ids.max() >= n or np.unique(ids).size != expected_k:
        raise RuntimeError(f"{label}: IDs are duplicated or out of bounds")
    return ids.astype(np.uint32, copy=False)


def camera_manifest_rows(cameras, loader_indices, selections, colmap_id_by_name):
    rows = []
    names = [str(c.image_name) for c in cameras]
    if names != sorted(names):
        raise RuntimeError("Selected training cameras are not in filename order")
    methods = [
        ("baseline", 100, N_EXPECTED),
        ("opacity_topk_10", 10, K),
        ("global_sensitivity_topk_10", 10, K),
        ("hybrid_sensitivity_view_10", 10, K),
        ("temporal_hybrid_r095_10", 10, K),
    ]
    for frame, (camera, loader_index) in enumerate(zip(cameras, loader_indices)):
        pos = camera.camera_center.detach().cpu().reshape(-1).tolist()
        rot = np.asarray(camera.R, dtype=np.float64).reshape(-1).tolist()
        for method, budget, count in methods:
            if method != "baseline":
                validate_ids(selections[method][frame], count, N_EXPECTED, f"manifest {method}/{frame}")
            rows.append({
                "frame_index": frame + 1,
                "camera_filename": str(camera.image_name),
                "loader_camera_index": int(loader_index),
                "camera_id": int(camera.uid),
                "colmap_image_id": int(colmap_id_by_name[str(camera.image_name)]),
                "camera_position_xyz": json.dumps(pos, separators=(",", ":")),
                "camera_rotation_R_row_major": json.dumps(rot, separators=(",", ":")),
                "image_width": int(camera.image_width),
                "image_height": int(camera.image_height),
                "selection_method": method,
                "gaussian_budget_percent": budget,
                "selected_gaussian_count": count,
            })
    return rows


def check_image(path: Path) -> tuple[int, int]:
    with Image.open(path) as im:
        im.load()
        if im.size != (WIDTH, HEIGHT):
            raise RuntimeError(f"Image dimensions incorrect for {path}: {im.size}")
        return im.size


def render_method(camera, model, pipeline, background, ids: np.ndarray | None, method: str):
    if ids is None:
        scene_model = model
        expected = N_EXPECTED
    else:
        ids = validate_ids(ids, K, N_EXPECTED, method)
        gpu_ids = torch.as_tensor(ids.astype(np.int64, copy=False), dtype=torch.long, device="cuda")
        scene_model = GaussianSubset(model, gpu_ids)
        expected = K
    for attr in ("get_xyz", "get_opacity", "get_scaling", "get_rotation", "get_features"):
        tensor = getattr(scene_model, attr)
        if int(tensor.shape[0]) != expected:
            raise RuntimeError(f"{method}: {attr} has {tensor.shape[0]} rows, expected {expected}")
    with torch.no_grad():
        result = render(camera, scene_model, pipeline, background,
                        use_trained_exp=dataset_args.train_test_exp,
                        separate_sh=SPARSE_ADAM_AVAILABLE)
    rendered = result["render"]
    if int(result["radii"].numel()) != expected:
        raise RuntimeError(f"{method}: rasterizer received {result['radii'].numel()} rows, expected {expected}")
    if tuple(rendered.shape[-2:]) != (HEIGHT, WIDTH) or not torch.isfinite(rendered).all().item():
        raise RuntimeError(f"{method}: invalid output dimensions or non-finite pixels")
    return rendered.detach(), expected


def main():
    global dataset_args
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable; no render was started")
    if not all(p.is_file() for p in (BASE / "chkpnt30000.pth", SENSITIVITY_FILE, SENSITIVITY_IDS_FILE,
                                      SCORER_FILE, TEMPORAL_FILE, OPACITY_FILE)):
        raise FileNotFoundError("A required checkpoint, score, or validated implementation is missing")

    protected = {
        "checkpoint": BASE / "chkpnt30000.pth",
        "baseline_ply": BASE / "point_cloud" / "iteration_30000" / "point_cloud.ply",
        "sensitivity_scores": SENSITIVITY_FILE,
        "sensitivity_saved_topk_ids": SENSITIVITY_IDS_FILE,
        "view_scorer": SCORER_FILE,
        "temporal_selector": TEMPORAL_FILE,
        "opacity_selector": OPACITY_FILE,
        "renderer": REPO / "gaussian_renderer" / "__init__.py",
        "dataset_cameras": DATA / "sparse" / "0" / "images.bin",
    }
    protected_before = {k: sha256(p) for k, p in protected.items()}

    OUT.mkdir(parents=True, exist_ok=True)
    for folder in METHOD_DIRS.values():
        (OUT / folder).mkdir(exist_ok=True)
    if not (DATA / "images").is_dir() or not (DATA / "sparse" / "0").is_dir():
        raise RuntimeError("Dataset copy does not have expected images and sparse/0 layout")

    global dataset_args
    dataset_args, pipeline = load_args()
    model = GaussianModel(dataset_args.sh_degree)
    scene = Scene(dataset_args, model, load_iteration=ITERATION, shuffle=False)
    if int(scene.loaded_iter) != ITERATION or int(model.get_xyz.shape[0]) != N_EXPECTED:
        raise RuntimeError("Loaded model iteration or Gaussian count differs from the validated baseline")
    all_cameras = scene.getTrainCameras()
    if len(all_cameras) != 219:
        raise RuntimeError(f"Expected 219 training cameras, found {len(all_cameras)}")
    indices = selected_camera_indices(len(all_cameras))
    cameras = [all_cameras[i] for i in indices]
    if any((int(c.image_width), int(c.image_height)) != (WIDTH, HEIGHT) for c in cameras):
        raise RuntimeError("Selected camera dimensions differ from the original image resolution")
    for c in cameras:
        if not (DATA / "images" / f"{c.image_name}.jpg").is_file() and not (DATA / "images" / c.image_name).is_file():
            raise FileNotFoundError(f"Training image missing for camera {c.image_name}")

    scorer = load_module(SCORER_FILE, "validated_view_scorer_for_visual_sequence")
    temporal = load_module(TEMPORAL_FILE, "validated_temporal_selector_for_visual_sequence")
    opacity = load_module(OPACITY_FILE, "validated_opacity_selector_for_visual_sequence")
    sensitivity = np.load(SENSITIVITY_FILE, allow_pickle=False)
    if sensitivity.dtype != np.float32 or sensitivity.shape != (N_EXPECTED,) or not np.isfinite(sensitivity).all() or np.any(sensitivity < 0):
        raise RuntimeError("Global sensitivity vector failed integrity/shape validation")
    sensitivity_norm = scorer.average_tie_percentiles(sensitivity)

    # Reuse the benchmark's saved sensitivity IDs, and verify against its exact ranking rule.
    saved_ids = json.loads(SENSITIVITY_IDS_FILE.read_text(encoding="utf-8"))[str(PERCENT)]
    saved_ids = validate_ids(np.asarray(saved_ids, dtype=np.uint32), K, N_EXPECTED, "saved sensitivity Top-K")
    replay_sens = temporal.rank_scores(sensitivity_norm)[:K]
    if not np.array_equal(saved_ids, replay_sens):
        raise RuntimeError("Saved global sensitivity Top-K IDs do not match deterministic replay")

    opacity_rank = opacity.opacity_ranking(model)
    opacity_ids = opacity_rank[:K].detach().cpu().numpy().astype(np.uint32, copy=False)
    opacity_ids = validate_ids(opacity_ids, K, N_EXPECTED, "opacity Top-K")

    # Compute only the existing camera score on the chosen training path; temporal selection
    # itself uses the already validated selector with the established alpha/beta and R value.
    opacity_cpu = model.get_opacity.detach().reshape(-1).cpu().numpy().astype(np.float32, copy=False)
    covariance_world6 = model.get_covariance(1.0).detach()
    selected = {key: [] for key in METHOD_DIRS if key != "baseline"}
    previous_temporal = None
    score_records = []
    for frame, camera in enumerate(cameras):
        raw, visible, projection = scorer.score_one_camera(
            model, camera, covariance_world6, opacity_cpu, chunk_size=131072)
        if raw.shape != (N_EXPECTED,) or not np.isfinite(raw).all() or np.any(raw < 0):
            raise RuntimeError(f"Invalid view score for camera {camera.image_name}")
        view_norm = scorer.average_tie_percentiles(raw)
        combined = (np.float32(ALPHA) * sensitivity_norm + np.float32(BETA) * view_norm).astype(np.float32)
        if not np.isfinite(combined).all() or combined.min() < 0 or combined.max() > 1:
            raise RuntimeError(f"Invalid hybrid score for camera {camera.image_name}")
        ranking = temporal.rank_scores(combined)
        hybrid_ids = validate_ids(ranking[:K], K, N_EXPECTED, "hybrid Top-K")
        temporal_result = temporal.select_from_ranking(
            ranking, K, previous_temporal, RETENTION,
            validate_unique_previous=False, validate_ranking=False)
        if frame == 0 and not temporal_result.fallback:
            raise RuntimeError("Temporal selection did not initialize from ordinary Top-K")
        if frame > 0 and temporal_result.fallback:
            raise RuntimeError(f"Temporal selection unexpectedly fell back at frame {frame}")
        temporal_ids = validate_ids(temporal_result.ids, K, N_EXPECTED, "temporal hybrid")
        required = math.ceil(RETENTION * K)
        overlap = int(np.intersect1d(previous_temporal, temporal_ids, assume_unique=True).size) if previous_temporal is not None else None
        if overlap is not None and overlap < required:
            raise RuntimeError(f"R=.95 retention failed at {camera.image_name}: {overlap} < {required}")
        selected["opacity_topk_10"].append(opacity_ids.copy())
        selected["global_sensitivity_topk_10"].append(saved_ids.copy())
        selected["hybrid_sensitivity_view_10"].append(hybrid_ids.copy())
        selected["temporal_hybrid_r095_10"].append(temporal_ids.copy())
        score_records.append({
            "frame_index": frame + 1,
            "camera_filename": str(camera.image_name),
            "loader_camera_index": int(indices[frame]),
            "visible_proxy_gaussians": int(np.count_nonzero(visible)),
            "view_score_max": float(raw.max()),
            "view_score_mean": float(raw.mean()),
            "hybrid_alpha": ALPHA,
            "hybrid_beta": BETA,
            "temporal_retention": RETENTION,
            "required_previous_ids": required,
            "actual_shared_previous_ids": overlap,
            "projection_summary": projection,
        })
        previous_temporal = temporal_ids.copy()
        del raw, visible, view_norm, combined, ranking, temporal_result
        torch.cuda.empty_cache()
        print(f"prepared selections {frame + 1}/{CAMERA_COUNT}: {camera.image_name}", flush=True)

    selections = {
        "opacity_topk_10": selected["opacity_topk_10"],
        "global_sensitivity_topk_10": selected["global_sensitivity_topk_10"],
        "hybrid_sensitivity_view_10": selected["hybrid_sensitivity_view_10"],
        "temporal_hybrid_r095_10": selected["temporal_hybrid_r095_10"],
    }
    prior_camera_map = PROJECT / "experiments" / "full_scale_scalability_validation" / "camera_sequence.csv"
    with prior_camera_map.open("r", newline="", encoding="utf-8") as map_stream:
        colmap_id_by_name = {row["filename"]: int(row["colmap_image_id"])
                             for row in csv.DictReader(map_stream)}
    if not set(str(c.image_name) for c in cameras).issubset(colmap_id_by_name):
        raise RuntimeError("Validated camera sequence map does not cover selected camera filenames")
    manifest_rows = camera_manifest_rows(cameras, indices, selections, colmap_id_by_name)
    manifest_path = OUT / "camera_manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(manifest_rows[0]))
        writer.writeheader(); writer.writerows(manifest_rows)

    background = torch.tensor([1, 1, 1] if dataset_args.white_background else [0, 0, 0],
                              dtype=torch.float32, device="cuda")
    # Single-camera validation. All five methods use the exact same Camera instance.
    first_camera = cameras[0]
    frame_images = {}
    method_ids = {
        "baseline": None,
        "opacity_topk_10": selections["opacity_topk_10"][0],
        "global_sensitivity_topk_10": selections["global_sensitivity_topk_10"][0],
        "hybrid_sensitivity_view_10": selections["hybrid_sensitivity_view_10"][0],
        "temporal_hybrid_r095_10": selections["temporal_hybrid_r095_10"][0],
    }
    validation_counts = {}
    for method, ids in method_ids.items():
        image, count = render_method(first_camera, model, pipeline, background, ids, method)
        validation_counts[method] = count
        frame_images[method] = image
    expected_counts = {"baseline": N_EXPECTED, **{m: K for m in METHOD_DIRS if m != "baseline"}}
    if validation_counts != expected_counts:
        raise RuntimeError(f"Single-camera validation count mismatch: {validation_counts}")
    for method, image in frame_images.items():
        if tuple(image.shape[-2:]) != (HEIGHT, WIDTH):
            raise RuntimeError(f"Validation tensor dimensions differ for {method}")
    # Commit the first frame only after all methods passed the shared-camera checks.
    for method in METHOD_DIRS:
        save_png(frame_images[method], OUT / METHOD_DIRS[method] / "frame_0001.png")
    for folder in METHOD_DIRS.values():
        check_image(OUT / folder / "frame_0001.png")
    del frame_images
    torch.cuda.empty_cache()
    print("Single-camera validation passed; rendering the remaining synchronized frames.", flush=True)

    render_started = time.perf_counter()
    with torch.no_grad():
        for frame in range(1, CAMERA_COUNT):
            camera = cameras[frame]
            for method in METHOD_DIRS:
                ids = None if method == "baseline" else selections[method][frame]
                image, count = render_method(camera, model, pipeline, background, ids, method)
                expected = N_EXPECTED if method == "baseline" else K
                if count != expected:
                    raise RuntimeError(f"Count mismatch during full sequence: {method} frame {frame + 1}")
                path = OUT / METHOD_DIRS[method] / f"frame_{frame + 1:04d}.png"
                save_png(image, path)
                del image
            torch.cuda.empty_cache()
            print(f"rendered synchronized frame {frame + 1}/{CAMERA_COUNT}: {camera.image_name}", flush=True)
    render_seconds = time.perf_counter() - render_started

    # Re-open and validate all expected outputs; this also catches truncated/corrupt PNGs.
    image_validation = {}
    for method, folder in METHOD_DIRS.items():
        paths = sorted((OUT / folder).glob("frame_*.png"))
        if len(paths) != CAMERA_COUNT:
            raise RuntimeError(f"{folder}: expected {CAMERA_COUNT} frames, found {len(paths)}")
        if [p.name for p in paths] != [f"frame_{i:04d}.png" for i in range(1, CAMERA_COUNT + 1)]:
            raise RuntimeError(f"{folder}: frame numbering is incomplete or out of order")
        for path in paths:
            check_image(path)
        image_validation[method] = {"frame_count": len(paths), "all_pngs_opened": True,
                                    "dimensions": [WIDTH, HEIGHT],
                                    "first_frame_sha256": sha256(paths[0]),
                                    "last_frame_sha256": sha256(paths[-1])}

    protected_after = {k: sha256(p) for k, p in protected.items()}
    if protected_before != protected_after:
        raise RuntimeError("A protected model, score, source, renderer, or dataset camera file changed")

    report_data = {
        "status": "completed",
        "camera_selection": "40 unique indices from round(linspace(0,218,40)); ascending filename-ordered training camera list",
        "camera_count": CAMERA_COUNT,
        "camera_loader_indices": [int(i) for i in indices],
        "camera_filenames": [str(c.image_name) for c in cameras],
        "training_only": True,
        "methods": {
            "baseline": {"folder": METHOD_DIRS["baseline"], "budget_percent": 100, "gaussian_count": N_EXPECTED},
            "opacity_topk_10": {"folder": METHOD_DIRS["opacity_topk_10"], "budget_percent": 10, "gaussian_count": K,
                                "selection": "existing validated activated-opacity ranking implementation"},
            "global_sensitivity_topk_10": {"folder": METHOD_DIRS["global_sensitivity_topk_10"], "budget_percent": 10, "gaussian_count": K,
                                            "selection": "reused saved 219-training-view IDs; deterministic replay matched"},
            "hybrid_sensitivity_view_10": {"folder": METHOD_DIRS["hybrid_sensitivity_view_10"], "budget_percent": 10, "gaussian_count": K,
                                            "alpha": ALPHA, "beta": BETA,
                                            "selection": "validated projected-footprint scorer and percentile normalization"},
            "temporal_hybrid_r095_10": {"folder": METHOD_DIRS["temporal_hybrid_r095_10"], "budget_percent": 10,
                                         "gaussian_count": K, "retention_R": RETENTION,
                                         "initialization": "ordinary hybrid Top-K on frame 1",
                                         "rule": "validated selector, current-score-ranked previous IDs, ceil(R*K) minimum retention, then current-rank fill"},
        },
        "rendering": {"renderer": "original Graphdeco gaussian_renderer.render and existing CUDA rasterizer",
                      "checkpoint_iteration": ITERATION, "resolution": [WIDTH, HEIGHT],
                      "same_camera_object_per_frame": True, "same_background": True,
                      "sh_degree": int(model.active_sh_degree), "same_pipeline_configuration": True,
                      "rendered_full_sequence_elapsed_seconds_excluding_selection": render_seconds},
        "single_camera_validation": {"status": "passed", "camera_filename": str(first_camera.image_name),
                                     "loader_camera_index": int(indices[0]), "camera_id": int(first_camera.uid),
                                     "counts_by_method": validation_counts, "identical_dimensions": [WIDTH, HEIGHT],
                                     "temporal_first_frame_fallback": True},
        "image_validation": image_validation,
        "per_camera_scoring_and_temporal_details": score_records,
        "integrity": {"protected_hashes_before": protected_before, "protected_hashes_after": protected_after,
                      "all_unchanged": True},
        "environment": {"python": sys.version.split()[0], "torch": torch.__version__,
                        "cuda": torch.version.cuda, "gpu": torch.cuda.get_device_name(0)},
    }
    (OUT / "visual_sequence_results.json").write_text(json.dumps(report_data, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "completed", "camera_count": CAMERA_COUNT,
                      "render_seconds": render_seconds, "validation_counts": validation_counts,
                      "image_validation": image_validation}, indent=2), flush=True)


if __name__ == "__main__":
    main()

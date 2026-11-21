"""Export selected 10% Gaussian PLY snapshots for an interactive SIBR viewer.

The baseline PLY remains at its original location and is not copied or changed.
The hybrid snapshots correspond to the middle camera of the synchronized path.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

import numpy as np
import torch
from plyfile import PlyData, PlyElement

PROJECT = Path(r"D:\3DGS-Research")
REPO = PROJECT / "gaussian-splatting"
OUT = PROJECT / "visual_comparison" / "interactive_models"
BASE = PROJECT / "experiments" / "baseline_truck"
DATA = PROJECT / "training_data" / "truck_baseline"
PLY_IN = BASE / "point_cloud" / "iteration_30000" / "point_cloud.ply"
SENS = PROJECT / "experiments" / "sensitivity_full_219views" / "sensitivity_scores_219views.npy"
SENS_IDS = PROJECT / "experiments" / "sensitivity_topk_benchmark" / "results" / "selected_gaussian_ids.json"
SEQ_JSON = PROJECT / "visual_comparison" / "visual_sequence_results.json"
SCORER_PATH = PROJECT / "experiments" / "view_dependent_scoring_pilot" / "compute_view_dependent_scores.py"
TEMPORAL_PATH = PROJECT / "experiments" / "temporal_selection_pilot" / "temporal_selection.py"
OPACITY_PATH = REPO / "experiments" / "fixed_topk" / "opacity_topk.py"
N = 2_050_123
K = N * 10 // 100
ALPHA, BETA, RETENTION = 0.75, 0.25, 0.95
ITERATION = 30_000

if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))
from argparse import ArgumentParser
from arguments import ModelParams, PipelineParams, get_combined_args
from scene import GaussianModel, Scene


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load existing implementation: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def export_subset(input_ply: PlyData, ids: np.ndarray, output: Path) -> dict:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    els = []
    vertex_names = None
    for el in input_ply.elements:
        if el.name == "vertex":
            if el.count != N:
                raise RuntimeError(f"Input PLY has {el.count} vertices, expected {N}")
            subset = np.asarray(el.data[ids]).copy()
            vertex_names = list(subset.dtype.names or ())
            els.append(PlyElement.describe(subset, "vertex", comments=list(el.comments)))
        else:
            els.append(el)
    result = PlyData(els, text=input_ply.text, byte_order=input_ply.byte_order,
                     comments=list(input_ply.comments), obj_info=list(input_ply.obj_info))
    result.write(str(output))
    reopened = PlyData.read(str(output))
    if reopened["vertex"].count != K or list(reopened["vertex"].data.dtype.names or ()) != vertex_names:
        raise RuntimeError(f"Export verification failed for {output}")
    return {"path": str(output), "count": int(reopened["vertex"].count), "size_bytes": output.stat().st_size,
            "sha256": sha256(output), "property_count": len(vertex_names), "properties": vertex_names}


def write_cfg(model_dir: Path) -> None:
    original = (BASE / "cfg_args").read_text(encoding="utf-8")
    cfg = re.sub(r"model_path=(?:'[^']*'|\"[^\"]*\")", f"model_path={str(model_dir)!r}", original, count=1)
    if cfg == original or str(model_dir) not in cfg:
        raise RuntimeError("Could not set the exported viewer model path in cfg_args")
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "cfg_args").write_text(cfg, encoding="utf-8")


def main():
    if OUT.exists() and any(p.name != "prepare_viewer_models.py" for p in OUT.iterdir()):
        raise FileExistsError(f"Refusing to overwrite interactive model assets: {OUT}")
    OUT.mkdir(parents=True, exist_ok=True)
    before = {str(p): sha256(p) for p in (PLY_IN, BASE / "chkpnt30000.pth", SENS, SENS_IDS,
                                          SCORER_PATH, TEMPORAL_PATH, OPACITY_PATH)}

    parser = ArgumentParser()
    mp = ModelParams(parser, sentinel=True)
    pp = PipelineParams(parser)
    parser.set_defaults(model_path=str(BASE), source_path=str(DATA))
    args = get_combined_args(parser)
    data_args = mp.extract(args)
    _pipeline = pp.extract(args)
    data_args.data_device = "cpu"
    model = GaussianModel(data_args.sh_degree)
    scene = Scene(data_args, model, load_iteration=ITERATION, shuffle=False)
    if int(scene.loaded_iter) != ITERATION or int(model.get_xyz.shape[0]) != N:
        raise RuntimeError("Could not verify the iteration-30000 model")
    all_cameras = scene.getTrainCameras()
    if len(all_cameras) != 219 or [c.image_name for c in all_cameras] != sorted(c.image_name for c in all_cameras):
        raise RuntimeError("Unexpected filename-ordered training camera list")

    seq = json.loads(SEQ_JSON.read_text(encoding="utf-8"))
    selected_loader_indices = seq["camera_loader_indices"]
    middle_frame = len(selected_loader_indices) // 2 - 1  # 0-based index 19, 20th selected camera
    target_loader_index = int(selected_loader_indices[middle_frame])
    if target_loader_index != 106 or all_cameras[target_loader_index].image_name != "000123.jpg":
        raise RuntimeError("Unexpected middle frame in the validated visual camera path")

    scorer = load_module(SCORER_PATH, "interactive_export_scorer")
    temporal = load_module(TEMPORAL_PATH, "interactive_export_temporal_selector")
    opacity = load_module(OPACITY_PATH, "interactive_export_opacity_selector")
    sensitivity = np.load(SENS, allow_pickle=False)
    if sensitivity.shape != (N,) or sensitivity.dtype != np.float32 or not np.isfinite(sensitivity).all():
        raise RuntimeError("Global sensitivity scores failed validation")
    sensitivity_norm = scorer.average_tie_percentiles(sensitivity)
    sensitivity_ids = np.asarray(json.loads(SENS_IDS.read_text(encoding="utf-8"))["10"], dtype=np.uint32)
    expected_sensitivity = temporal.rank_scores(sensitivity_norm)[:K]
    if sensitivity_ids.size != K or not np.array_equal(sensitivity_ids, expected_sensitivity):
        raise RuntimeError("Saved sensitivity Top-K set did not match deterministic replay")
    opacity_ids = opacity.opacity_ranking(model)[:K].detach().cpu().numpy().astype(np.uint32)

    cameras = [all_cameras[i] for i in selected_loader_indices[:middle_frame + 1]]
    opacity_cpu = model.get_opacity.detach().reshape(-1).cpu().numpy().astype(np.float32, copy=False)
    covariance = model.get_covariance(1.0).detach()
    previous = None
    hybrid_ids = temporal_ids = None
    for frame, camera in enumerate(cameras):
        raw, visible, _ = scorer.score_one_camera(model, camera, covariance, opacity_cpu, chunk_size=131072)
        normalized_view = scorer.average_tie_percentiles(raw)
        combined = (np.float32(ALPHA) * sensitivity_norm + np.float32(BETA) * normalized_view).astype(np.float32)
        rank = temporal.rank_scores(combined)
        hybrid_ids = rank[:K].copy()
        selected = temporal.select_from_ranking(rank, K, previous, RETENTION,
                                                validate_unique_previous=False, validate_ranking=False)
        temporal_ids = selected.ids.copy()
        if frame == 0 and not selected.fallback:
            raise RuntimeError("Temporal first-frame fallback was not used")
        if frame > 0 and int(np.intersect1d(previous, temporal_ids, assume_unique=True).size) < int(np.ceil(RETENTION * K)):
            raise RuntimeError(f"R=.95 retention verification failed at {camera.image_name}")
        previous = temporal_ids.copy()
        del raw, visible, normalized_view, combined, rank, selected
        torch.cuda.empty_cache()

    ply = PlyData.read(str(PLY_IN))
    if ply["vertex"].count != N:
        raise RuntimeError("Baseline PLY vertex count differs from Gaussian model")
    methods = {
        "opacity_10": opacity_ids,
        "sensitivity_10": sensitivity_ids,
        "hybrid_10_camera_000123": hybrid_ids,
        "temporal_hybrid_10_camera_000123": temporal_ids,
    }
    results = {}
    for folder, ids in methods.items():
        ids = np.asarray(ids, dtype=np.uint32)
        if ids.size != K or np.unique(ids).size != K or ids.min() < 0 or ids.max() >= N:
            raise RuntimeError(f"Invalid Gaussian ID set for {folder}")
        model_dir = OUT / folder
        write_cfg(model_dir)
        target = model_dir / "point_cloud" / f"iteration_{ITERATION}" / "point_cloud.ply"
        results[folder] = export_subset(ply, ids.astype(np.int64), target)
        results[folder]["selected_ids_sha256"] = hashlib.sha256(ids.astype("<u4", copy=False).tobytes()).hexdigest()
        if folder.endswith("camera_000123"):
            results[folder]["representative_camera"] = "000123.jpg"
            results[folder]["camera_loader_index"] = target_loader_index
        print(f"exported {folder}: {results[folder]['count']} Gaussians", flush=True)

    after = {str(p): sha256(p) for p in (PLY_IN, BASE / "chkpnt30000.pth", SENS, SENS_IDS,
                                         SCORER_PATH, TEMPORAL_PATH, OPACITY_PATH)}
    if before != after:
        raise RuntimeError("Protected source model, score, or implementation files changed")
    summary = {
        "status": "complete",
        "baseline_ply": str(PLY_IN),
        "baseline_ply_reused_in_place": True,
        "checkpoint_iteration": ITERATION,
        "original_gaussians": N,
        "budget_percent": 10,
        "retained_gaussians": K,
        "hybrid_weights": {"alpha_sensitivity": ALPHA, "beta_view": BETA},
        "temporal_retention": RETENTION,
        "representative_camera": {"filename": "000123.jpg", "loader_index": target_loader_index,
                                   "selected_path_frame": middle_frame + 1},
        "exports": results,
        "protected_hashes_before": before,
        "protected_hashes_after": after,
        "all_protected_hashes_unchanged": True,
        "viewer_note": "PLY snapshots are unchanged trained Gaussian attributes indexed by the validated selected IDs. The view-dependent and temporal variants are frozen at the representative camera selection; a live camera-conditioned selector requires integrating the selector into a viewer runtime.",
    }
    (OUT / "viewer_models_manifest.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "complete", "exports": {k: v["size_bytes"] for k, v in results.items()},
                      "protected_hashes_unchanged": True}, indent=2), flush=True)


if __name__ == "__main__":
    main()

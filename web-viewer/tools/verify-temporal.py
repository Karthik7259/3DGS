"""Compare the running viewer's temporal responses with the original experiment."""
import csv
import hashlib
import io
import json
import math
import sys
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image

EXPERIMENTS = Path(__file__).resolve().parents[2] / "experiments"
PILOT = EXPERIMENTS / "temporal_rendering_pilot"


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def audit(origin):
    def get(route):
        with urlopen(origin.rstrip("/") + route, timeout=15) as response:
            return response.read()

    served = json.loads(get("/api/temporal"))
    sample = json.loads((PILOT / "camera_subset_manifest.json").read_bytes())
    manifest = json.loads((PILOT / "selection_manifest.json").read_bytes())
    rows = read_csv(PILOT / "results/per_camera_metrics.csv")
    quality = {(r["method"], r["budget_percent"], int(r["frame"])): r for r in rows}
    references = read_csv(EXPERIMENTS / "full_scale_scalability_validation/camera_sequence.csv")
    assert served["trainingSequence"] == [r["filename"] for r in references]
    assert len({r["filename"] for r in references}) == 219
    assert [f["image"] for f in served["frames"]] == sample["image_filenames"]
    assert [f["loaderIndex"] for f in served["frames"]] == sample["loader_indices"]
    verified = {"id_arrays": 0, "image_files": 0, "metric_rows": 0, "intersections": 0}
    for method, budgets in manifest["methods"].items():
        for budget, run in budgets.items():
            previous = None
            for i, entry in enumerate(run["frames"]):
                name = f"{i:02}_{Path(entry['image_filename']).stem}"
                rel = Path(method) / (budget + "pct") / name
                arr_file = (PILOT / "selections" / rel).with_suffix(".npy")
                assert hashlib.sha256(arr_file.read_bytes()).hexdigest() == entry["sha256"]
                original = np.load(arr_file, allow_pickle=False)
                route = f"{method}/{budget}/{i}"
                payload = get("/api/temporal/ids/" + route)
                assert payload == original.tobytes()
                ids = np.frombuffer(payload, dtype="<u4")
                k = 2_050_123 * int(budget) // 100
                assert ids.size == k and ids.max() < 2_050_123 and np.unique(ids).size == k
                metric = served["frames"][i]["results"][method][budget]
                csv_row = quality[(method, budget, i)]
                assert metric["count"] == int(csv_row["rasterizer_gaussian_count_verified"]) == k
                assert hashlib.sha256(np.sort(ids).tobytes()).hexdigest() == csv_row["selected_ids_sha256"] == entry["selected_set_sha256"]
                for key, source in [("psnr", "PSNR_dB"), ("ssim", "SSIM"), ("renderFps", "render_call_fps")]:
                    assert metric[key] == float(csv_row[source])
                verified["id_arrays"] += 1
                verified["metric_rows"] += 1
                if previous is None:
                    assert metric["shared"] is None and metric["overlap"] is None
                else:
                    shared = np.intersect1d(previous, ids, assume_unique=True).size
                    assert shared == metric["shared"] == entry["shared_previous_count"]
                    assert math.isclose(100 * shared / k, metric["overlap"], abs_tol=1e-9)
                    verified["intersections"] += 1
                previous = ids
                image = get("/api/temporal/render/" + route)
                assert image == (PILOT / "renders" / rel).with_suffix(".png").read_bytes()
                with Image.open(io.BytesIO(image)) as decoded:
                    assert decoded.size == (979, 546)
                    decoded.verify()
                verified["image_files"] += 1
    assert verified == {"id_arrays": 120, "image_files": 120, "metric_rows": 120, "intersections": 114}
    print(json.dumps(verified))


if __name__ == "__main__":
    audit(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173")

"""Verify the chart series and paired-render API against the archived Truck runs."""
import csv
import json
import sys
from pathlib import Path
from urllib.request import urlopen

EXPERIMENTS = Path(__file__).resolve().parents[2] / "experiments"
RUNS = {
    "opacity": "fixed_topk_benchmark",
    "sensitivity": "sensitivity_topk_benchmark",
    "hybrid": "sensitivity_view_topk_benchmark",
}


def rows(file):
    with file.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def verify(origin):
    def get(route):
        with urlopen(origin.rstrip("/") + route, timeout=15) as response:
            return json.load(response)

    series = get("/api/benchmark-series")
    points = {(p["method"], p["budget"]): p for p in series}
    assert len(points) == len(series) == 18
    for method, run in RUNS.items():
        folder = EXPERIMENTS / run / "results"
        hybrid = method == "hybrid"
        budget_key = "budget_percent" if hybrid else "percentage"
        timing = {int(r[budget_key]): r for r in rows(folder / "timings.csv")
                  if not hybrid or r["phase"] == "budget_summary"}
        for row in rows(folder / "aggregate_metrics.csv"):
            budget = int(row[budget_key])
            assert points[method, budget] == {
                "method": method, "budget": budget, "count": int(row["K"]),
                "psnr": float(row["PSNR_mean" if hybrid else "mean_PSNR_dB"]),
                "ssim": float(row["SSIM_mean" if hybrid else "mean_SSIM"]),
                "fps": float(timing[budget]["render_call_fps_mean" if hybrid else "synchronized_render_call_fps"]),
            }

    baseline = points["opacity", 100]
    for (method, budget), point in points.items():
        for frame in range(32):
            result = get(f"/api/benchmark-comparison?method={method}&budget={budget}&frame={frame}")
            assert result["gaussianCount"] == point["count"]
            assert (result["testViews"], result["viewIndex"]) == (32, frame)
            assert result["original"]["url"] == f"/benchmark-render/original/100/{frame:05d}.png"
            assert result["selected"]["url"] == f"/benchmark-render/{method}/{budget}/{frame:05d}.png"
            for key, delta in [("psnr", "deltaPsnr"), ("ssim", "deltaSsim")]:
                assert result["original"][key] == baseline[key]
                assert result["selected"][key] == point[key]
                assert result["selected"][delta] == point[key] - baseline[key]
    print("Verified 18 chart points and 576 camera comparisons against the research archives.")


if __name__ == "__main__":
    verify(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173")

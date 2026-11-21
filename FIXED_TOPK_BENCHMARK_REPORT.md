# Experiment 02: Fixed Opacity Top-K Quality and Performance Benchmark

**Date:** 2026-11-20  
**Model:** D:\3DGS-Research\experiments\baseline_truck, iteration 30,000  
**Dataset:** D:\3DGS-Research\training_data\truck_baseline  
**Output:** D:\3DGS-Research\experiments\fixed_topk_benchmark  
**Status:** Complete. The benchmark rendered all 32 test views at all six budgets with three timed repetitions per budget. No retraining, package installation, download, or original baseline modification occurred.

## Executive result

The 100% output reproduced the existing baseline PNGs exactly on all 32 test views. Opacity selection improved synchronized render-call throughput as the Gaussian count fell, while image quality dropped progressively. At 75%, the test quality change was small (−0.329 dB PSNR, −0.00359 SSIM) and synchronized render-call throughput rose from 19.2 to 23.7 views/s. At 50%, throughput rose to 27.0 views/s with a larger 1.980 dB PSNR decrease. At 25% and below, quality degradation was substantial. The 5% subset reached 67.0 synchronized render calls/s, with test PSNR 10.3477 dB and SSIM 0.33505.

The throughput measurements exclude PNG saving and selection. Selection setup and PNG saving are reported separately below. FPS is not kernel-only.

## 1. Method

- Loaded the iteration-30,000 model through the official Graphdeco Scene/PLY inference path and selected cameras from the saved eval split. Graphdeco render.py loads point_cloud/iteration_30000/point_cloud.ply for inference; chkpnt30000.pth is the training-resume checkpoint and was preserved and hash-checked, not used by the official render loader.
- Used the same 32 test camera objects, in the same no-shuffle order as render.py.
- Used the original saved PNG ground truth under baseline_truck/test/ours_30000/gt. All 32 camera images were checked pixel-for-pixel against their correspondingly indexed saved GT PNGs after Graphdeco’s image quantization.
- Used one stable descending ranking of activated opacity, sigmoid(raw opacity), with the Experiment 01 selector and original Gaussian IDs. The ranking was global and shared across all views. No view-dependent scoring was used.
- Retained counts use the existing floor(N × percentage / 100) rule.
- Before the full run, a one-view preflight rendered 100% and 5%. The 100% output matched the original baseline render exactly; the 5% subset rendered through the unchanged rasterizer.
- Ran one unsaved warm-up view per budget, then three complete 32-view timed passes per budget. Budget order was shuffled deterministically per repetition using seed 20261120. The first measured pass per budget was saved once.
- CUDA was synchronized before and after every render call. CUDA-event time measures GPU-stream work scheduled by render(), including GPU-side renderer preparation but excluding selection and image saving. Synchronized render-call wall time includes Python call/launch overhead and GPU wait, but excludes selection and image saving.
- PNG-saving time was separately measured around save_image plus synchronization. Quality metrics were computed from the saved PNGs and the existing baseline GT PNGs using Graphdeco’s utils.image_utils.psnr and utils.loss_utils.ssim helpers.
- The existing evaluate_rendered_baseline.py was inspected but not run: it writes results and comparison images into the original baseline directory. Its metric functions were reused without its baseline-writing side effects.

## 2. Environment

- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU; 6,144 MiB reported total, 6,002 MiB free before the run.
- Python: 3.11.18.
- PyTorch: 2.11.0+cu128.
- CUDA runtime reported by PyTorch: 12.8.
- Official separate-SH mode: false, matching the installed Graphdeco render.py setting.
- Test set: 32 views, native 979 × 546 pixels.
- Existing baseline test PNG metrics: PSNR 25.540365 dB; SSIM 0.88525365.

## 3. Gaussian budgets

| Retained | K |
|---:|---:|
| 100% | 2,050,123 |
| 75% | 1,537,592 |
| 50% | 1,025,061 |
| 25% | 512,530 |
| 10% | 205,012 |
| 5% | 102,506 |

## 4. Test quality

Metrics are arithmetic means across the same 32 saved test views. Delta columns compare with this benchmark’s 100% run. Relative PSNR percent is not reported because PSNR is logarithmic; the final column gives the implied increase in geometric-mean per-view MSE from the mean PSNR delta.

| Retained | K | Mean PSNR (dB) | Mean SSIM | Δ PSNR (dB) | Δ SSIM | Implied geometric-mean MSE increase |
|---:|---:|---:|---:|---:|---:|---:|
| 100% | 2,050,123 | 25.5404 | 0.88525 | 0.0000 | 0.00000 | 0.0% |
| 75% | 1,537,592 | 25.2118 | 0.88166 | −0.3286 | −0.00359 | 7.9% |
| 50% | 1,025,061 | 23.5604 | 0.85672 | −1.9799 | −0.02854 | 57.8% |
| 25% | 512,530 | 19.3648 | 0.73801 | −6.1756 | −0.14724 | 314.5% |
| 10% | 205,012 | 13.6679 | 0.49505 | −11.8725 | −0.39020 | 1,439.0% |
| 5% | 102,506 | 10.3477 | 0.33505 | −15.1927 | −0.55021 | 3,205.7% |

The 100% metrics exactly match the existing baseline evaluation: PSNR 25.5403652191 dB and SSIM 0.8852536548. All 32 generated 100% PNGs are pixel-identical to the original baseline test renders.

LPIPS is unavailable. No cached LPIPS/VGG weights were found in the existing environment; only an unrelated EfficientNet checkpoint was present in the Torch cache. No weight download was attempted.

## 5. Render timing and selection overhead

Timing standard deviations below are population SD across 96 measured render calls (3 repetitions × 32 views). GPU-stream FPS is 32 divided by mean summed CUDA-event time for one 32-view pass. Synchronized render-call FPS uses synchronized wall time and is not kernel-only. Neither FPS includes selection or PNG saving.

| Retained | GPU stream ms/view (mean ± SD) | GPU stream FPS | Synchronized render-call ms/view (mean ± SD) | Synchronized FPS | Selection setup ms (mean ± SD) | Save 32 PNGs (s) |
|---:|---:|---:|---:|---:|---:|---:|
| 100% | 49.03 ± 24.32 | 20.40 | 52.06 ± 27.07 | 19.21 | 1.21 ± 0.63 | 9.142 |
| 75% | 37.96 ± 27.29 | 26.34 | 42.26 ± 27.22 | 23.66 | 39.13 ± 6.96 | 9.384 |
| 50% | 34.75 ± 30.95 | 28.77 | 37.03 ± 31.92 | 27.00 | 31.60 ± 25.61 | 9.018 |
| 25% | 26.32 ± 29.85 | 37.99 | 29.14 ± 29.90 | 34.32 | 37.82 ± 39.83 | 8.743 |
| 10% | 19.57 ± 20.25 | 51.09 | 21.56 ± 20.63 | 46.39 | 22.67 ± 24.14 | 9.099 |
| 5% | 11.99 ± 10.38 | 83.39 | 14.93 ± 10.39 | 66.99 | 7.75 ± 1.44 | 8.613 |

A shared opacity sort took 0.236 seconds once and was reused for all six budgets. Selection setup is the measured call to select_by_opacity() with the ranking already prepared; it includes index creation and selected attribute gathers. The subset’s combined SH tensor is lazily assembled on first render and is included in render-call work, not this setup figure. No view performs a new sort or selection.

The synchronized render-call FPS increases by approximately 1.23× at 75%, 1.41× at 50%, and 3.49× at 5% relative to 100%. The high per-view timing variability reflects differences between views and run-to-run GPU timing; see timing CSVs for all samples.

PNG saving took 8.6–9.4 seconds per 32-image pass (about 269–293 ms/image). It is excluded from both rendering FPS columns and is comparable to the PNG-I/O-dominated time in the original render-plus-save run.

## 6. GPU memory

PyTorch peak memory was reset around each view render and sampled before image saving. Values include the resident model, selected subset where applicable, and rasterizer allocations; they are per-process PyTorch allocated/reserved memory, not total device usage.

| Retained | Peak allocated (GiB) | Peak reserved (GiB) |
|---:|---:|---:|
| 100% | 1.31 | 1.45 |
| 75% | 1.39 | 1.54 |
| 50% | 1.09 | 1.49 |
| 25% | 0.79 | 0.85 |
| 10% | 0.61 | 0.76 |
| 5% | 0.55 | 0.76 |

PyTorch figures exclude other processes and device/driver memory. nvidia-smi showed 0 MiB used and 6,002 MiB free after the benchmark process exited.

## 7. Visual comparison

Comparison sheets use identical test views and dimensions, with Ground Truth, 100%, 75%, 50%, 25%, 10%, and 5% in each sheet:

- D:\3DGS-Research\experiments\fixed_topk_benchmark\visualizations\view_00_comparison.png
- D:\3DGS-Research\experiments\fixed_topk_benchmark\visualizations\view_15_comparison.png
- D:\3DGS-Research\experiments\fixed_topk_benchmark\visualizations\view_31_comparison.png

View 15 shows the 75% and 50% results remain recognizable, while 25% has visible loss of detail and 10%/5% show severe blur, missing structure, and artifacts. These observations are illustrative; the quantitative conclusion uses all 32 views.

## 8. Output artifacts and integrity

Output directory size is 162,575,975 bytes (about 155.1 MiB), containing 192 saved benchmark render PNGs, two preflight PNGs, three comparison sheets, CSV/JSON results, and metadata. D: free space decreased from 12,653,719,552 bytes to 12,490,633,216 bytes.

Results files:

- results\aggregate_metrics.csv — six aggregate metric rows.
- results\per_view_metrics.csv — 192 per-view metric rows.
- results\timings.csv — six aggregate timing/memory rows.
- results\per_view_timings.csv — 576 timed render-call samples.
- results\benchmark_results.json — environment, metrics, timing methodology, memory, and comparison data.
- results\integrity.json and integrity_before.json — before/after SHA-256 values.

SHA-256 checks matched before and after for the iteration-30,000 checkpoint, final PLY, render.py, gaussian_renderer\__init__.py, rasterizer binding, CUDA forward implementation, and Experiment 01 selector. The original baseline render/GT images, evaluation JSON, and visualizations were read-only inputs. All new render files and comparisons are isolated under fixed_topk_benchmark.

## 9. Limitations and observations

- Opacity is only the fixed baseline ranking heuristic; these results do not establish Gaussian sensitivity or visual contribution.
- The model is loaded from Graphdeco’s iteration PLY for inference. The .pth checkpoint is not used by the official renderer, and remained unchanged.
- The full source model still resides on GPU during selection. Subset copies add temporary GPU memory; the experiment reduces rasterizer population but does not remove the source model’s storage cost.
- CUDA-event time is GPU-stream render-call work, not a kernel-only profiler measurement. Synchronized render-call wall time includes Python overhead and wait time. Image saving is separate.
- Three timed repetitions provide limited statistical sampling; standard deviations are high for some budgets. Do not over-interpret small timing differences.
- Image quality falls sharply below 50% retention. The 75% budget offers the most favorable measured balance in this sweep, while 5% gives the highest throughput and the worst quality.

## 10. Commands used

Preflight:

    & 'D:\Miniconda\envs\3dgs\python.exe' -u 'experiments\fixed_topk\benchmark_opacity_topk.py' -m 'D:\3DGS-Research\experiments\baseline_truck' --iteration 30000 --mode preflight

Full benchmark:

    & 'D:\Miniconda\envs\3dgs\python.exe' -u 'experiments\fixed_topk\benchmark_opacity_topk.py' -m 'D:\3DGS-Research\experiments\baseline_truck' --iteration 30000 --mode full --repetitions 3

No sensitivity scoring, view-dependent selection, temporal consistency, retraining, or full-resolution model changes were performed.

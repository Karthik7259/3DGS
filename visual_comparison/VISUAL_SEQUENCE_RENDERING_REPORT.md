# Visual Sequence Rendering Report

**Status:** completed and validated  
**Project:** Tanks and Temples Truck 3D Gaussian Splatting research  
**Output:** `D:\3DGS-Research\visual_comparison`

## Summary

Rendered five synchronized image sequences over **40 filename-ordered training cameras**. Every method used the same original Graphdeco `Camera` object for each frame and the same original renderer, CUDA rasterizer, background, SH configuration, and 979×546 output resolution. No test cameras were used.

The single-camera validation passed before the remaining 39 frames were rendered. The final integrity check confirmed that the protected checkpoint, baseline PLY, sensitivity scores, selection/scoring source files, renderer, and dataset camera file were unchanged.

## Camera sequence

The 40 camera loader indices were selected deterministically as `round(linspace(0, 218, 40))`, then kept in ascending filename order:

`0, 6, 11, 17, 22, 28, 34, 39, 45, 50, 56, 61, 67, 73, 78, 84, 89, 95, 101, 106, 112, 117, 123, 129, 134, 140, 145, 151, 157, 162, 168, 173, 179, 184, 190, 196, 201, 207, 212, 218`

Corresponding original image filenames:

`000002.jpg, 000008.jpg, 000014.jpg, 000021.jpg, 000027.jpg, 000034.jpg, 000040.jpg, 000046.jpg, 000053.jpg, 000059.jpg, 000066.jpg, 000071.jpg, 000078.jpg, 000085.jpg, 000091.jpg, 000098.jpg, 000103.jpg, 000110.jpg, 000117.jpg, 000123.jpg, 000130.jpg, 000135.jpg, 000142.jpg, 000149.jpg, 000155.jpg, 000162.jpg, 000167.jpg, 000174.jpg, 000181.jpg, 000187.jpg, 000194.jpg, 000199.jpg, 000206.jpg, 000212.jpg, 000219.jpg, 000226.jpg, 000231.jpg, 000238.jpg, 000244.jpg, 000251.jpg`

The first camera is loader index/Graphdeco camera ID 0 (`000002.jpg`, COLMAP image ID 2); the final camera is index/ID 218 (`000251.jpg`, COLMAP image ID 251). The manifest records position, rotation matrix, image dimensions, selection method, budget, and retained count for every frame/method pair. COLMAP image IDs were mapped from the prior validated full training-camera sequence by filename.

## Methods and output folders

| Method | Folder | Budget | Gaussians per frame | Selection details |
|---|---|---:|---:|---|
| Baseline | `baseline/` | 100% | 2,050,123 | Full iteration-30,000 model. |
| Opacity Top-K | `opacity_10/` | 10% | 205,012 | Existing validated activated-opacity ranking implementation; fixed global subset. |
| Global Sensitivity Top-K | `sensitivity_10/` | 10% | 205,012 | Reused the saved full 219-training-view selection IDs. A deterministic ranking replay matched the saved IDs exactly. |
| Hybrid Sensitivity + View-Dependent | `hybrid_10/` | 10% | 205,012 | Existing projected-footprint scorer and normalization; validated sensitivity-dominant weights \(\alpha=0.75, \beta=0.25\). Camera-specific subset. |
| Temporal Hybrid | `temporal_hybrid_10/` | 10% | 205,012 | Same hybrid score, processed sequentially; ordinary hybrid Top-K initializes frame 1, then validated minimum-retention selector with \(R=0.95\). |

The exact budget is \(K=\lfloor 0.10\times2{,}050{,}123\rfloor=205{,}012\). The temporal selector’s minimum overlap is \(\lceil0.95K\rceil=194{,}762\) Gaussians at every transition. All 39 transitions met the minimum; each retained exactly 194,762 previous IDs.

The view-dependent score was recomputed with the existing validated scorer for the selected camera path. This does not change the scoring method; it supplies the per-camera score needed by the requested cameras outside the earlier 20-camera temporal rendering pilot. No selection method was invented.

## Rendering configuration

- Checkpoint: `experiments\baseline_truck`, iteration 30,000; 2,050,123 Gaussians.
- Dataset: `training_data\truck_baseline`; training cameras only.
- Image size: 979×546, native stored-image resolution.
- SH degree: 3, from the preserved model configuration.
- Background: black (`white_background=False` in preserved `cfg_args`).
- Exposure/test mode: preserved configuration (`train_test_exp=False`).
- Renderer: original `gaussian_renderer.render` and existing CUDA rasterizer.
- Camera pose/intrinsics/FOV: original loaded Graphdeco camera objects; no pose or camera-path edits.
- Same renderer parameters, background, camera, and output dimensions across all five methods.
- Elapsed render time for frames 2–40 across five methods: approximately 29.27 seconds; this excludes selection/scoring time and image validation and is not a performance benchmark.

## Single-camera preflight validation

Frame 1 (`000002.jpg`, camera ID 0) was rendered with all methods before the remaining frames. It passed the following checks:

- All five outputs used the same camera object and had dimensions 979×546.
- Baseline rasterizer input count was 2,050,123.
- Every 10% method supplied exactly 205,012 Gaussian rows.
- XYZ, opacity, scaling, rotation, and SH feature tensors had matching point counts for each selected subset.
- Temporal selection used ordinary hybrid Top-K initialization on frame 1.
- All rendered values were finite and saved PNGs opened successfully.

The hybrid and temporal-hybrid frame 1 images are pixel-identical by SHA-256 because the first temporal frame uses the same ordinary hybrid Top-K selection. Subsequent temporal frames follow the R=0.95 retention rule.

## Full sequence validation

- 40 frames were produced in each of five method directories (200 PNGs total).
- Every expected sequential filename `frame_0001.png` through `frame_0040.png` exists in each folder.
- Every PNG was reopened and validated at 979×546.
- Camera manifests contain 200 rows: 40 frames × five methods.
- Temporal retention passed for all 39 transitions, with 194,762 shared IDs each.
- Saved global sensitivity Top-K IDs matched deterministic replay.
- Protected input hashes matched before/after rendering.
- Total output directory size at verification was approximately 134.6 MB.

## Files

- `baseline\frame_0001.png` … `frame_0040.png`
- `opacity_10\frame_0001.png` … `frame_0040.png`
- `sensitivity_10\frame_0001.png` … `frame_0040.png`
- `hybrid_10\frame_0001.png` … `frame_0040.png`
- `temporal_hybrid_10\frame_0001.png` … `frame_0040.png`
- `camera_manifest.csv` — camera IDs, original filenames, pose, dimensions, selection method, budget, and count.
- `visual_sequence_results.json` — camera list, validation results, rendering details, per-camera scorer/retention records, output hashes, and protected input hashes.
- `render_visual_sequence.py` — standalone reproduction script using the validated scoring, selection, and rendering implementations.

## Limitations

- This is a 40-camera sampled training path, not all 219 training views and not the 32 held-out test views.
- The hybrid view score remains the previously documented projected-footprint proxy, not true alpha-composited per-Gaussian contribution.
- The temporal sequence has set-retention validation, not a new image-quality benchmark or a perceptual flicker evaluation.
- The reported 29.27-second render elapsed time excludes score computation and should not be compared with end-to-end throughput figures.
- No video was created.

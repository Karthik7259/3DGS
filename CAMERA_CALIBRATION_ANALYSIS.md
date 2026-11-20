# Truck Camera Calibration Analysis

**Date:** 2026-11-20  
**Dataset:** `D:\3DGS-Research\datasets\truck`  
**Repository:** `D:\3DGS-Research\gaussian-splatting`

## Findings from the stored COLMAP model

Read `sparse/0/cameras.bin` with the repository's existing COLMAP binary reader. The single camera is:

- ID: 1
- Model: `PINHOLE`
- Calibration dimensions: 1957 × 1091
- Parameters `[fx, fy, cx, cy]`: `[1163.2547280302354, 1156.280404988286, 978.5, 545.5]`

All 251 stored images are 979 × 546.

| Axis | Actual / COLMAP dimension | Corresponding enlargement factor |
|---|---:|---:|
| Width | 979 / 1957 = **0.5002554931** | 1.9989785495× |
| Height | 546 / 1091 = **0.5004582951** | 1.9981684982× |

The two downscale factors differ by about 0.0405% relative, consistent with integer rounding when dimensions are halved. The dimensions are strong evidence that the files were downscaled by approximately 2×, but dimensions alone cannot prove how they were produced (for example, rounding, cropping, or a mismatched source model could also explain a discrepancy). The dataset itself was not modified.

If the images were resized from the calibration resolution without cropping, the intrinsics in actual-image pixel coordinates are obtained per axis with `sx = 979/1957`, `sy = 546/1091`:

```text
fx' = sx * fx = 581.9245675736
fy' = sy * fy = 578.6701201866
cx' = sx * cx = 489.5
cy' = sy * cy = 273.0
```

The principal point remains at the image center (using the COLMAP half-dimension convention). Per-axis scaling preserves angular FOV:

- FOV X = `2 atan(width / (2 fx))` = **80.13937°** before and after scaling.
- FOV Y = `2 atan(height / (2 fy))` = **50.51319°** before and after scaling.

Image resizing changes pixel-valued intrinsics, not the physical viewing angles. FOV should stay invariant for a resize with no crop or lens change. A crop would also shift the principal point and needs a separate crop offset adjustment.

## How Graphdeco handles the values

1. `scene/dataset_readers.py::readColmapSceneInfo` reads `images.bin` and `cameras.bin` (text fallback is used only if binary reading raises).
2. `readColmapCameras` copies COLMAP dimensions to its camera-info record and computes FOV from COLMAP focal length and dimension. For `PINHOLE`, it uses separate `fx`/`fy`. It does not directly pass `cx`/`cy` onward.
3. `utils/camera_utils.py::loadCam` opens the JPG and uses its actual PIL dimensions (979 × 546) to create the resized image tensor. `--resolution -1` keeps these files at native size because their width is below 1600. `--resolution 1` also means native size.
4. `scene/cameras.py::Camera` stores the tensor's actual width/height and constructs the projection matrix from the FOV. Thus, rasterization at 979 × 546 with the original FOV has effective focal lengths `width/(2 tan(FOVx/2))` and `height/(2 tan(FOVy/2))`, approximately **581.925** and **578.670** pixels. These equal the appropriately scaled focal lengths above.

Therefore, for a centered `PINHOLE` camera and a proportional resize without crop, Graphdeco's FOV representation is scale invariant: it uses the original calibration dimensions to compute the angular FOV, then the actual image dimensions for the output raster. The old report's implication that the factor-of-two dimensions alone cause a projection/FOV error was too strong. The loader does not rewrite the COLMAP intrinsics or metadata dimensions, but that fact alone does not imply an incorrect projection in its centered-FOV camera model.

The original model has centered principal point values, so the loader's lack of explicit `cx`/`cy` handling is not an added offset here. Graphdeco assumes a centered projection; off-center principal points or cropping would require further handling and are outside this simple FOV mapping.

## Comparison of approaches

### A. Upscale images back to 1957 × 1091

- This does not restore detail lost during downsampling; it interpolates pixels and nearly quadruples per-image pixel count versus 979 × 546.
- The original FOV remains the same, so upscaling does not improve the camera geometry for Graphdeco.
- It uses substantially more VRAM and changes the dataset files if done in place.
- **Assessment:** Not recommended.

### B. Scale COLMAP intrinsics to match the stored images

- Scale `fx,cx` by `sx`, `fy,cy` by `sy`, and set camera width/height to 979/546 in a derived COLMAP model.
- This produces explicit calibration metadata in the same pixel coordinate system as the JPGs. FOV remains the same, so Graphdeco's raster projection should be unchanged for this centered PINHOLE case.
- Do it only in a separate derived dataset/model copy, retaining the original binaries as the untouched source of record. Keep the transform and values documented.
- **Assessment:** Recommended if a canonical, image-resolution-matched calibration is desired for reproducible downstream tools. It is a metadata normalization, not a change to the field of view.

### C. Automatically reconcile during preprocessing/loading

- An explicit conversion step can inspect image sizes, scale intrinsics, emit a derived dataset, and record what it changed. This is useful for a general pipeline if it validates model type, axis scale, crop assumptions, and existing metadata.
- Silent automatic adjustment inside the original training loader would modify behavior for every dataset and could be wrong for cropped images, mixed resolutions, or intentionally mismatched metadata.
- **Assessment:** Not recommended as an implicit modification to original Graphdeco. A future opt-in preprocessing command with a derived output and manifest is safer.

## Recommendation for the research baseline

Preserve the downloaded ZIP and `datasets\truck` exactly as they are. Do not upscale the JPGs and do not patch the original loader. The existing Graphdeco FOV projection is mathematically consistent with a centered camera whose images were resized proportionally, so the dimension difference alone does not require a corrective loader change.

For baseline reproducibility, first validate image/camera alignment. If explicit camera metadata at 979 × 546 is needed by other tools or the validation shows an issue, create a separate derived scene (for example, `datasets\truck_calibrated_979x546`) with the per-axis scaled intrinsics above and a manifest recording the original values, scale factors, and assumptions. Do not replace the original `cameras.bin`. Compare FOV before/after; it should remain unchanged. Avoid an automatic loader rewrite until a reusable, opt-in conversion has tests for cropping and mixed-resolution inputs.

## Proposed implementation and pre-training validation plan

No implementation was performed. If proceeding later:

1. Keep the original ZIP, original scene, and original Graphdeco source read-only as the reference.
2. Generate an isolated derived scene or calibration file. Set its camera dimensions to 979 × 546 and scale `fx,cx` by `sx` and `fy,cy` by `sy`; leave image pixels and poses untouched. Record provenance and the exact transform in a manifest.
3. Verify the derived model parses, has expected dimensions/parameters, and produces the same FOV values as the original model. Check all image names and IDs still resolve.
4. Before any training, perform a sparse-point overlay diagnostic on a small, representative image sample: project registered 3D points using the image-resolution intrinsics and camera poses, then compare their locations with visible scene features. Save overlays outside the original dataset. Also compute reprojection residuals against COLMAP's 2D observations after applying the same image-coordinate scaling; inspect for systematic offsets, axis errors, or residual growth.
5. Compare the original and derived loader camera objects and projection matrices. For this dataset's centered pinhole camera, FOV and projection should match within floating-point tolerance. If they do not, stop and investigate rather than training.
6. Only after alignment review, select which scene path is the baseline input and document it. Do not silently switch between original and derived data.

## Scope respected

This was read-only analysis. The original archive, extracted dataset, and Graphdeco source were not modified. No packages were installed, and no training or rendering was run.

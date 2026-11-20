# Truck Dataset Alignment Validation

**Date:** 2026-11-20  
**Dataset:** `D:\3DGS-Research\datasets\truck`  
**Validation environment:** existing `D:\Miniconda\envs\3dgs` Python environment

## Summary

The Truck scene passed read-only structural checks and sparse reprojection checks. All 251 registered image records resolve to stored 979 × 546 JPGs. The single COLMAP `PINHOLE` camera and all poses/points parsed successfully. Camera poses form a smooth loop around the scene and generally point toward the sparse reconstruction. The median scaled reprojection residual is about 0.33 px and the 95th percentile is about 1.10 px. Representative image overlays show COLMAP 3D reprojections closely following their corresponding 2D observations and visible scene features.

**Assessment:** The data is suitable to proceed to a baseline from the dataset-alignment perspective. No obvious camera/image mismatch or gross reconstruction failure was found. This is not an independent ground-truth validation and does not eliminate the need to monitor the first training run for memory or optimization issues.

## Methods

A temporary validation script, `validation\validate_truck_alignment.py`, used only existing Python packages and the original repository's COLMAP binary reader. It read `cameras.bin`, `images.bin`, and `points3D.bin` without calling the scene loader path that can create `points3D.ply`. It checked image-name resolution, dimensions, finite pose/point values, quaternion normalization, track consistency, point depths, camera trajectory, and sparse reprojections.

For geometric reprojection, each registered 3D point was transformed by its COLMAP world-to-camera pose and projected with the stored `PINHOLE` parameters. Reprojected positions were compared with the corresponding `images.bin` 2D observations. Residuals were also scaled to the actual JPG pixel grid using `sx=979/1957` and `sy=546/1091`. Six representative images (`000001`, `000051`, `000101`, `000151`, `000201`, `000251`) were inspected in a contact sheet with scaled 2D observations in green and 3D reprojections in magenta. The plotted imagery and diagnostics were written only under `validation\`.

## Camera, image, and pose findings

- Images on disk: 251 JPGs; every image is 979 × 546.
- COLMAP registered images: 251; no image names were missing from `images/`.
- Camera count/model: one `PINHOLE` camera, 1957 × 1091.
- Parameters `[fx, fy, cx, cy]`: `[1163.254728, 1156.280405, 978.5, 545.5]`.
- Actual/calibration scales: X 0.5002554931, Y 0.5004582951. The slight difference is consistent with rounding integer image dimensions during approximately 2× resizing.
- All pose values were finite; quaternion norms ranged from 0.9999999999999999 to 1.0000000000000002.
- COLMAP observation-track references were mutually consistent: zero image observations refer to missing 3D points, zero image-to-point track mismatches, and zero point-to-image observation mismatches.
- Camera-center bounding-box spans in COLMAP world coordinates: X 9.65, Y 1.62, Z 9.06 units.
- Ordered by image filename, path length was 84.38 units; consecutive camera-center step median was 0.354 units, with observed range 0.0277–0.5142. No pose discontinuity was evident.
- Angle between each camera's forward axis and direction to the sparse-cloud centroid: median 20.51°, 90th percentile 35.75°, maximum 58.99°. Headings generally face into the reconstructed scene.

The camera trajectory plot shows a compact, smoothly sampled loop with orientations directed inward. This supports reasonable scene coverage; it does not establish exact capture coverage outside the registered views.

## Sparse reconstruction findings

- Sparse points: 136,029; all XYZ coordinates were finite.
- Point reprojection count: 1,083,072 valid image/point observations; none had nonpositive camera-space depth.
- COLMAP point-error quantiles (min/median/90th/95th/99th/max): approximately `0.00006 / 0.664 / 1.412 / 1.697 / 2.282 / 3.991`.
- Track-length quantiles (min/median/90th/95th/99th/max): `2 / 5 / 17 / 24 / 45 / 236` images.
- The point cloud has a dense scene cluster and an extended sparse tail. About 8,135 points are more than 25 world units from the coordinate-wise median; 354 of those have only two-view tracks. Some distant points can be legitimate background structure, but this tail and the many short tracks are appropriate items to keep in mind when inspecting training behavior. They did not produce large reprojection errors in the checks below.

### Reprojection residuals

Residuals compare the projection from each stored 3D point and COLMAP pose against that same image's COLMAP 2D observation. After scaling residual coordinates to the stored JPG pixel grid:

| Percentile | Error |
|---:|---:|
| Median | 0.334 px |
| 90th | 0.866 px |
| 95th | 1.103 px |
| 99th | 1.562 px |
| Maximum | 2.089 px |

There were no negative-depth observations. The low residuals and close overlay agreement indicate that image names, poses, sparse points, and the approximately half-resolution pixel mapping are internally consistent. This agrees with Graphdeco's FOV-based projection behavior for a centered pinhole camera resized without cropping.

## Visualizations and supporting files

- [Camera trajectory and sparse point cloud](D:/3DGS-Research/validation/truck_trajectory_sparse_cloud.png) — two world-coordinate projections. The plotted axes clip the point cloud to its 1st–99th coordinate percentiles so the camera path remains visible; distant points remain in the metrics and source data.
- [Representative observation/reprojection overlays](D:/3DGS-Research/validation/truck_reprojection_overlays.png) — green rings are scaled COLMAP 2D observations; magenta crosses are projections of the associated sparse 3D points. They closely overlap across the six views.
- [Alignment metrics](D:/3DGS-Research/validation/truck_alignment_metrics.txt)
- [Validation script](D:/3DGS-Research/validation/validate_truck_alignment.py)

## Anomalies and limitations

- No missing images, malformed poses, non-finite points, negative-depth observations, gross trajectory jumps, or large reprojection residuals were detected.
- The scene has distant sparse points and many two-view/short tracks, common potential sources of weak or noisy geometry. The point cloud was not filtered or altered.
- This check is internally based on the COLMAP reconstruction and its own feature observations; it is not independent ground truth. It cannot prove the image production history, inspect unseen views, or establish absolute metric scale.
- Overlay inspection used six evenly spaced frames and a sampled set of tracks. The underlying reprojection statistics used all valid registered image/point observations.
- No trained model was rendered, no training was started, and no package was installed.

## File integrity and scope

The dataset, COLMAP files, Graphdeco source, and downloaded ZIP were not modified. The validation script did not create `sparse/0/points3D.ply`. All validation artifacts are contained in `D:\3DGS-Research\validation`.

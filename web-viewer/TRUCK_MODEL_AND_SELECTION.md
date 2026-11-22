# The Truck Gaussian Model and Selection Methods

## Overview

This project uses the Tanks and Temples Truck scene, a real scene reconstructed from calibrated photographs. The viewer opens the trained Graphdeco Gaussian model at iteration 30,000. Its source is the original binary PLY file in `experiments/baseline_truck/point_cloud/iteration_30000/point_cloud.ply`.

The current file contains 2,050,123 Gaussian primitives and spherical harmonics (SH) through degree 3. The PLY is about 508 MB. The viewer streams it from the existing experiment directory. It does not make a second copy in the website.

## How the reconstruction was made

The Truck model is a trained reconstruction supplied with this research project. The model-building and training implementation is Graphdeco's 3D Gaussian Splatting project, included under `gaussian-splatting`. The browser viewer does not train the scene. It loads the already-trained iteration 30,000 PLY and visualizes it.

During Gaussian Splatting, images and camera calibration are used to optimize a set of spatially positioned, oriented, and scaled 3D Gaussian primitives. Each primitive also stores opacity and view-dependent color. The model's spherical-harmonic coefficients describe how its color changes with viewing direction. Together, the millions of overlapping primitives approximate the photographed scene from new camera positions.

The Truck's camera calibration is read from `experiments/baseline_truck/cameras.json`. Saved poses and image measurements let the viewer return to the front three-quarter, side, and rear camera views. Capture orbit follows the measured photographic camera path. Free orbit supports arbitrary rotation, panning, and zoom.

## How the browser draws the model

1. The Vite server serves the original PLY at `/model/truck.ply`, camera calibration at `/model/cameras.json`, and research assets from the adjacent `experiments` directory.
2. Spark decodes the binary PLY in the browser. The React Three Fiber canvas and Three.js provide the WebGL scene and camera controls. Spark sorts and draws the Gaussian splats for the current view.
3. The viewer checks the decoded count and SH degree against the benchmark model. It reports the live view as ready after Spark can present the model.
4. Selecting a reduced representation retrieves an ordered list of original PLY row IDs. The browser uses those IDs to read each selected Gaussian from the already-loaded source, including its geometry, opacity, color, and degree-3 SH.
5. The same original model remains available when switching methods, budgets, or camera views. Saved benchmark comparisons use archived Graphdeco renders for the matching held-out camera.

The source renderer and the selected models refer to the same PLY rows. The selection lookup uses an integer GPU texture to map each subset index to its original row, preserving the associated SH coefficients without rebuilding a second model file.

## How the selection techniques are applied

The six retention budgets are 5%, 10%, 25%, 50%, 75%, and 100%. For a budget (b), the viewer selects `floor(2,050,123 × b / 100)` Gaussians. A 5% selection therefore contains 102,506 primitives.

### Original model

The baseline draws all 2,050,123 Gaussians in original PLY order. It provides the full-quality visual reference.

### Opacity Top-K

The viewer reads each Gaussian's learned opacity from the PLY, applies the sigmoid activation, and orders primitives from highest to lowest activated opacity. Equal scores use original PLY row order as a stable tie break. The requested budget takes the first (K) IDs in that order.

This ranking is computed by the local Vite server from the original PLY when the opacity ranking is first requested. The viewer does not claim that a higher-opacity Gaussian always contributes more to image quality. The benchmark measures the resulting quality and throughput.

### Global sensitivity

Training-view sensitivity scores were calculated by the research pipeline and saved in `experiments/sensitivity_topk_benchmark/results/selected_gaussian_ids.json`. The viewer uses the saved global ordering and takes its first (K) IDs.

Because this ranking is global, it is shared across the camera views. It avoids recalculating sensitivity scores in the browser.

### Hybrid sensitivity and view-dependent selection

The hybrid research method combines the global sensitivity ranking with a camera-specific, opacity-weighted projected-footprint score. The research pipeline computes a distinct ranking for each of the 32 test-camera views and saves these arrays in `experiments/sensitivity_view_topk_benchmark/results/camera_rankings`.

The viewer lets the user choose a saved reference camera. The server returns the first (K) IDs from that camera's saved hybrid ranking. The ranking remains fixed while the viewer camera moves. It does not recompute projected footprints for arbitrary interactive viewpoints.

## Benchmark values and what they mean

The benchmark comparison displays paired original and selected Graphdeco images for the same saved test camera. The PSNR and SSIM values are archived means across the 32 held-out test cameras. They describe the complete measured benchmark run rather than only the currently displayed image.

The quality-versus-retention chart and table read the experiment CSV files. Render-call FPS comes from the synchronized timing measurements in the corresponding experiment. Browser camera-motion FPS is a separate local measurement and depends on the viewer hardware and current browser.

The hybrid method is an evaluated option, not an across-the-board winner. Its relative quality and speed vary with the retention budget and test view. The archived charts let readers inspect these tradeoffs without altering experimental results.

## Temporal selection

Temporal Analysis replays a separate 20-camera pilot. Independent Top-K selects a fresh ranking at each sample. The medium and strong variants add minimum overlap with the preceding selection, using retention values (R=0.95) and (R=0.98). The pilot supports 5% and 10% budgets. The viewer can animate the measured camera path or compare the three archived renders at a matched frame.

## Main implementation files

- `src/TruckScene.tsx` loads and owns the live Graphdeco PLY and replaces the displayed subset after selection data arrives.
- `src/RankedSplats.ts` maps selected subset indices to original Gaussian rows.
- `src/LiveViewport.tsx` connects the Spark renderer, WebGL canvas, and camera controls.
- `src/cameraRig.ts` applies the calibrated cameras and capture-orbit behavior.
- `vite.config.ts` serves the PLY, camera data, rankings, archived images, and benchmark metrics.
- `src/Benchmark.tsx` presents the matched camera comparisons and archived measurement charts.

## Data and scope

The training run and its research artifacts predate this browser viewer. This document describes how the viewer uses the trained model and saved experiments. It does not assert that the viewer creates or retrains the Truck reconstruction.

# Splatlab Truck research viewer

Splatlab opens the Tanks & Temples Truck at a calibrated front three-quarter view. Drag horizontally in **Capture orbit** to circle the truck through photographed viewpoints. Scroll or pinch for optical zoom. **Free orbit** supports vertical rotation, pan and dolly. Right-drag or the pan tool switches to free orbit. The three camera cards return to saved capture poses.

## Run locally

From the `web-viewer` directory, with the existing dependencies installed, run the following command and open the printed loopback address.

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

For the built application, run TypeScript and Vite's build, then serve it with Vite preview. Both servers use the same read-only routes for the PLY, calibration, ID arrays, metrics and renders in the adjacent `experiments` directory. A static file server serving only `dist` cannot provide those assets.

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1
```

## Research controls

**Workspace** displays the full trained model or an exact fixed-budget subset. Opacity uses activated PLY opacity with original row order for ties. Global sensitivity uses the saved experiment ranking. The hybrid method uses a saved ranking for the selected reference camera and holds it fixed during free orbit. All six budgets use the experiment's floor rule for the selected count.

**Benchmarks** displays the original and selected Graphdeco images for the same held-out camera. The PSNR and SSIM table reports the archived means across 32 test cameras. The comparison pauses the live viewport. The model and free-camera position stay available when returning to Workspace.

**Temporal Analysis** plays the original 20-camera rendering pilot. Select independent, medium (R = 0.95) or strong (R = 0.98) at 5% or 10%. **Live 3D** renders the exact saved ID set and follows the calibrated training cameras between samples. **Compare three** shows the three original Graphdeco images with synchronized native-resolution detail crops. The timeline supports stepping, scrubbing, looping and four playback speeds. The inspector reports the archived metrics for the measured frame. [Temporal Analysis report and screenshots](MILESTONE_2_TEMPORAL_ANALYSIS_REPORT.md)

## Rendering audit and changes

| Finding in the previous viewer | Implementation |
| --- | --- |
| Distant reconstructed scenery placed the PLY bounds center about 33 scene units from the truck. The orbit distance was derived from these bounds. | Fit the subject depth from 251 calibrated optical rays. Preserve the recorded pose and both focal lengths at each preset. Near/far planes and zoom limits follow the capture scale. |
| Selecting a different subset discarded the visible subset before fetching its replacement and gathered six attribute arrays on the UI thread. | Keep one extended-precision Spark source. Resolve the rendered row through an R32UI ID texture before accessing its geometry, opacity, DC color and directional SH. The full source uses identity indexing. Abort obsolete requests and replace a selection after validating its IDs. |
| The scene loader depended on the active camera and scanned the full model to compute the bounds. | Load the original 508,432,036-byte PLY independently of the camera. Signal readiness after the first nonempty GPU depth sort. Render on demand and invalidate after camera changes, new selections and asynchronous renderer updates. |
| The model was served only by the development server. The 100% global sensitivity route returned an empty payload. | Resolve research paths relative to the checkout, serve dev and production preview through the same endpoints and prepare global rankings in a server worker. |
| The old interface used a decorative scene graphic, tiny labels and a single fixed camera. | Use actual held-out Truck renders for camera thumbnails and a labeled loading reference. Add a collapsible inspector, fullscreen, three camera poses and measured renderer diagnostics. |

The model keeps its original world coordinates. The viewer uses Spark 2.4's extended encoding, degree-3 spherical harmonics, depth sorting, a black training background, and the unfiltered 3DGS covariance footprint. Spark packs some attributes for the GPU. At 75% retention the additional row lookup occupies about 5.87 MiB each in CPU and GPU memory, excluding renderer accumulators and sort buffers. [Spark extended splat representation](https://sparkjs.dev/docs/ext-splats/)

## Verification

- Streamed the entire source PLY and verified its SHA-256 against the baseline manifest. Spark decoded 2,050,123 rows at SH degree 3. All 51 sampled positions matched the source exactly.
- Checked 204 selection responses, including every method, budget and hybrid reference. All 192 hybrid selection hashes matched the saved research results. Verified the two image routes and aggregate metrics for 576 method, budget and camera combinations.
- Tested camera navigation on the **RTX 3050 6 GB Laptop GPU** via Chrome/ANGLE D3D11. The latest browser result includes the adapter, viewport dimensions, camera states, full temporal playback and system-wide memory samples. [Current hardware measurements](validation/workspace-smoke-results.json)
- Each of the three reduced modes displayed 102,506 rows at 5% retention with degree-3 SH. Also verified fullscreen, saved poses, paired comparison, the inspector toggle and a 390-pixel-wide mobile layout in the in-app browser. That browser selected Intel UHD graphics and measured 9.5 fps on one full-model preset transition.
- The full-model front view was compared with saved Graphdeco frame 7. Aligning the reference to the live screenshot and excluding viewport controls gave a mean absolute difference of **5.84 on an 8-bit RGB scale** over 514,639 pixels. This is a visual alignment and color check on a resampled JPEG screenshot. The research comparison table uses the separately saved benchmark results.

[Live workspace capture](validation/truck-workspace.jpg) · [RTX browser smoke results](validation/workspace-smoke-results.json) · [Selection smoke results](validation/selection-smoke-results.json)

To repeat the checks, run the local server on port 5173. The two browser scripts use installed Windows Chrome and accept a different loopback address in the `TRUCK_VIEWER_URL` environment variable. The camera and row-mapping tests run with Node 24. The data audit requires Python, NumPy and Pillow.

```powershell
node --test tools/ranked-splats.test.mjs tools/camera-rig.test.mjs
python tools/verify-temporal.py http://127.0.0.1:5173
node tools/browser-smoke.mjs
node tools/selection-smoke.mjs
```

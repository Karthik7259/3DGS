# Milestone 1 — Interactive Gaussian Viewer

**Status:** Completed. The original Truck Graphdeco PLY loaded in Spark.js and rendered visible Gaussian splats in the local browser smoke test.

## What was created

The application is in `D:\3DGS-Research\web-viewer`. It contains a dark research-viewer interface, a Three.js/WebGL canvas, the original Truck reconstruction, a model information panel, loading/error states, and interactive orbit, zoom, pan, and reset controls. Gaussian selection methods are intentionally not included in this milestone. The startup view now uses the saved training pose for camera ID 32 (`000002.jpg`), so the truck is upright, recognizable, and framed at the reconstruction's intended training viewpoint.

The viewer development server is currently available at `http://127.0.0.1:5173/`.

## Environment and dependencies

Environment checked before installation:

- Node.js: `v24.19.0`
- npm: `11.5.2`
- Existing React/Vite project manifests: none found in the workspace before this app was created.
- npm cache: Spark registry metadata was cached; a Spark package installation was not present in the project.
- D: free space: `8.47 GiB` before setup and `8.07 GiB` after installation/build and browser smoke artifacts.
- The 3DGS Python environment was not modified.

Pinned direct dependencies, recorded in `package.json` and `package-lock.json`:

| Package | Version |
|---|---:|
| React / React DOM | 19.2.0 |
| Three.js | 0.180.0 |
| React Three Fiber | 9.8.2 |
| Drei | 10.7.9 |
| Spark.js | 2.4.0 |
| Vite | 8.3.8 |
| Vite React plugin | 6.3.0 |
| TypeScript | 5.9.3 |

Supporting pinned type packages are `@types/react` 19.2.7, `@types/react-dom` 19.2.3, `@types/three` 0.180.0, and `@types/node` 24.19.2. The Node version meets Vite 8's declared engine range.

## Model loading and compatibility

The source model remains at:

`D:\3DGS-Research\experiments\baseline_truck\point_cloud\iteration_30000\point_cloud.ply`

It was not copied, converted, or written. The local Vite middleware exposes `/model/truck.ply` and `/model/cameras.json`, each mapped to a fixed read-only file path. It accepts `GET` and `HEAD`, supports byte-range reads, sends `Cache-Control: no-store`, and rejects other methods with `405`. It listens on `127.0.0.1`; a verification `POST` to the PLY endpoint received `405`.

The endpoint returned `200` with `Content-Length: 508432036`; a range request returned `206` for the requested 96 bytes. The PLY header identifies binary little-endian data with 2,050,123 vertices and Graphdeco properties including `f_dc_0..2` and `f_rest_0..44`, opacity, three scales, and four rotation values. Spark's current loading documentation lists original Gaussian Splatting PLY support and documents `new SplatMesh({ url })` ([Spark loading documentation](https://github.com/sparkjsdev/spark/blob/main/docs/docs/loading-splats.md)). The implementation uses the installed Spark 2.4.0 API, `SplatMesh({ url, extSplats: true, onProgress })`, plus `SparkRenderer({ renderer })` attached to the R3F scene.

The browser smoke check completed loading and Spark's loaded source reported **2,050,123 splats** and **SH degree 3**. The existing PLY's 45 `f_rest_*` properties and Spark's runtime SH result verify that degree-3 coefficients were available to the Spark representation. The app does not convert the PLY or discard higher SH bands. The initial camera position, rotation, and focal length come from the saved Graphdeco camera record for ID 32, image `000002.jpg`; the COLMAP/OpenCV camera axes are converted to Three.js axes, including the dataset camera's up direction. Reset returns to this pose. This confirms format loading and visible rendering; it does not claim pixel equivalence with Graphdeco's CUDA renderer.

## Verification results

| Check | Result |
|---|---|
| `npm install --no-audit --no-fund` | Passed; 121 packages installed/resolved |
| TypeScript + Vite production build | Passed; Vite 8.3.8 |
| Vite development server | Passed at `http://127.0.0.1:5173/` |
| Read-only model endpoint | Passed (`HEAD` 200, byte range 206, `POST` 405) |
| Spark renderer initialization | Passed |
| Full original PLY load | Passed; 2,050,123 splats |
| Degree-3 SH availability | Passed; Spark runtime reports degree 3 |
| Visible splats | Passed; captured screenshot shows the Truck reconstruction |
| Orbit / zoom / pan | Passed; browser-driven input changed camera position/target |
| Reset | Passed; returned to the saved fitted pose (position delta about `1e-14`, target delta `0`) |
| Drag responsiveness tuning | Passed; sort interval switches to 100 ms during camera interaction and returns to 0 ms afterward; pixel ratio is capped at 1 during drag and restored afterward |
| Browser console errors | 0 in final smoke run |
| FPS | Not measured; this was a load/control smoke test, not a performance benchmark |

Visual evidence: [Milestone 1 browser screenshot](validation/milestone1-smoke.png). Raw browser checks, including loaded count, SH degree, WebGL renderer, camera-state changes, console errors, and GPU samples: [browser smoke results](validation/browser-smoke-results.json).

The smoke browser exposed WebGL through ANGLE on the **Intel UHD integrated GPU**. `nvidia-smi` reported `0 MiB` used on the RTX 3050 during this headless test, so RTX 3050 rendering and its VRAM use were **not measured**. The page rendered successfully on the adapter selected by headless Chrome. A normal interactive browser may choose a different adapter; GPU selection has not been changed. System RAM peak was not measured.

To reduce interaction stalls on the full 2.05M-splat model, orbit damping is disabled. While OrbitControls reports an active interaction, Spark's `minSortIntervalMs` is temporarily set to 100 ms and the WebGL pixel ratio is capped at 1. On interaction end, the sort interval returns to 0 ms and the original pixel ratio is restored. This trades some sort-order freshness and resolution during a drag for responsiveness; the full settings resume when the pointer is released. The browser check verified the interval changed to 100 ms during drag and returned to 0 ms afterward. This is a mitigation, not an FPS guarantee; the target RTX 3050 adapter was not selected by the headless browser.

The production build emits a large-chunk advisory for the bundled Spark/Three.js code (about 3.79 MB minified, 1.25 MB gzip). Build still completes successfully. The model's 508 MB size and browser-side decode/render memory remain relevant when using a standard browser window.

## Project files

- `src/App.tsx` — viewer interface and model status.
- `src/TruckScene.tsx` — Spark renderer, PLY load, fitted camera, and load lifecycle.
- `src/styles.css` — responsive dark viewer styles.
- `vite.config.ts` — loopback-only Vite configuration and fixed-path read-only model endpoint.
- `tools/browser-smoke.mjs` — local browser verification harness; no extra test package.
- `validation/milestone1-smoke.png` — visual evidence.
- `validation/browser-smoke-results.json` — browser/runtime verification record.
- `package.json`, `package-lock.json`, and TypeScript/Vite configuration.
- `dist/` — successful production build output.

The baseline PLY, Graphdeco repository, dataset, and experiment outputs were not edited. Current SHA-256 observed for the source PLY: `63ECBDAD529856B467BB130DF1F919E1AE6D98CBCE4B23875EA4835BB3AB11FC`.

## Commands used

```powershell
Set-Location D:\3DGS-Research\web-viewer
npm install --no-audit --no-fund
npm run build --script-shell="C:\Windows\System32\cmd.exe"
npm run dev --script-shell="C:\Windows\System32\cmd.exe"
node tools/browser-smoke.mjs
```

The explicit `--script-shell` override is needed in this PowerShell environment because its inherited `COMSPEC` points to `D:\Miniconda\Scripts`, which is a directory rather than a command interpreter. This is an environment setting; it was not changed. The browser harness uses the installed Chrome headless with local-only page access, checks the loaded model and WebGL adapter, exercises camera controls, records browser console errors and `nvidia-smi` samples, and writes its artifacts under `validation/`.

## Limitations and next step

This milestone establishes that the original Graphdeco PLY can render through Spark.js in the selected React Three Fiber stack. SH representation is confirmed, but visual or numerical parity against the Graphdeco CUDA renderer has not been evaluated. The headless run used Intel UHD rather than the RTX 3050, and no FPS or peak system-RAM result is claimed.

**Next step:** open `http://127.0.0.1:5173/` in a normal browser window and inspect interaction and GPU selection on the intended desktop. After reviewing this milestone, a separate next milestone can design how validated Gaussian ID rankings map into Spark data without changing the original PLY.

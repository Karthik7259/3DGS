# Web Gaussian Renderer Technical Audit

**Project:** Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting  
**Audit date:** 2026-11-21  
**Scope:** Read-only review of renderer documentation/source and the existing Graphdeco assets. No packages were installed, no data/model was downloaded, and no research assets or source code were modified.

## 1. Executive summary

**Recommendation: use Spark.js (`@sparkjsdev/spark`) with React Three Fiber for the first web-viewer milestone.** It is an active Three.js Gaussian splat renderer, has an official R3F integration example using Vite, supports the original Graphdeco/INRIA Gaussian PLY family, and exposes packed splat data structures suitable for constructing a selected subset without changing its rendering core.

The baseline PLY is the standard Graphdeco form (2,050,123 vertices; XYZ, degree-3 SH, opacity logits, log scales, and rotation quaternion). Spark's loader documents original Gaussian PLY support and supports SH levels through degree 3. It can load the baseline directly; a separate PLY-to-renderer format conversion is not inherently required. Spark decodes the PLY into an internal packed representation, however, and its default packed encoding is quantized. Use its higher-precision `ExtSplats` option for the first fidelity comparison, and separately quantify any remaining color/SH/opacity/scale encoding differences before using browser renders as research measurements.

**Subset switching is feasible without modifying Spark's renderer, but the helper API has a research-critical caveat.** `PackedSplats.extractSplats(indices, ...)` is public, but its current implementation calls `getSplat()` and `pushSplat()` for each ID. Those methods copy only center, scale, quaternion, opacity, and DC RGB; they do not copy SH1/SH2/SH3 extras. Calling it directly would discard higher-order view-dependent appearance. The documented `PackedSplats` constructor accepts `packedArray`, `numSplats`, and extra SH arrays (`sh1`, `sh2`, `sh3`). A small application-side subset builder can gather the packed row and every SH-extra row by the same original ID into new arrays, then make a new `SplatMesh` from that subset. It should retain an explicit source-ID map. This uses public data-container interfaces and does not alter the rendering core, but it is more than a one-line API call and requires careful compatibility tests against the full degree-3 PLY.

Spark's internal quality/LOD `splatBudget` is **not** equivalent to the project's exact score-ranked fixed Top-K budget. For the research selector, create a subset from the validated ID ranking and pass exactly `floor(pN)` rows. Avoid enabling Spark's automatic LOD for quality comparisons unless separately labeled as an engine-selected detail budget.

The 2M-Gaussian scene is a plausible target for the RTX 3050 Laptop GPU, but no local benchmark exists and none is claimed here. Spark advertises a device-dependent default LOD budget around 500K–2.5M in its 2.0 overview; that is not a guarantee that a full 2,050,123 degree-3 PLY will sustain a particular FPS on this laptop. Begin at reduced budgets and 100% render scale, monitor browser/GPU memory, and measure the full-resolution case. The workspace currently reports 0 bytes free on D:, so application setup/build and any generated assets must wait until storage is available.

## 2. Candidates and comparison

| Renderer | React compatibility | Graphdeco PLY support | Dynamic subset support | Camera controls | GPU requirements | Complexity |
|---|---|---|---|---|---|---|
| **Spark.js** (`@sparkjsdev/spark`) | Direct Three.js; official `spark-react-r3f` example with Vite, JSX wrappers, and `CameraControls` | **Yes**, documents original Gaussian PLY and SPH data. Direct load, internal decode/quantization. | **Application-side exact subset is feasible** using packed row + all SH-extra arrays; `extractSplats()` alone loses SH1–3. Replace the active `SplatMesh` or its source data. Automatic LOD budget is not research Top-K. | Three.js perspective camera; R3F/Drei controls or Spark controls. Orbit/zoom/pan readily supported. | WebGL2 browser and GPU acceleration. Spark advertises broad WebGL2 coverage; 2M feasibility on this GPU remains unmeasured. WebGPU support should not be assumed for this integration. | Medium: setup simple; correctness-preserving degree-3 subset adapter and camera-conditioned scoring require custom application logic. |
| **GaussianSplats3D** (`@mkkellogg/gaussian-splats-3d`) | Three.js viewer and `DropInViewer`; R3F can host a Three object, but no official R3F-specific wrapper found in audited docs. | **Yes** for INRIA PLY, but documented SH rendering only degree 1 or 2. Our trained model is degree 3; it cannot preserve all trained view-dependent SH. | Public scene-loading API accepts PLY/KSPLAT/SPLAT; can load scenes, but no documented direct Gaussian-ID subset API. Could preprocess and reload subset PLY. Its custom `KSPLAT` converter has an SH degree option. | Built-in orbit (left-drag), pan (right-drag), zoom; Three camera can be supplied. | WebGL/Three.js; its README lists count limits by SH degree, but no RTX 3050-specific benchmark. CPU sorting is a known bottleneck/visual artifact risk during fast motion. | Low-to-medium for basic viewer; poor fit for full degree-3 model and active maintenance. |
| **PlayCanvas Engine / `@playcanvas/react`** | React wrapper exists, but it is not React Three Fiber and does not use Three.js. | Current engine documentation/source includes Gaussian-splat PLY loading; test the exact Graphdeco PLY in a prototype before treating it as a validated data path. | Dynamic GSplat assets/components and runtime budget/LOD exist. The engine's splat budget is LOD selection, not our opacity/sensitivity/hybrid Top-K. Exact IDs need custom data/resource subset construction or loading regenerated subset assets. | Engine camera/input systems support interactive camera navigation. | Engine describes WebGL2 and WebGPU backends; capability/browser dependent. No local laptop benchmark. | Medium-to-high if retaining React/TS but switching away from Three/R3F; high for research-ranked exact subset semantics. |
| **antimatter15 WebGL viewer** | Vanilla JavaScript; not Three.js/R3F. | Can accept Graphdeco PLY by converting it in-browser to `.splat`. The target `.splat` representation omits SH, so appearance is not degree-3 equivalent. | No documented React/API contract for exact ID-based replacement; would need custom fork or reloading converted files. | Browser viewer supports interactive navigation. | WebGL 1.0 implementation; no documented RTX-specific requirement. | Low for casual viewing, high/poor fit for preserving research attributes and integrating selection. |

## 3. Evidence and verified renderer behavior

### Spark.js

- Official repository describes a Three.js renderer and lists `.PLY`, `.SPZ`, `.SPLAT`, `.KSPLAT`, and `.SOG` formats. It targets WebGL2 and supports dynamic splat edits: [Spark repository](https://github.com/sparkjsdev/spark).
- Its loader documentation explicitly lists original “gsplat” PLY and `SplatMesh({url: ...})` / `PackedSplats({url: ...})` examples: [Spark loading documentation](https://github.com/sparkjsdev/spark/blob/main/docs/docs/loading-splats.md).
- Official `spark-react-r3f` example uses React Three Fiber, a `SparkRenderer`, a `SplatMesh`, `CameraControls`, and JSX `extend`; it is a Vite project: [spark-react-r3f](https://github.com/sparkjsdev/spark-react-r3f).
- `PackedSplats` documents its core packed buffer and separate `extra` SH arrays, accepts `packedArray`, `numSplats`, and `extra`, and marks `needsUpdate` when data changes: [PackedSplats source](https://github.com/sparkjsdev/spark/blob/main/src/PackedSplats.ts).
- The source implementation of `extractSplats()` loops over IDs, calls `getSplat()`, then calls `pushSplat()` with center, scales, quaternion, opacity, and color. The `getSplat` return type has no SH fields; the helper does not gather `.extra.sh1`, `.extra.sh2`, or `.extra.sh3`. This behavior is visible in the official [PackedSplats source](https://github.com/sparkjsdev/spark/blob/main/src/PackedSplats.ts) and matters for this degree-3 model.
- `SplatMesh` accepts a `PackedSplats` source; changes to its packed data can be flagged for texture upload. Its documentation warns this causes CPU-to-GPU upload and should be used sparingly for smaller counts, making whole-subset buffer replacement an operation to profile rather than assume is instantaneous: [SplatMesh source](https://github.com/sparkjsdev/spark/blob/main/src/SplatMesh.ts).
- Spark 2.x introduces on-demand LoD and target splat-count behavior for device-scale rendering. These are renderer detail/LOD choices, not a substitute for the project's saved Top-K ID vectors: [Spark 2.0 features](https://github.com/sparkjsdev/spark/blob/main/docs/docs/new-features-2.0.md).
- The audited repository's package manifest declares a Three.js peer dependency of `>=0.180.0`; the repository README and package version snapshots may not be perfectly synchronized. Pin and validate a released Spark version and compatible Three version when implementation begins: [Spark package manifest](https://github.com/sparkjsdev/spark/blob/main/package.json).

### Other candidates

- GaussianSplats3D directly accepts INRIA PLY and has a `DropInViewer` Three integration. Its documented renderer supports SH degree 0, 1, or 2, not degree 3; the README also notes CPU sorting, fast-motion artifacts, large-scene issues, and that the project is no longer actively developed: [GaussianSplats3D README](https://github.com/mkkellogg/GaussianSplats3D).
- PlayCanvas Engine has a GSplat component and React integration, but the React binding is an engine-specific path rather than R3F/Three. Its official [engine repository](https://github.com/playcanvas/engine) and [developer documentation](https://developer.playcanvas.com/user-manual/engine/gsplat/) should be consulted if a non-Three alternative is considered. Its LOD splat budget does not implement custom score-ranked selection.
- The antimatter15 viewer documents drag/drop Graphdeco PLY conversion to `.splat`, explicitly noting it omits view-dependent spherical harmonics to save bytes: [antimatter15/splat](https://github.com/antimatter15/splat).
- Three.js `WebGLRenderer` uses WebGL2 (WebGL1 is unsupported since r163): [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer). Three.js `WebGPURenderer` can use WebGPU or fall back to WebGL2, but that does not establish Spark's compatibility with that renderer: [Three.js WebGPU manual](https://threejs.org/manual/pages/webgpurenderer).

## 4. Graphdeco PLY compatibility

### Model format

Local Graphdeco `scene/gaussian_model.py::construct_list_of_attributes`, `save_ply`, and `load_ply` confirm the serialized vertex schema. With SH degree 3, each vertex carries:

- XYZ (`x`, `y`, `z`) and placeholder normals;
- DC coefficients `f_dc_0..2` and 45 remaining SH coefficients `f_rest_0..44` (three color channels × 15 non-DC basis coefficients);
- raw opacity logit (`opacity`), raw log-scales (`scale_0..2`), and raw quaternion (`rot_0..3`).

The baseline PLY has 2,050,123 vertices and is approximately 508 MB on disk. The Python loader applies sigmoid to opacity, exponential to scale, and normalizes quaternion in the renderer/model path. A web PLY parser must apply equivalent activations and preserve the SH coefficient ordering and basis convention.

### Can Spark load it directly?

Spark's official loading docs support the original Gaussian PLY convention; the local model uses Graphdeco's expected property names and ordering. Thus the expected route is to serve or open the PLY and let Spark's PLY parser decode it. No `.splat` conversion is appropriate because that format does not preserve our degree-3 view-dependent SH. Spark may internally quantize values when using `PackedSplats`; the `ExtSplats` option provides a higher-precision path. Validate rendered outputs at matched cameras against the Graphdeco Python renderer before drawing quality conclusions.

No install or runtime test was performed in this audit, so “compatible” here means the public format/schema support is documented and matches local PLY fields; end-to-end visual parity remains a required implementation check.

## 5. Exact dynamic subset mechanism

### Required semantics

For original count `N=2,050,123`, compute the same integer budget as the experiments, `K=floor(pN)`:

| Budget | K |
|---:|---:|
| 5% | 102,506 |
| 10% | 205,012 |
| 25% | 512,530 |
| 50% | 1,025,061 |
| 75% | 1,537,592 |
| 100% | 2,050,123 |

The UI selection step should return original row IDs from the validated ranking artifacts. Every packed Gaussian field and each SH-level array must be gathered using those same IDs. Track `subsetIndex -> originalGaussianId` explicitly. For 100%, preserve source row order and the original full model.

### Application-side gathering with Spark

1. Load the original Graphdeco PLY once into a Spark data source that retains degree-3 SH (prefer the higher-precision encoding for fidelity tests).
2. Produce a deterministic `Uint32Array` of selected original IDs from the existing ranking files or the validated view-dependent score/ranking method.
3. Allocate a destination packed buffer sized to K. Copy the four `uint32` words for each source Gaussian in the core packed array. For every SH extra level present, gather all words for the same source IDs according to that level's per-splat word stride. Keep the selected original IDs as a sidecar mapping.
4. Construct a new `PackedSplats` using the destination `packedArray`, `numSplats: K`, and gathered `extra` arrays (or the equivalent `ExtSplats` data contract). Signal data update per Spark's API and create/replace the active `SplatMesh`. Dispose the old active mesh after the new one is ready.
5. Verify the selected count, IDs, SH degree/array lengths, activated parameters and image fidelity before allowing UI switching.

**Do not use `PackedSplats.extractSplats()` unmodified for this model.** Its public implementation omits SH extras. Also do not simply set unselected alpha to zero and claim computational pruning: this retains the full splat set and does not demonstrate that only K selected Gaussians enter the active renderer path. Spark's automatic LOD can cap visible detail but chooses its own view/LOD subset rather than the research ranking.

Runtime switching is therefore technically possible without editing the rasterization core, but it entails allocating/gathering K rows and uploading the new packed textures. The old/new subset may coexist briefly during replacement, so peak memory can be higher than the steady-state selection. Prebuild static/global subsets in a Worker or cache only currently used subsets; do not keep copies of all 2M-vertex variants resident. For hybrid scores, do not claim exact live-camera selection while using only precomputed rankings for a finite set of training/test cameras.

## 6. React, TypeScript, Vite and camera integration

The official Spark R3F sample establishes that the stack is compatible in principle. Conceptually:

```tsx
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { useEffect, useMemo } from 'react';

function TruckSplats() {
  const { gl } = useThree();
  const spark = useMemo(() => new SparkRenderer({ renderer: gl }), [gl]);
  const splats = useMemo(
    () => new SplatMesh({ url: '/models/truck.ply', extSplats: true }),
    []
  );
  useEffect(() => () => splats.dispose(), [splats]);
  return <><primitive object={spark} /><primitive object={splats} /><OrbitControls makeDefault /></>;
}

export function Viewer() {
  return <Canvas camera={{ position: [0, 0, 4], fov: 55 }}><TruckSplats /></Canvas>;
}
```

This is an integration sketch, not tested code. Confirm the current Spark release's JSX lifecycle and disposal behavior before using it. A camera-driven hybrid selector can observe the R3F/Three camera via `useThree()`/`useFrame()` and only recompute after a camera-change threshold or explicit user action. To preserve exact ranking semantics for a fixed camera, key the cache by pose matrix, projection/FOV, viewport and scorer/model version. Worker-based ranking/gathering avoids blocking React's main thread.

The baseline PLY is outside a future Vite web root. Browsers cannot arbitrarily fetch `D:\...` paths. For a local-only prototype, serve the existing PLY read-only through Vite middleware or a local static-file route, or use an explicit file picker and a stream-capable loader. Do not silently copy multiple 508 MB PLYs into the frontend bundle. Existing `.npy` rankings are also not browser-native; a later app setup should export selected ID arrays into a documented compact binary/JSON format as new application assets, preserving the original experiment files.

### Interactive camera

Use Three.js `PerspectiveCamera` with R3F `OrbitControls`/Drei `CameraControls` for orbit, zoom, and pan. Provide focus/reset presets using the Truck scene bounds and dataset cameras. The dataset training camera transforms are suitable for snap-to-capture validation; free orbit poses are novel views and require view score recomputation. Check the scene axis convention before applying transforms: do not copy a generic OpenCV-to-OpenGL rotation from an unrelated sample without verifying against Truck training camera views.

## 7. Performance feasibility on RTX 3050 Laptop GPU (6 GB)

No measured FPS is available for this hardware/software combination. The following is a qualitative feasibility estimate, not benchmark data:

| Active Gaussian count | Feasibility estimate | Main concerns |
|---:|---|---|
| 2,050,123 | Plausible but high risk; test after 100K/500K smoke levels. | Largest SH, sorting and GPU buffers; browser and integrated-display GPU may contend; loading temporarily holds PLY bytes, decoded arrays and GPU textures. No performance guarantee. |
| 1,025,061 | Likely a reasonable target for interactive trials, still profile. | Full model may remain in CPU memory for subset rebuilding; sort and texture uploads when method changes. |
| 512,530 | Good initial quality/performance trial scale. | Selection/gathering and frame sorting still add costs; 6GB shared desktop/browser usage matters. |
| 100,000 | Low-risk functional smoke budget. | Confirms controls and subset path only; does not predict 2M behavior or research quality. |

Storage estimates from representation sizes (not VRAM measurements): the original PLY is about 508 MB. Spark's documented `PackedSplats` core encoding uses 16 bytes per Gaussian, about 32.8 MB for 2.05M before SH extras; its code stores SH1/SH2/SH3 in separate arrays. A degree-3 dataset therefore needs additional SH storage, plus intermediate decode data, texture copies, sort structures, framebuffers and browser overhead. Its `ExtSplats` mode uses a 32-byte extended base encoding, increasing that core base to about 65.6 MB plus SH and work buffers. These figures only describe stated data encodings and are not total application or GPU-memory estimates.

CPU sorting can make fast motion or view-dependent resorting costly in some libraries. Spark's hardware-dependent LOD path helps cap its own renderer work but is not equivalent to the custom Top-K ranking. RTX 3050 is a CUDA GPU, but browser rendering generally uses WebGL2/WebGPU through the browser graphics stack; ensure Chrome/Edge is hardware accelerated and assigned to the NVIDIA GPU on the laptop. The Intel i5 and 16 GB system RAM must also handle PLY parsing and selected-buffer creation.

### Browser/runtime requirements

- **Node.js/Vite:** Current Vite guide requires Node.js 20.19+ or 22.12+. npm, pnpm, or Yarn can manage packages; choose one and commit one lockfile. The official R3F sample uses Vite.
- **Three.js:** Spark's audited package manifest requires Three.js `>=0.180.0`; use one compatible Three instance, not duplicate versions. R3F, Drei and Spark must be version-aligned and pinned.
- **Browser:** Current Chromium-based Chrome/Edge is a practical first target for Windows WebGL2 and large ArrayBuffer/stream workloads. Hardware acceleration is required for useful GPU rendering. Spark's SharedArrayBuffer-based worker sorting can require cross-origin isolation headers (`COOP: same-origin`, `COEP: require-corp`) in the official docs; test Vite dev and production serving configuration. Avoid adding an isolation plugin until compatibility with local file serving is checked.
- **WebGL/WebGPU:** Three `WebGLRenderer` requires WebGL2. Spark's documented path integrates with Three.js and advertises WebGL2. PlayCanvas may provide a WebGPU backend, but Spark-on-WebGPU was not verified and should not be assumed. WebGPU is not necessary for the first milestone.
- **Additional dependencies:** `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `@sparkjsdev/spark`, TypeScript, Vite. Use worker code for ranking/gather. No Python renderer backend is required just to display the scene; a Python scoring service is optional but would compete for GPU memory if it also loads the model.
- **Windows:** Vite/Node and the browser stack are cross-platform. No CUDA toolkit is needed for the browser renderer. Actual driver/browser WebGL2 availability and hybrid-GPU routing must be checked on this laptop.
- **Disk:** Current D: drive free-space query returned 0 bytes. The app and any local generated assets need available space; no cleanup or installation was attempted.

## 8. Recommended architecture

```mermaid
flowchart LR
  UI[React + TypeScript controls\nmethod / budget / metrics] --> R3F[React Three Fiber scene]
  R3F --> CAM[Three perspective camera\nOrbit / zoom / pan]
  CAM --> SEL[Selection worker / adapter]
  PLY[Read-only Graphdeco PLY] --> LOAD[Spark PLY loader\nPackedSplats or ExtSplats]
  RANK[Validated rankings and scorer\nopacity / global sensitivity / hybrid] --> SEL
  LOAD --> DATA[Full Gaussian data + SH extras\nsource ID mapping]
  SEL --> IDS[Exact original Gaussian IDs\nK = floor(pN)]
  DATA --> SUBSET[Gather packed data + SH1/2/3\ninto active subset]
  IDS --> SUBSET
  SUBSET --> SPARK[Spark SplatMesh + SparkRenderer]
  CAM --> SPARK
  SPARK --> DISPLAY[Actual interactive Gaussian splats]
  IDS --> METRICS[Counts / selected % / timing]
  METRICS --> UI
```

The selector is separate from the renderer. Opacity and global sensitivity can use validated static rankings. Hybrid needs the current camera and the validated projected-footprint proxy, with global sensitivity normalization cached. The saved per-camera rankings cover a finite camera set; for arbitrary orbit movement either compute the proxy from the current camera in a Worker or clearly snap/cache to known cameras. Temporal selection is a sequential mode only: define an explicit ordered path/reset state; it is not inherently meaningful for independent arbitrary camera jumps.

## 9. Risks and validation gates

1. **SH loss from helper misuse:** `extractSplats()` as currently written omits SH extras. Add an application-side SH-preserving gather and test coefficient counts and rendered matched-camera views.
2. **Internal lossy encoding:** Spark `PackedSplats` quantizes values. Test `ExtSplats` and compare to original PLY/Graphdeco render; report pixel and metric gaps before interpreting selection effects.
3. **ID mapping:** internal sorting or LOD can change active indices. Preserve the subset-to-original ID map and disable renderer-generated LOD for exact fixed-budget comparisons.
4. **Runtime update stall/memory peak:** constructing and uploading a 2M-scale subset can block or temporarily duplicate buffers. Build off-main-thread where supported, update on method/budget changes, and measure peak RAM/VRAM and latency.
5. **Model access:** local paths cannot be fetched directly by browser code. Use a local read-only endpoint or user-selected file; do not copy source data into the application bundle.
6. **Hybrid live score cost:** existing per-camera view scoring is not free. Do not claim interactive live view-dependence until current-pose scoring latency and selection equivalence are measured.
7. **Renderer mismatch:** Spark and Graphdeco Python/CUDA use different renderers and may differ in SH evaluation, sorting, clipping, antialiasing, and blending. Web views are for interactive visualization until parity is characterized.
8. **Browser feature headers:** shared-memory sort workers can need cross-origin isolation. Vite and any local asset endpoint must serve compatible headers without preventing the model load.
9. **Availability/version churn:** Spark API is actively developed. Pin one release and its Three peer dependency; write a smoke test for direct Graphdeco PLY loading and SH-preserving subset replacement before adding research UI.
10. **Storage exhaustion:** D: currently reports 0 free. Resolve storage before installing packages or creating model conversions/build output.

## 10. Final recommendation and first milestone

Choose **Spark.js + React + TypeScript + Vite + React Three Fiber**. It best matches the requested stack, supports the real Gaussian PLY path and degree-3 data, has an official R3F/Vite integration example, and allows an application-side exact subset to be constructed without altering Spark's Gaussian rendering core. The key custom work is not writing a renderer; it is preserving SH arrays and ID identity through deterministic selection and runtime buffer replacement.

Recommended first milestone sequence:

1. After freeing disk and obtaining approval for normal package setup, pin Spark/Three/R3F versions.
2. Load the baseline PLY only, render degree-3 SH with interactive perspective controls, and verify matched Truck training views/scene orientation.
3. Test a 100K subset using a saved opacity ranking; confirm exact K, original-ID mapping, SH-extra lengths and visual output.
4. Test switching among all six budgets and then global sensitivity using the existing ranking artifacts. Profile update stalls and browser/GPU memory.
5. Add live hybrid selection only after porting/connecting the validated camera score and matching deterministic outputs for existing cameras.
6. Add temporal mode as a path-following/stateful demonstration with explicit reset, not as an unqualified arbitrary-camera score.

No application implementation or renderer build was started during this audit.

## Sources

- [Spark.js official repository](https://github.com/sparkjsdev/spark)
- [Spark Gaussian loading documentation](https://github.com/sparkjsdev/spark/blob/main/docs/docs/loading-splats.md)
- [Spark `PackedSplats.ts` source](https://github.com/sparkjsdev/spark/blob/main/src/PackedSplats.ts)
- [Spark `SplatMesh.ts` source](https://github.com/sparkjsdev/spark/blob/main/src/SplatMesh.ts)
- [Spark 2.0 LoD and budget overview](https://github.com/sparkjsdev/spark/blob/main/docs/docs/new-features-2.0.md)
- [Official Spark React Three Fiber + Vite example](https://github.com/sparkjsdev/spark-react-r3f)
- [Spark package manifest](https://github.com/sparkjsdev/spark/blob/main/package.json)
- [GaussianSplats3D official repository/README](https://github.com/mkkellogg/GaussianSplats3D)
- [PlayCanvas Engine](https://github.com/playcanvas/engine) and [GSplat user manual](https://developer.playcanvas.com/user-manual/engine/gsplat/)
- [antimatter15 WebGL Gaussian Splat viewer](https://github.com/antimatter15/splat)
- [Three.js WebGLRenderer documentation](https://threejs.org/docs/pages/WebGLRenderer)
- [Three.js WebGPU renderer manual](https://threejs.org/manual/pages/webgpurenderer)
- [Vite getting started requirements](https://vite.dev/guide/)
- Local source: `gaussian-splatting/scene/gaussian_model.py` (`construct_list_of_attributes`, `save_ply`, `load_ply`)


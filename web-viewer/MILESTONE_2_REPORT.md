# Milestone 2 — Interactive Technique Comparison

**Status:** implemented; production build and selection-data endpoints verified. A headless visual renderer check was blocked by Chrome GPU-process crashes, so selected-subset display still needs confirmation in the user's normal browser.

## What changed

- Added technique choices for Original Model, Opacity Top-K, Global Sensitivity Top-K, and Sensitivity + View-Dependent.
- Added 5%, 10%, 25%, 50%, 75%, and 100% budget selection.
- Added selected/total Gaussian count, retention, current technique, and budget to the side panel.
- Added a saved hybrid ranking reference-view selector. The chosen subset uses that saved camera ranking while the user orbits the free viewer camera.
- Added a **See differences** view with exactly two panels: the original 3DGS render and the currently selected technique at the chosen budget, for the same saved test camera. It pauses the interactive canvas while showing saved results.
- Added saved test-view navigation and a compact metrics badge over the selected-method panel. The badge reports the saved 32-view mean PSNR/SSIM and PSNR change from the original; it does not present a single-view metric as an aggregate.
- Switching from Original to a reduced technique now automatically chooses 10% when the budget was still 100%, so the first technique change is visible. The existing scene remains visible until the requested subset is ready.
- Capped the viewer at device pixel ratio 1 to reduce WebGL work on the RTX 3050.
- Preserved the existing orbit, zoom, pan, reset controls and interaction-time Spark sorting throttle.
- Kept the original Graphdeco model, repository, datasets, and experiment folders read-only.

## Selection data and method

The local Vite development server exposes read-only binary ID endpoints. It does not copy experiment rankings into the browser bundle.

- **Global sensitivity:** uses the saved global selection manifest at `experiments/sensitivity_topk_benchmark/results/selected_gaussian_ids.json`; each requested budget is a prefix of the saved stable ranking. The 100% choice uses the full original model.
- **Hybrid:** uses the saved camera ranking from `experiments/sensitivity_view_topk_benchmark/results/camera_rankings`. The reference selector is drawn from the 32 camera entries in the validated benchmark manifest. Changing the viewer orbit does not recompute the ranking.
- **Opacity:** scans the PLY's binary `opacity` property once per Vite server process, applies the sigmoid activation, then sorts descending with original PLY row ID as the tie break. This follows the Experiment 02 score definition. The benchmark did not preserve an opacity ID manifest, so this is reconstructed from the unchanged PLY rather than loaded from a saved selection file.
- **Original:** shows the complete model, independent of the budget control.

All counts use `floor(2,050,123 × percentage / 100)`. The API returns 32-bit original PLY row IDs. The browser gathers Spark's two packed Gaussian arrays and all four degree-3 SH arrays (`sh1`, `sh2`, `sh3a`, `sh3b`) by the same ID order. It deliberately avoids Spark's `extractSplats` helper because that helper reconstructs splats without preserving SH1–SH3.

## Verification

- `npm run build --script-shell="C:\\Windows\\System32\\cmd.exe"` passed with TypeScript compilation and Vite production build.
- Read-only API checks returned the exact expected ID byte lengths and Gaussian counts for all six budgets across opacity, sensitivity, and hybrid.
- At 5%, all three method lists contained 102,506 unique IDs, and the sampled ID ranges were within `[0, 2,050,122]`.
- The three 5% rankings had distinct leading IDs, showing that the endpoint selected different saved/ranked sets for each method.
- A Node-side Spark smoke check constructed an `ExtSplats` source and `SplatMesh` from gathered-style packed/SH arrays; the selected count and degree-3 SH data were retained.
- The comparison API returned the expected 10% hybrid record (`K=205,012`); original and hybrid image routes both returned HTTP 200.
- The 5% opacity comparison returned `K=102,506` and the saved benchmark PSNR difference for test view 15.
- No source code, checkpoint, dataset, or experiment result was changed.
- A headless Chrome smoke attempt did not reach the visual assertion stage: Chrome logged repeated `GPU process exited unexpectedly` errors and then terminated. This prevents claiming that the updated subset path has been visually confirmed in headless Chrome.

## Usage

Start the development app from PowerShell:

```powershell
cd D:\3DGS-Research\web-viewer
npm --script-shell="C:\\Windows\\System32\\cmd.exe" run dev
```

Open `http://127.0.0.1:5173/`, choose a technique and budget in the right panel, then click **See differences** for the two-panel original-versus-selected comparison. Use the test-view selector above the pair to change the same camera in both panels. Start with 5% or 10% while checking interactive responsiveness. The full source model remains resident so switching back to Original is immediate; selected modes allocate an additional subset buffer. Higher budgets therefore require more browser/GPU memory and create the subset on the UI thread.

## Limitations

- The hybrid options are cached rankings for benchmark reference cameras, not live scores for arbitrary orbit positions. The comparison panels use saved Graphdeco renders from the exact selected test camera.
- The temporal retention sequence is not included in this control set. It requires chronological path playback to preserve its prior-frame constraint and should be added as a separate sequence mode.
- The comparison badge shows existing saved 32-test-view PSNR/SSIM means and their PSNR delta; it does not calculate new metrics or claim they describe the single displayed camera image.
- Verify the selected model once in a normal interactive Chrome session; the automated headless renderer could not initialize its GPU process in this environment.

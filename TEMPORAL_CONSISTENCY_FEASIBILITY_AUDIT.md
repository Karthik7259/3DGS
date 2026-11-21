# Temporal Consistency Feasibility Audit

**Status:** Read-only feasibility analysis complete. No temporal selector was implemented, and no images were rendered.

## Findings

The 32 official test cameras follow a meaningful **sparse ordered camera path**: Graphdeco sorts all 251 registered image names and selects every eighth image for test. The filenames increase by eight each time, from `000001.jpg` to `000249.jpg`. The ordering is useful for a camera-path experiment, but these are not verified video frames: there are no frame timestamps or frame-rate metadata, and the test views are much farther apart than adjacent captures.

The no-temporal 75/25 sensitivity/view selector is already stable on the denser filename-ordered 219-camera training path. Mean consecutive selection overlap ranges from **89.94% at 5% budget to 98.15% at 50%**. This matters when designing a temporal experiment: it should show whether stability improves image quality or speed, not just increase overlap.

## Camera sequence inspection

`scene/dataset_readers.py` (`readColmapSceneInfo`, lines 145 and 181–186) reads the COLMAP image records, sorts names, and applies the LLFF holdout rule `index % 8 == 0`. `readColmapCameras` preserves each COLMAP image name and pose. The test order was checked against the camera order stored by the previous combined benchmark.

The IDs below are **COLMAP image IDs**; Graphdeco test loader indices are 0–31 in this same order.

| Test index | COLMAP image ID | Image | Test index | COLMAP image ID | Image |
|---:|---:|---|---:|---:|---|
| 0 | 1 | `000001.jpg` | 16 | 129 | `000129.jpg` |
| 1 | 9 | `000009.jpg` | 17 | 137 | `000137.jpg` |
| 2 | 17 | `000017.jpg` | 18 | 145 | `000145.jpg` |
| 3 | 25 | `000025.jpg` | 19 | 153 | `000153.jpg` |
| 4 | 33 | `000033.jpg` | 20 | 161 | `000161.jpg` |
| 5 | 41 | `000041.jpg` | 21 | 169 | `000169.jpg` |
| 6 | 49 | `000049.jpg` | 22 | 177 | `000177.jpg` |
| 7 | 57 | `000057.jpg` | 23 | 185 | `000185.jpg` |
| 8 | 65 | `000065.jpg` | 24 | 193 | `000193.jpg` |
| 9 | 73 | `000073.jpg` | 25 | 201 | `000201.jpg` |
| 10 | 81 | `000081.jpg` | 26 | 209 | `000209.jpg` |
| 11 | 89 | `000089.jpg` | 27 | 217 | `000217.jpg` |
| 12 | 97 | `000097.jpg` | 28 | 225 | `000225.jpg` |
| 13 | 105 | `000105.jpg` | 29 | 233 | `000233.jpg` |
| 14 | 113 | `000113.jpg` | 30 | 241 | `000241.jpg` |
| 15 | 121 | `000121.jpg` | 31 | 249 | `000249.jpg` |

Camera centers were calculated from the registered COLMAP world-to-camera extrinsics (`C = -Rᵀt`). Orientation change is the relative camera-to-world rotation angle. Distances use COLMAP scene units, which have arbitrary reconstruction scale.

| Ordered sequence | Adjacent pairs | Mean camera-center step | Mean orientation change | Interpretation |
|---|---:|---:|---:|---|
| Official 32-view test sequence | 31 | 2.395 units | 36.80° | Ordered but sparse; mean step is 7.1× the registered-frame adjacent mean |
| All 251 registered images, sorted by filename | 250 | 0.338 units | 5.78° | Densest available capture ordering |
| 219 training cameras, sorted by filename | 218 | 0.383 units | 6.58° | Viable deterministic path proxy; holdout removal creates occasional larger gaps |

The 32 test cameras span a 12.53-unit center-bounds diagonal; the full registered path spans 13.34 units. Thus the test views cover most of the path but sample it coarsely. The training-only ordered subset is much denser and is preferable for estimating per-step selection behavior. It remains a camera-path proxy, not timestamped video.

## No-temporal selection instability

For a consistent current research candidate, this analysis uses the weight-sweep winner at the useful intermediate budgets: `I_i(C)=0.75 S_norm_i + 0.25 V_norm_i(C)`. `S_norm` and `V_norm` use the existing average-tie percentile normalization; `V` is the existing opacity-weighted projected-footprint proxy. No temporal term is applied. The 32-test sequence uses its cached per-camera scores; the 219-training-camera sequence was scored sequentially with the existing `score_one_camera` function. Every test-camera ranking hash matched the weight-sweep ranking.

For fixed-size sets of K Gaussians:

- Overlap percent = `|S_(t-1) ∩ S_t| / K × 100`.
- Jaccard = `|S_(t-1) ∩ S_t| / |S_(t-1) ∪ S_t|`.
- Change percent = `(K - |S_(t-1) ∩ S_t|) / K × 100`.
- Entrants and exits are equal because both frames contain exactly K Gaussians.

### Official test order: sparse 31-transition baseline

| Budget | K | Mean shared | Mean overlap | Mean Jaccard | Mean change | Mean entrants | Mean exits |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 50% | 1,025,061 | 963,055 | 93.95% | 0.8864 | 6.05% | 62,006 | 62,006 |
| 25% | 512,530 | 452,300 | 88.25% | 0.7913 | 11.75% | 60,230 | 60,230 |
| 10% | 205,012 | 149,760 | 73.05% | 0.5822 | 26.95% | 55,252 | 55,252 |
| 5% | 102,506 | 69,427 | 67.73% | 0.5198 | 32.27% | 33,079 | 33,079 |

### Training-only ordered path: 218-transition baseline

| Budget | K | Mean overlap | Median overlap | Mean Jaccard | Mean change | Mean entrants | Mean exits |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 50% | 1,025,061 | 98.15% | 98.37% | 0.9639 | 1.85% | 18,926 | 18,926 |
| 25% | 512,530 | 96.38% | 96.78% | 0.9308 | 3.62% | 18,539 | 18,539 |
| 10% | 205,012 | 91.66% | 92.91% | 0.8491 | 8.34% | 17,089 | 17,089 |
| 5% | 102,506 | 89.94% | 91.35% | 0.8212 | 10.06% | 10,307 | 10,307 |

The test-set change rates are higher partly because each test transition jumps over seven registered images. They should not be read as typical adjacent-frame churn. The training-only path is a better adjacent-camera baseline. Its score-and-rank computation took 218.1 seconds total (0.934 seconds per camera) and made no renderer calls.

## Temporal regularization options

### A. Previous-selection bonus

`I'_i(t) = I_i(C_t) + λ · 1[i ∈ S_(t-1)]`

The bonus shifts incumbents upward in the ranking. It can retain a Gaussian after its current-view importance has fallen, and a fixed λ may have very different effects at different budgets or score margins. It does not guarantee a minimum overlap: enough new candidates can still displace incumbents.

### B. Switching penalty

`I'_i(t) = I_i(C_t) - λ · 1[i ∉ S_(t-1)]`

For a fixed-cardinality Top-K selection and the same λ, A and B produce **the same ranking**: B equals A minus the same constant λ for every Gaussian. They are therefore equivalent for this exact use. They are not equivalent when selection uses absolute score thresholds, variable set sizes, different entry/exit costs, or subsequent nonlinear score transforms. As with A, there is no direct overlap guarantee.

### C. Hysteresis

Use a higher score threshold to enter than the threshold required to remain selected. This creates state and can reduce rapid boundary swaps. Under an exact K budget, thresholds alone may select too many or too few Gaussians; a deterministic fill/eviction rule is required. Threshold values also depend on score normalization and budget. Excessive hysteresis can retain stale Gaussians and delay newly visible content.

### D. Minimum-overlap constraint

Require `|S_(t-1) ∩ S_t| ≥ ceil(τK)` while maximizing current-view importance among feasible K-sized sets. First form the ordinary current Top-K set. If it meets the constraint, keep it unchanged. Otherwise, choose the `ceil(τK)` highest-scoring IDs from the previous set, then fill the remaining slots with the highest-scoring IDs outside that set. This is the maximum-current-score solution under the specified overlap constraint, with deterministic Gaussian-ID tie breaking.

Unlike an arbitrary score bonus, τ states a direct upper bound on per-step turnover. The constraint activates only when the unconstrained set would violate it. It also keeps the Gaussian budget exactly fixed.

## Recommendation

Use **Method D, a minimum-overlap constraint**, for the first temporal experiment. It makes the stability/quality tradeoff explicit, preserves exact K, and avoids choosing λ in score units. Use the 219 training cameras sorted by image filename as the ordered camera path for state evolution. Keep the official 219/32 loader split unchanged: do not move cameras between training and test or replace the existing 32 test images. For held-out quality, carry the state along the ordered path and score only the official test views; selection uses camera pose/scores, never test ground-truth pixels.

Suggested constraints, derived from a maximum allowed entry/exit fraction and the measured no-temporal churn:

| Condition | τ | Maximum entrants/exits per step | Basis |
|---|---:|---:|---|
| A. No temporal consistency | 0.00 | No constraint | Existing independent per-camera Top-K baseline |
| B. Weak | 0.90 | 10% of K | Allows the observed 5% training-budget mean churn (~10.06%); should have little effect at larger budgets |
| C. Medium | 0.95 | 5% of K | Likely to engage at 10% and 5% budgets while mostly preserving 25%/50% selections |
| D. Strong | 0.98 | 2% of K | Stress condition; expected to constrain more transitions, especially at small budgets |

These are initial controlled levels, not claimed optima. They are interpretable relative to the observed baseline turnover. At 5%, a 98% minimum overlap allows only about 2,050 replacements per step versus the training-path baseline mean of about 10,307, so strong regularization risks substantial lag. At 50%, the same threshold permits about 20,501 replacements, slightly above the measured mean churn of about 18,926.

Start with **10% and 25%**: 10% has meaningful baseline turnover, while 25% is where the 75/25 blend showed the strongest quality result in the weight sweep. Add 5% as a stress test and 50% as a low-churn control. Evaluate all four conditions at each selected budget against the same no-temporal baseline.

## Metrics for the next experiment

Report per transition and aggregated by budget/τ:

- Set overlap percent, Jaccard, selection-change percent, entrants and exits.
- Churn normalized by camera-center distance and orientation change, to separate camera motion from selector instability.
- Mean PSNR/SSIM across official test views, per-view values, and absolute consecutive test-view metric differences. These differences describe quality variation, not image flicker.
- Selection-constraint activation rate and fraction of selected Gaussians retained solely to meet the constraint.
- Runtime for view scoring, temporal selection, gathering, and rendering separately.

The existing RGB render files do **not** support a reliable temporal flicker score by simple adjacent-image differencing: camera motion, disocclusion, and changing projection dominate those pixel differences. The test views are sparse, and the saved benchmark renders contain RGB images rather than the depth needed for dense geometric warping. For a later image-based flicker measure, save per-view depth from the renderer (the renderer package returns a depth image) or compute a validated dense flow, warp adjacent outputs into a common view, and mask occlusions. A more targeted measure is the temporal change of selection error: let `e_t = I_selected,t - I_full,t` for the same camera; measure the masked, depth-warped difference between `e_t` and the previous frame's warped error. This separates selection-induced temporal variation from the large legitimate image change caused by camera movement. No such image metric was computed in this audit.

## Feasibility and risks

- **No renderer/CUDA change is needed.** The existing `GaussianSubset` view gathers a consistent set of per-Gaussian attributes. A temporal selector can choose IDs immediately before constructing that subset; the renderer continues to receive the same interface.
- **Python state is sufficient.** Keep the previous selected ID array and camera sequence index in the experiment driver. Reset it at the beginning of each independent path. Use a deterministic order and ID tie-break; no random seed is needed.
- **Previous-ID storage is small.** A uint32 ID array uses about 3.91 MiB at 50%, 1.96 MiB at 25%, 0.78 MiB at 10%, and 0.39 MiB at 5%. Int64 indices double these sizes. An optional N-entry boolean membership mask adds about 1.96 MiB.
- **Compute cost is modest relative to scoring/ranking.** Bonus/penalty adds an O(N) membership operation before the existing O(N log N) rank. The overlap constraint adds an O(N) membership/partition step after the existing ranking. View scoring remains O(N) per camera and dominates total selection work; the training path took 218 seconds for 219 score-and-rank passes in this audit.
- **Lag risk:** rapid camera movement can make newly visible Gaussians important. High τ limits how quickly they enter. Stale selected Gaussians can consume a fixed budget, lowering quality.
- **Artificial stability risk:** overlap/Jaccard can improve by construction without improving images or perceived flicker. Report quality and warped image error alongside selection stability. A stable but blurry render is not a temporal-quality win.

## Source verification

Findings were checked against the current source files:

- `gaussian-splatting/scene/dataset_readers.py`: `readColmapSceneInfo` applies the sorted-name LLFF holdout; `readColmapCameras` associates image records with their poses and filenames.
- `gaussian-splatting/utils/camera_utils.py`: `cameraList_from_camInfos` creates cameras in list order; `loadCam` preserves `image_name` and calibration.
- `gaussian-splatting/scene/cameras.py`: `Camera` builds the world-view/projection transforms and derives camera center.
- `experiments/view_dependent_scoring_pilot/compute_view_dependent_scores.py`: `score_one_camera` calculates the existing per-camera footprint proxy; `average_tie_percentiles` normalizes scores.
- `experiments/sensitivity_view_topk_benchmark/benchmark_sensitivity_view_topk.py`: `camera_score_pipeline` blends/ranks, and `gather_selection` applies a selected ranking before rendering.
- `gaussian-splatting/experiments/fixed_topk/opacity_topk.py`: `GaussianSubset` gathers XYZ, opacity, scale, rotation, SH features, and covariance consistently while keeping original IDs.
- `gaussian-splatting/gaussian_renderer/__init__.py`: `render` consumes the Gaussian-like object and passes its indexed attributes to the unchanged rasterizer.

## Supporting audit artifacts and integrity

Supporting read-only analysis files are in `D:\3DGS-Research\experiments\temporal_consistency_feasibility_audit`:

- `audit_temporal_sequence.py` and `audit_results.json` — COLMAP trajectory statistics and test-sequence selection overlaps.
- `camera_sequence.csv` — all registered camera IDs, filenames, test/train marker, and camera centers.
- `consecutive_selection_overlap.csv` — each of the 31 test transitions and four budgets.
- `analyze_training_camera_selection.py`, `training_camera_sequence.csv`, `training_sequence_overlap.csv`, and `training_sequence_results.json` — sequential no-render scoring over the 219 training cameras.

Before/after hashes matched for the baseline checkpoint and PLY, global sensitivity scores, COLMAP image/camera files, scorer, renderer, dataset reader, camera class, and Gaussian model. No renderer calls were made; no checkpoint, dataset, CUDA, or original source file was changed. No package was installed, no data was downloaded, and no file was deleted.

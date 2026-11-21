# View-Dependent Gaussian Scoring Feasibility Audit

**Date:** 2026-11-21  
**Scope:** Read-only source and experiment-artifact audit. No selector, render, benchmark, training, or sensitivity computation was run for this audit.

## Executive finding

A view-dependent score can be calculated in a separate experimental module using the existing Gaussian model tensors and camera matrices, without training, changing model parameters, editing the renderer or CUDA extension, or installing/downloading anything. The strongest practical candidate is a projected screen-space footprint proxy with opacity and viewport clipping. It estimates an unoccluded projected alpha mass; it is not the rasterizer's true composited contribution.

Graphdeco's rasterizer does not expose per-Gaussian pixel contribution. It returns the rendered image, a per-Gaussian screen radius, and depth. Its `visibility_filter` is derived from `radii > 0`, so it identifies Gaussians that survived rasterizer preprocessing, not how much they affected final pixels. The existing autograd opacity gradient is available, but it measures loss sensitivity against a reference image and requires a backward pass per camera; it is not a reference-free contribution score for arbitrary interactive views.

For combining global sensitivity with a camera-specific score, use within-set percentile/rank normalization with deterministic tie handling, then blend normalized ranks. This is more robust to the highly skewed sensitivity magnitude distribution than min-max scaling.

## Source and artifact inspection

The audit inspected the checked-in Graphdeco implementation under `gaussian-splatting/` and the existing opacity subset module. Main references:

| File and function | Finding |
|---|---|
| `scene/gaussian_model.py`: `setup_functions`, `get_xyz`, `get_opacity`, `get_scaling`, `get_rotation`, `get_covariance`, `load_ply` | XYZ is world-space; opacity is sigmoid of stored logits; scales are exponentiated; quaternions are normalized; covariance is built from scale and rotation. Loaded Gaussian attributes share row/Gaussian identity. |
| `scene/cameras.py`: `Camera.__init__` | Stores FoV and image dimensions; constructs `world_view_transform`, `full_proj_transform`, and `camera_center`. Camera matrices are CUDA tensors. |
| `utils/graphics_utils.py`: `getWorld2View2`, `getProjectionMatrix`, `fov2focal`, `focal2fov` | Establishes the world/view and perspective projection conventions. The camera center is obtained by inverse-transforming the view origin. |
| `gaussian_renderer/__init__.py`: `render` | Supplies `pc.get_xyz`, activated opacity, scale/rotation or precomputed covariance, and SH/color inputs to `GaussianRasterizer`. Returns render, radii, depth, and `visibility_filter=(radii > 0)`. `viewspace_points` is a gradient placeholder, not the rasterizer's actual projected-mean output. |
| `submodules/diff-gaussian-rasterization/diff_gaussian_rasterization/__init__.py`: `GaussianRasterizer.forward`, `_RasterizeGaussians` forward/backward, `markVisible` | Python binding exposes RGB, radii and inverse depth from forward. Its backward has per-Gaussian opacity gradients. `markVisible` calls the compiled visibility test. |
| `submodules/diff-gaussian-rasterization/cuda_rasterizer/forward.cu`: `computeCov3D`, `computeCov2D`, `preprocessCUDA`, `renderCUDA` | Projects means/covariances, computes a 3-sigma screen radius and tile coverage, then composites front-to-back with alpha thresholds and early termination. Internal `n_contrib` is per-pixel state, not a per-Gaussian contribution image. |
| `submodules/diff-gaussian-rasterization/cuda_rasterizer/auxiliary.h`: `in_frustum` | The implemented center test rejects `p_view.z <= 0.2`. The lateral x/y projected-bound test is commented out. It is not a complete image-rectangle visibility test. |
| `experiments/fixed_topk/opacity_topk.py`: `GaussianSubset`, `select_by_opacity` | Existing experimental subset gathers XYZ, opacity, scale, rotation, and SH consistently by original IDs and exposes renderer-compatible model properties. The 100% path returns the original model. |

The current checkout contains the fixed-opacity subset code. Sensitivity benchmark artifacts and the stated full sensitivity vector are treated as existing read-only inputs; this audit did not load or modify their numerical contents.

## Model, camera, and projection data available

For Gaussian row `i`, the model exposes:

- World-space mean `μ_i = model.get_xyz[i]`.
- Activated opacity `α_i = model.get_opacity[i] = sigmoid(raw_opacity_i)`.
- Positive scale `s_i = model.get_scaling[i] = exp(raw_scale_i)`.
- Normalized rotation quaternion `q_i = model.get_rotation[i]`.
- SH features through `get_features`, with active degree tracked by the model.
- Covariance through `get_covariance`, which constructs a rotated anisotropic 3D covariance.

For a camera, `camera_center`, `world_view_transform`, `full_proj_transform`, FoV, width and height are available. The view transform takes world-space points to camera coordinates; the projection maps them to clip/NDC coordinates. Projection covariance requires the local perspective Jacobian, as used approximately in `computeCov2D` by the CUDA path.

The renderer's `radii > 0` result is useful as a rasterizer-produced preprocessing/tile-coverage diagnostic after a render. It is not a reusable exact per-Gaussian contribution score, and obtaining it requires invoking the renderer. `markVisible` is cheaper, but its current predicate is effectively a positive near-plane depth test; it does not cull lateral off-screen centers.

## Candidate methods

### Method A — camera distance

Define `d_i(C) = ||μ_i - C||`; possible scores include `1/(d_i+ε)` or `1/(d_i²+ε)`. This is `O(N)` with only positions and the camera center. A float32 position array is about 24.6 MB and a scalar score vector about 8.2 MB for 2,050,123 Gaussians.

Distance is a weak visual proxy. It ignores opacity, scale, anisotropy, projected position, viewport clipping, occlusion/transmittance, and SH appearance. A large, opaque Gaussian can matter from farther away than a nearby tiny or faint Gaussian. Inverse-square distance resembles projected area only under restrictive assumptions such as equal isotropic size and orientation. Distance alone is not recommended as the primary view score; it can be included as a diagnostic or tie-break feature.

### Method B — projected screen-space footprint (recommended proxy)

For each Gaussian, transform `μ_i` and its covariance into camera coordinates. Given camera-space mean `(x,y,z)` and focal lengths derived from FoV and image dimensions, project the mean and use the perspective Jacobian `J` to approximate:

`Σ₂D_i = J R_cam Σ_world_i R_camᵀ Jᵀ + 0.3 I`.

The `0.3 I` term mirrors the low-pass covariance diagonal added by `preprocessCUDA`; exact parity also needs to mirror its FOV clamp, scale modifier, optional antialiasing behavior, and coordinate conventions. For a Gaussian ellipse, the untruncated 2D integral footprint is proportional to `2π sqrt(det(Σ₂D_i))`; the CUDA rasterizer instead bounds work with a radius based on three standard deviations along the maximum eigenvalue and tile rectangles.

A defensible first proxy is:

`V_i(C) = e_i(C) · clip_i(C) · min(α_i, 0.99) · min(A_i(C), A_cap) / (W·H)`

where:

- `A_i(C) = 2π sqrt(det(Σ₂D_i))` estimates projected ellipse area in pixel².
- `e_i(C)` is one only when the Gaussian is in front of the near plane and its projected 3σ support intersects the image; otherwise zero.
- `clip_i(C) ∈ [0,1]` estimates the fraction of projected footprint inside the image. A clipped ellipse/rectangle approximation is suitable for a first study; a center-only gate is insufficient near image boundaries.
- `A_cap` limits dominance by a few very large projected splats and must be fixed/documented before benchmark runs.
- Dividing by `W·H` makes the proxy comparable across output resolutions before rank normalization.

This estimates opacity-weighted, unoccluded screen-space footprint. It ignores front-to-back occlusion, accumulated transmittance, color contrast, and the loss target. It should be described as a projected-footprint proxy, not actual contribution. A useful ablation is `opacity only`, `footprint only`, and their product to make the role of each factor visible.

### Method C — rendering contribution

The existing rasterizer internally computes per-pixel alpha, transmittance, and contributor order, but the Python API does not return per-Gaussian composited weights or RGB contribution. The returned `radii` is geometric support; internal `n_contrib[pixel]` records the last contributor position for that pixel and cannot be attributed back into a per-Gaussian accumulated contribution from the exposed outputs.

An opacity gradient from the current backward path can be computed through `torch.autograd.grad` for a chosen image loss and reference view. The prior 219-view experiment demonstrates feasibility as an offline global score, but this needs a ground-truth/reference image and one forward/backward per view. It is loss sensitivity, not a direct view-only rendering contribution, and arbitrary novel views lack a target image. Leave-one-out contribution would require many renders and is impractical at this Gaussian count.

Therefore exact rasterizer contribution is unavailable without changing the extension/API. Do not modify CUDA for the next experiment; use Method B as the view-dependent proxy and retain gradient sensitivity as the separately measured global term.

## Feasibility and resource estimate

All three proxy calculations are `O(N)` per camera. Method A is a small vector operation. Method B needs covariance transforms, projection, footprint and clipping calculations. It is feasible on the RTX 3050 as chunked tensor operations; it is not necessary to materialize all `N×3×3` covariance/Jacobian/intermediate tensors at once.

For scale reference at `N=2,050,123`, float32 storage is approximately:

| Quantity | Approximate storage |
|---|---:|
| XYZ (`N×3`) | 24.6 MB |
| Single score (`N`) | 8.2 MB / 7.82 MiB |
| Symmetric covariance (`N×6`) | 49.2 MB |
| Dense covariance (`N×3×3`) | 73.8 MB each |
| SH degree-3 feature tensor (48 coefficients × RGB) | 393.6 MB |

The model already resides on the GPU for normal rendering. A chunked projection/footprint calculation can bound temporary GPU memory to tens of MB by selecting a chunk size and avoiding repeated full feature concatenations. CPU is also possible but may be substantially slower; it does not require SH features. These are tensor-size estimates, not measured peak-memory results for a new implementation. Existing full-view sensitivity passes reported roughly 2.07 GB allocated / 2.12 GB reserved peak, but that is not a measurement of the proposed footprint scorer.

If actual render-based gradient sensitivity were recomputed per frame, the prior experiment's observed per-view runtime and memory make that unsuitable for interactive selection. The projected proxy does not depend on image pixel count except for viewport clipping, and complexity is primarily per Gaussian; the subsequent rasterization cost does depend on projected tile/pixel coverage.

## Normalizing global sensitivity and view score

The recorded full sensitivity vector is strongly right-skewed: max `0.0017722178`, mean `2.53194e-7`, median `7.15575e-8`, standard deviation `4.39114e-6`, and 2.3419% exact zeros. The prior ranking analysis also found weak association with opacity (Spearman −0.0679; raw Pearson −0.0205), so the signals are not interchangeable.

- **Min-max:** vulnerable to a few extreme values; most scores can be compressed into a narrow interval. Not recommended as the main combination scheme.
- **Log transform:** can reduce skew and preserve ordering among positive values, but requires a documented epsilon and special handling for exact zeros. Useful for distribution plots or magnitude-sensitive ablations; epsilon changes low-end spacing.
- **Robust scaling:** median/IQR or median/MAD with clipping is less outlier-sensitive, but the scales and tails can still differ between views and score types.
- **Percentile/rank normalization:** maps each signal to `[0,1]`, is insensitive to units and extreme magnitudes, and makes blend weights interpretable. Use average ranks for ties and deterministic Gaussian ID tie-breaking for the final hard selection.

Recommended initial combination for the next experiment:

`I_i(C) = λ · R_S(i) + (1−λ) · R_V(i,C)`

where `R_S` is the once-computed global sensitivity percentile and `R_V` is the current view's percentile among eligible projected candidates. Treat `λ` as an ablation parameter, not a presumed optimum. Preserve the raw scores and separately report component ranks. Exact-zero sensitivity ties and zero view scores need deterministic average-rank handling.

For fixed-budget fairness, define projected eligibility as 3σ support intersecting the image. Rank eligible Gaussians by the combined score. If there are fewer eligible candidates than the requested K, fill the remaining slots deterministically from noneligible Gaussians by global sensitivity rank (then Gaussian ID). This preserves exact K while documenting that fallback members have no predicted screen support. Alternatively, report eligible count and make a smaller budget, but that changes the benchmark budget and should not be silently done.

## Subset rendering, caching, and determinism

The existing `GaussianSubset` pattern shows that a gathered subset with consistently indexed XYZ, activated opacity, scale, rotation, and SH features can be passed to the unchanged `gaussian_renderer.render` and rasterizer. This requires no CUDA change. Selection should preserve source Gaussian IDs as metadata. At 100%, return the original model/row order for a baseline-equivalence check.

Gathering creates selected tensors while the original model remains resident on GPU, so rasterizer workload falls but full-model storage is not released. The selected model must supply all aligned attributes and active SH metadata. For view-dependent selection, compute candidate IDs and then gather only selected renderer attributes; avoid concatenating or copying the whole model unnecessarily.

Global sensitivity ranks can be cached for the fixed model. View scores/ranks can be cached for a fixed camera set using a key derived from model/checkpoint identity, exact camera transform, FoV, and output dimensions. For a moving camera, recompute per frame or when a declared pose-change threshold is crossed; the first research comparison should recompute per camera and avoid temporal state. Use stable descending sort with original Gaussian ID as tie-break so repeated identical inputs yield identical sets.

## Recommended next-experiment plan (not implemented)

1. Add a separate experimental module/script; do not edit `gaussian_renderer`, `GaussianModel`, or the CUDA extension.
2. Implement chunked computation of camera-space mean, projected mean, transformed covariance, `Σ₂D`, 3σ footprint/image intersection, and approximate clipped fraction. Match the current rasterizer's near-plane (`z > 0.2`), covariance low-pass (`0.3`), FOV clamp, scale modifier, and antialiasing option where feasible; report unavoidable approximation differences.
3. Use the candidate proxy `V_i(C)` above. Preserve raw components and eligibility. Add a stable, deterministic percentile transform and combine with the cached global sensitivity percentile.
4. Add unit-style non-rendering checks for finite scores, valid/unique IDs, stable repeatability, exact K counts, dimensions, boundary/off-screen cases, and source-model immutability. Compare predicted means/radii against the rasterizer's returned means/radii on a small diagnostic camera only when rendering is approved in a later phase.
5. Before the actual quality benchmark, test the unchanged renderer at 100% subset for pixel equivalence. Then compare opacity Top-K, global-sensitivity Top-K, projected-footprint Top-K, and blended ranks at the same budgets and same 32 held-out views. Report per-view PSNR/SSIM and synchronized rendering time; keep training/test split separate.
6. Ablate `λ` and footprint components (opacity, area, clipping/eligibility) rather than claiming superiority from correlation or rank disagreement. No selection quality claim is justified until image metrics are measured.

## Risks and limitations

- The projected covariance implementation must match Graphdeco's coordinate conventions and rasterizer approximations; small convention errors can move the projected footprint.
- The implemented CUDA `in_frustum` test only checks near-plane depth. A new Python selector should explicitly test image support; it must not treat `markVisible` as full viewport visibility.
- Large projected footprints can dominate unless clipping and area saturation are specified and ablated.
- Footprint is not composited contribution: occlusion, transmittance, SH color, and error relative to the target are not represented.
- Rank normalization discards magnitude information. It is recommended for stable blending, but a log/robust magnitude blend can be included as a separately labeled ablation.
- View-dependent selection can change from frame to frame. Temporal flicker is not addressed in this first phase; do not add temporal smoothing until the spatial scoring experiment is isolated.
- Rendering fewer selected rows may not proportionally improve end-to-end FPS because gathering/sorting and fixed overhead remain, while output quality can change sharply at small budgets.

## Conclusion

The next defensible experiment is a **global sensitivity percentile plus camera-specific, opacity-weighted projected-footprint percentile**, computed in a separate chunked module and rendered through the existing subset interface. It is deterministic, requires no target image and no backward pass per query view, and can preserve exact Gaussian budgets. It must be presented as a proxy for unoccluded screen-space footprint, not a measurement of true rasterizer contribution. Benchmark quality and speed on the held-out test views before drawing conclusions.

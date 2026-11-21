# Gaussian Selection Architecture Analysis

**Date:** 2026-11-20  
**Repository inspected:** D:\3DGS-Research\gaussian-splatting  
**Baseline:** D:\3DGS-Research\experiments\baseline_truck, iteration 30,000  
**Scope:** Read-only source and metadata analysis. No training/rendering, source/model/dataset modification, package installation, download, or model tensor reload.

## Summary

The safest initial insertion point is gaussian_renderer.render() in gaussian_renderer\__init__.py, immediately before the GaussianRasterizer call at lines 91-110. The rasterizer takes its population size P from means3D.shape[0], so an aligned compact subset is structurally supported without changing CUDA. Every per-Gaussian input must use the same selected IDs. Begin inference-only; training-time selection would require remapping the subset outputs and gradients into the original full model’s optimizer, visibility, and densification state.

The renderer exposes projected radii and a radii>0 visibility mask. These indicate geometric/projected support, not pixel contribution or perceptual importance. It does not return per-Gaussian camera-space depth or compositing contribution. Depth can be computed from XYZ and the active camera transform. Contribution or removal sensitivity requires additional measurement/instrumentation.

## 1. Complete render path

1. render.py:48-60 enters torch.no_grad(), creates GaussianModel, loads Scene at the requested iteration, creates a CUDA background, and renders selected train/test camera lists.
2. scene\__init__.py:25-38,77-81 selects iteration_<n> and loads point_cloud.ply via GaussianModel.load_ply().
3. scene\gaussian_model.py:263-315 reads PLY attributes, creates CUDA tensors, and sets active SH degree to max.
4. render.py:37-46 calls gaussian_renderer.render() for each camera and writes the rendered image.
5. scene\cameras.py:19-89 supplies width/height, FoVs, world-view and projection transforms, and camera center.
6. gaussian_renderer\__init__.py:32-52 prepares raster settings; lines 54-87 prepare means, opacity, scale/rotation or covariance, and SH or precomputed RGB.
7. gaussian_renderer\__init__.py:89-110 calls the Python GaussianRasterizer.
8. diff_gaussian_rasterization\__init__.py:174-207 checks exclusive input modes and dispatches to the custom autograd function.
9. rasterize_points.cu:58-123 sets P from means3D, allocates the P-length radii output and image buffers, then calls CUDA forward.
10. cuda_rasterizer\forward.cu:185-208,251-265 initializes radii to zero, frustum culls, projects centers, computes covariance/radius and evaluates SH when given SH coefficients. forward.cu:276-386 composites color/alpha; rasterizer_impl.cu:290-340 handles tile/depth ordering and rendering.
11. gaussian_renderer\__init__.py:117-125 returns clamped image, visibility_filter=(radii>0).nonzero(), radii, and inverse-depth image.

CUDA SH color evaluation uses point and camera positions (forward.cu:20-47,251). Python SH mode evaluates direction from point to camera center (gaussian_renderer\__init__.py:75-80).

## 2. Attributes and shapes

N=2,050,123 from the final PLY header and prior checkpoint verification. Degree 3 gives (3+1)^2=16 SH coefficients per color channel. The local PLY schema and load_ply() implementation determine these dimensions; tensors were not reloaded just to print shapes because that would allocate the large model again.

| Attribute | Baseline shape | Meaning |
|---|---:|---|
| XYZ / means3D | (N, 3) | World positions; rasterize_points.cu:58-62 validates (P,3). |
| Screen placeholder means2D | (N, 3) | CUDA grad-enabled placeholder for screen-space mean gradients (renderer lines 25-30). |
| Raw opacity | (N, 1) | PLY logits; getter applies sigmoid (gaussian_model.py:44-45,129-130). |
| Activated scale | (N, 3) | PLY log scales; getter applies exp (lines 39-40,103-104). |
| Activated rotation | (N, 4) | Quaternion normalized by getter (lines 47,107-108). |
| DC SH | (N, 1, 3) | Three color channels (loader lines 281-284,308). |
| Rest SH | (N, 15, 3) | 45 values = 3 channels times 15 non-DC coefficients (lines 286-293,309). |
| Combined SH | (N, 16, 3) | Concatenated DC/rest (lines 115-118). |
| Optional precomputed covariance | (N, 6) | Packed symmetric covariance; normally CUDA derives it from scale/rotation. |
| Projected radii | (N,) | Integer screen-space radius; zero for culled/non-rendered points. |
| Visibility indices | variable length | Indices where radii>0; not importance. |
| RGB output | (3,H,W) | Active camera dimensions. |
| Inverse-depth output | (1,H,W) | Image-space result, not per-Gaussian depth. |

Covariance is built as L @ L.T from activated scaling and rotation (gaussian_model.py:32-37,142-143). Camera-space depth is not directly returned; transform each selected point using the active view transform and repository matrix convention.

## 3. Selection insertion point

Immediately before the rasterizer call in gaussian_renderer.render(). Compute one index tensor and gather every population-aligned input:

- XYZ/means3D
- means2D placeholder (create it at selected length or index consistently)
- opacity
- SH or precomputed colors
- scales and rotations, or covariance
- dc when separate_sh=True

Camera settings/background are view-wide and are not indexed. Keep the original global IDs with the compact subset for reproducibility, temporal selection, and scattering results. Do not independently rank or sort the tensors.

The API has no original population-size parameter; it treats the rows passed as the current P. C++ obtains P=means3D.size(0), returns P radii, and loops over those rows. Thus arbitrary compact subsets are structurally accepted. This is source inspection, not a runtime test of a new wrapper. Ensure equal leading dimensions, expected CUDA/contiguous inputs, and consistent color/covariance mode.

### Gradient implications

PyTorch indexing keeps gradients to selected source rows; omitted rows receive no gradient for that render. The present training loop expects full-population alignment:

- train.py:112,165-171 uses viewspace gradients, visibility, and radii to update max screen radii and densification statistics.
- train.py:181-182 uses visibility and total population size for the sparse-Adam path.
- gaussian_model.py:349-365,388-407,452-472 prunes/splits parameter tensors, optimizer moments, and statistics together.

A subset renderer returns subset-sized visibility/radii; training would need scatter/remapping by global IDs and consistent optimizer/densification bookkeeping. Omitted Gaussians also cannot learn from that view. Inference-only selection avoids those risks and directly measures the quality/runtime tradeoff against the preserved baseline.

## 4. View-dependent signals

**Directly available:** radii, radii>0 indices, input position/opacity/scale/rotation/SH, and camera transforms/center.

**Not directly available per Gaussian:** camera-space depth vector, pixel coverage, accumulated alpha contribution, final composited RGB contribution, or a visual-importance value.

radii>0 only means that the rasterizer did not cull the Gaussian and assigned projected support. It does not reveal occlusion, opacity-weighted effect, or perceptual importance. The inverse-depth output is per pixel. Derive depth by transforming means; contribution needs additional instrumentation or controlled counterfactual render comparisons.

## 5. Sensitivity

The repository has opacity pruning and screen-space-gradient densification, not PUP or a general removal-sensitivity implementation.

- Opacity pruning: gaussian_model.py:452-465 checks activated opacity against min_opacity.
- Densification: gaussian_model.py:471-472 accumulates the norm of the first two screen-space placeholder gradients for visible points; train.py:165-171 calls it. This indicates locations that may need more detail; it is not the image-loss effect of deleting the Gaussian.
- max_radii2D pruning heuristics: train.py:165-166 and gaussian_model.py:460-464; size evidence, not contribution by itself.

Potential offline measures:
1. Cheap parameter proxy: opacity, scale/volume, SH magnitude, radius/depth heuristics. Label as heuristic; not equivalent to removal sensitivity.
2. Gradient proxy: aggregate loss-gradient magnitudes across representative views. Requires differentiable renders and GT images; gradients are local responses, not deletion effect, and memory/compute are material for 2.05M points on 6GB VRAM.
3. Counterfactual removal: compare full render with Gaussian/group omitted. Closest to direct removal impact, but individual tests over millions of points are impractical; batching/groups and validated approximations are needed.

For any score, record its definition, objective, views, aggregation, normalization, and cost. Store masks/scores as separate experiment artifacts; preserve the baseline.

## 6. Implementation sequence

| Stage | Inputs/location | Output and evaluation | Risks |
|---|---|---|---|
| A. Fixed Top-K | Deterministic score and global IDs; inference wrapper gathers before rasterizer. | Compact subset, unchanged CUDA. Sweep several budgets on all 32 held-out views; report PSNR/SSIM and LPIPS only if weights already cached, plus count/runtime/peak memory. | Global ranking may under-serve view-specific detail; ranking/ties affect reproducibility. |
| B. Sensitivity-guided | Stage A plus explicitly defined offline score. | Quality vs retained count, per-view/worst-view metrics, error maps and score-computation cost. | Cheap proxies are not deletion sensitivity; gradient/counterfactual methods cost more and depend on objective/views. |
| C. View-dependent | Stage B plus camera frustum/radius/depth/score; select per view before rasterizer. | Per-view compact set; test quality/runtime and selected-count distribution. | Visibility is not contribution; strict top-K may omit fine but important or occluded primitives. |
| D. Temporal consistency | Stage C plus previous-frame IDs/scores in a trajectory/controller wrapper. | Smoothed selection set; measure set churn, temporal flicker, path latency and per-frame quality. | Hysteresis may retain stale items; behavior can depend on camera path and seeking. |

Keep each stage in separate experiment outputs. Use fixed saved cameras and render settings, deterministic selection, and compare to the full 2,050,123-Gaussian result.

## 7. Baseline verification and limitations

- cfg_args records SH degree 3, the isolated training-data path, resolution=1, CPU image storage.
- Final PLY header has 2,050,123 vertices; PLY size 508,432,036 bytes.
- chkpnt30000.pth is 1,476,097,814 bytes; prior baseline audit verified iteration 30,000 and matching count.
- Shapes above are inferred from PLY schema plus the actual loader/getter code, rather than by reloading full parameter tensors. Source-level subset compatibility has not been validated by a modified wrapper.
- No new score, rendering measurement, training, or runtime test was performed.

## Source references

- gaussian-splatting\render.py:30-60,62-77 — output layout, no-grad model load, train/test traversal.
- gaussian-splatting\scene\__init__.py:25-38,77-81 — iteration and PLY load.
- gaussian-splatting\scene\gaussian_model.py:32-47,102-143,263-315 — activations, tensor getters, covariance, PLY mapping.
- gaussian-splatting\scene\cameras.py:19-89 — camera dimensions, FoV and transforms.
- gaussian-splatting\gaussian_renderer\__init__.py:18-50,54-125 — inputs, rasterizer call, outputs.
- gaussian-splatting\submodules\diff-gaussian-rasterization\diff_gaussian_rasterization\__init__.py:158-207 — Python API.
- gaussian-splatting\submodules\diff-gaussian-rasterization\rasterize_points.cu:58-123 — P and output allocation/dispatch.
- gaussian-splatting\submodules\diff-gaussian-rasterization\cuda_rasterizer\forward.cu:20-47,185-265,276-386 — SH, culling, projection, covariance, radius and compositing.
- gaussian-splatting\submodules\diff-gaussian-rasterization\cuda_rasterizer\rasterizer_impl.cu:290-340 — tile/depth ordering.
- gaussian-splatting\train.py:112,142,165-182 — training gradients, visibility and densification assumptions.
- gaussian-splatting\scene\gaussian_model.py:349-472 — pruning/densification alignment.
- gaussian-splatting\submodules\diff-gaussian-rasterization\cuda_rasterizer\backward.cu:130-145,420-448 — per-point backward behavior.

## Conclusion

Compact, aligned Gaussian gathering immediately before the stock rasterizer is structurally feasible. Begin with deterministic inference-only selection and retain global IDs. Use radii/visibility as geometric candidate signals only; they are not contribution or sensitivity measures. A later implementation should live in an isolated experiment wrapper/branch and be tested against all held-out baseline renders.

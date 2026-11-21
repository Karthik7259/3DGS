# Gradient Sensitivity Feasibility Audit

**Date:** 2026-11-20  
**Baseline:** Truck, iteration 30,000; 2,050,123 Gaussians; RTX 3050 Laptop GPU with 6 GB VRAM; 16 GB system RAM  
**Scope:** Read-only source and resource feasibility analysis. No gradient score was computed. No render, training, source/model/dataset change, installation, or download was performed.

## Executive findings

The existing Graphdeco path supports gradients from rendered RGB loss to each Gaussian’s opacity input. GaussianModel stores raw opacity logits in an (N,1) parameter; get_opacity applies sigmoid. The custom rasterizer backward returns a per-point opacity-gradient tensor of shape (N,1).

The proposed score uses the derivative with respect to activated opacity alpha. The ordinary model parameter gradient is instead with respect to the raw logit z:

    dL/dz_i = dL/dalpha_i * alpha_i * (1 - alpha_i)

These are not interchangeable. For the stated formula, the safest isolated implementation is to pass a detached, leaf activated-opacity tensor into the existing renderer through a lightweight GaussianModel-like proxy, then request torch.autograd.grad(loss, alpha_leaf). This requires no CUDA changes and avoids putting gradients in the model parameter .grad fields. Use no optimizer, optimizer step, densification, or checkpoint save.

One camera at a time is the appropriate memory strategy. The existing backward allocates sizeable per-Gaussian gradient tensors, but a source-based lower-bound estimate plus the measured forward memory suggests a single-view pilot is plausible on 6 GB. Actual peak backward memory remains unmeasured and must be tested before processing a camera set.

## 1. GaussianModel opacity representation

Source: D:\3DGS-Research\gaussian-splatting\scene\gaussian_model.py

- setup_functions(), lines 32-47, assigns opacity_activation = torch.sigmoid and inverse_opacity_activation = inverse_sigmoid.
- The get_opacity property, lines 128-130, returns sigmoid(self._opacity).
- load_ply(), lines 263-315, reads one PLY opacity value for each of N=2,050,123 Gaussians and creates self._opacity as a CUDA nn.Parameter with shape (N,1), lines 279 and 310.
- The parameter values in the PLY are raw opacity logits. The activated rasterizer input is alpha = sigmoid(z), also shape (N,1).
- The model class is a plain Python class rather than a torch.nn.Module with train()/eval() modes. It does not contain dropout or batch-normalization state.

Individual opacity gradients are available. Standard loss.backward() produces self._opacity.grad in raw-logit coordinates, provided no optimizer step/zero_grad has cleared or changed them. For a read-only analysis, torch.autograd.grad() is safer because it returns a gradient without accumulating into parameter .grad fields.

## 2. Gradient path from image loss to Gaussian opacity

1. gaussian_renderer\__init__.py:54-56 reads means3D and obtains opacity from pc.get_opacity. For GaussianModel this is sigmoid(_opacity).
2. gaussian_renderer\__init__.py:89-110 passes opacity to GaussianRasterizer along with positions, SH, and covariance or scale/rotation.
3. diff_gaussian_rasterization\diff_gaussian_rasterization\__init__.py:21-42 invokes the custom autograd function; lines 44-90 run the C++/CUDA forward and save opacity and rasterizer buffers.
4. Its backward(), lines 92-141, calls _C.rasterize_gaussians_backward(). The returned grad_opacities is mapped to the opacities input at lines 126-135.
5. rasterize_points.cu:163-172 allocates a per-point opacity-gradient tensor with shape (P,1); lines 184-222 dispatch the backward kernel and return that tensor.
6. cuda_rasterizer\backward.cu:579-635 computes opacity-related derivatives during alpha compositing and atomically accumulates dL/dopacity for each Gaussian. Points with zero radii are skipped at lines 420-421.

The gradient returned from the CUDA extension is with respect to the opacity tensor passed to the rasterizer. When the input is alpha=sigmoid(z), PyTorch’s autograd chain rule converts it to the raw-logit gradient by multiplying by alpha(1-alpha). Gradients also exist for means, screen-space means, colors/SH, scale, rotation, and covariance; the custom backward returns these channels as well (Python lines 126-141 and C++ allocation/return at rasterize_points.cu:163-222).

The official render.py wraps rendering in torch.no_grad() at lines 48-50. A sensitivity script must call gaussian_renderer.render() directly with gradient tracking enabled. The rendering function itself is differentiable.

## 3. Proposed sensitivity calculation

Let M be the number of sampled training views. For each view v, compute a scalar reconstruction loss L_v and the gradient vector g_v = dL_v/dalpha. Then update a running score:

    S_i = (1/M) * sum_v abs(g_v[i])

Take the absolute value per view before aggregation; summing signed gradients first could cancel opposing view effects.

### Direct activated-opacity gradient

The direct way to match the proposed equation is a separate proxy exposing an independent leaf tensor:

    alpha_leaf = model.get_opacity.detach().requires_grad_(True)

The proxy returns alpha_leaf for get_opacity and detached model values for positions, scale, rotation, and SH. Pass the proxy to the unchanged render() function, calculate the loss, and use torch.autograd.grad(loss, alpha_leaf). This yields the rasterizer-loss derivative with respect to the activated-opacity values used in that render.

Without the proxy, autograd.grad(loss, model._opacity) yields dL/dz, not dL/dalpha. Dividing by alpha(1-alpha) to reconstruct the latter is numerically unstable near sigmoid saturation; it is not recommended.

### Loss choice

For the primary experiment, use the same RGB objective as training, to align the score with the model’s fitting objective:

    L_v = (1 - lambda_dssim) * L1(render_v, GT_v)
          + lambda_dssim * (1 - SSIM(render_v, GT_v))

train.py:118-126 uses this blend; the default lambda_dssim is 0.2 in arguments/__init__.py:90. train.py:121-124 uses fused_ssim from the fused-ssim submodule when importable, otherwise it uses utils.loss_utils.ssim. Both paths provide autograd support. The Truck pipeline has no reliable depth supervision in its baseline configuration, so do not add a depth term unless confirming the same term and masks are present for all score views.

A separate L1-only sensitivity score can be a controlled ablation. Do not mix loss definitions between budgets or compare rankings without labeling the loss.

### View aggregation and normalization

- Compute abs(g_v) and add it into a running accumulator for each view. Divide by M at the end.
- Current Truck images are all 979 × 546, and the loss helpers take a mean over pixels. Equal weighting per camera is therefore a reasonable primary protocol.
- Keep the raw proposed score as the primary result. Per-view normalization, such as dividing abs(g_v) by its mean or norm before accumulation, can reduce domination by high-loss views but changes the score interpretation; evaluate it as a separately named ablation.
- A candidate alternative is alpha_i * abs(dL/dalpha_i), which approximates sensitivity to a fractional opacity change. It is not the same as the stated derivative and should also be a separate ablation.

## 4. Avoiding model updates

Use a standalone analysis script and the already trained iteration PLY loaded by Graphdeco’s Scene. Do not call train.py.

Recommended safeguards:

- Use a proxy whose only gradient-enabled model input is alpha_leaf; detach XYZ, scaling, rotation, and SH values.
- Use torch.autograd.grad(loss, alpha_leaf), not loss.backward() on the model.
- Do not instantiate or call an optimizer; do not perform optimizer steps, opacity resets, pruning, densification, or saves.
- Compute one view, transfer/add abs(gradient) to the accumulator, then release the loss graph and gradient tensors before the next view.
- Do not wrap the differentiable render/loss in torch.no_grad(); that disables the required graph.
- Fixed background, fixed camera parameters, and the existing loaded model should be used. GaussianModel has no train()/eval() mode switch; “evaluation mode” here means bypassing the training loop and all update operations.
- In a later implementation, record pre/post hashes for the PLY/checkpoint and parameter version counters, and assert model tensors are unchanged.

No gradient or parameter value needs to be modified. The leaf alpha proxy is a detached copy/view of activated opacity used only for differentiation.

## 5. Memory feasibility

### Per-Gaussian gradient outputs

For SH degree 3, P=N=2,050,123 and M_SH=16. rasterize_points.cu:163-171 allocates backward outputs for means3D (3), means2D (3), colors (3), conic (4), opacity (1), covariance (6), SH (16×3=48), scaling (3), and rotation (4): 75 float values per point, plus optional inverse-depth gradients.

That is approximately:

    2,050,123 × 75 × 4 = 615,036,900 bytes ≈ 586 MiB

This is the size of those zero-initialized output tensors alone. Some outputs may be released when the autograd graph is freed, but the source allocates them during the backward call even if only opacity sensitivity is requested.

### Baseline memory reference and implication

The Experiment 02 PyTorch memory measurement reported about 1.31 GiB peak allocated for a 100% forward render, including the resident model and render buffers. Adding the approximately 0.57 GiB source-level backward output estimate gives a lower-bound planning reference near 1.9 GiB before loss/autograd intermediates, allocator overhead, CUDA context, or other processes. It is not a measured backward peak or a guaranteed total. SSIM backward, saved forward buffers, and driver/context memory add overhead.

A single-view backward pass is plausible but unverified on the 6 GB GPU. Do a one-view pilot first, record torch.cuda.max_memory_allocated/reserved and nvidia-smi, then proceed only if it fits with comfortable headroom. Accumulating one view at a time releases the render graph before the next camera; retaining graphs across views is unnecessary and risks OOM.

### CPU score storage

One float32 score per Gaussian is 2,050,123 × 4 = 8,200,492 bytes (about 7.82 MiB). A CPU accumulator and one temporary gradient vector are practical within 16 GB RAM. Keep only the running sum and current view gradient, not an M × N gradient matrix. A final score array, sorted index array, and metadata are also small compared with the 508 MB model PLY.

## 6. Runtime estimates (planning only)

Measured forward-only synchronized render-call latency in Experiment 02 was about 52 ms/view at 100%. No backward pass has been run. For planning only, assume one gradient-scoring view costs roughly 2–5× that forward latency (about 0.10–0.26 seconds per view) to account for backward and loss work.

| Sampled training views | Planning estimate |
|---:|---:|
| 10 | about 1–2.6 seconds |
| 32 | about 3.2–8.3 seconds |
| 50 | about 5–13 seconds |
| 219 | about 22–57 seconds |

These are not measured runtimes or benchmark results. They exclude model/camera loading, first-use CUDA initialization, per-view host/device transfers, and score serialization; actual cost may be higher. The estimate must be replaced by one-view and several-view pilot measurements before selecting a final score protocol.

## 7. Sampling recommendation

Use training cameras only for score construction; reserve all 32 held-out test cameras for final comparison.

Recommended protocol:

1. First run a one-camera gradient/memory pilot.
2. For a fast stability check, compute scores on a deterministic 32-view set spanning the training camera trajectory.
3. Compare 32-view scores to a 50-view set using rank correlation and Top-K overlap at each budget.
4. If scores remain stable and memory is safe, use all 219 training views as the primary score. The estimated compute cost is modest relative to a training run and removes camera-sampling randomness.
5. Visit cameras in a fixed order from Scene(..., shuffle=False). If subsampling, choose camera indices deterministically across the ordered trajectory (for example, evenly spaced indices); record exact COLMAP image names and indices. Do not sample randomly for the primary result.

The fixed subset strategy makes sensitivity ranking reproducible. A fixed-seed random subset can be a secondary sampling-variance study, not the main score.

## 8. Fair comparison design

Compare the following at the same six budgets:

1. Activated-opacity Top-K from Experiment 02.
2. Proposed raw per-view absolute activated-opacity gradient score.
3. Optional separately labeled normalized-gradient and alpha-weighted-gradient ablations.

Hold constant:

- The same trained iteration-30,000 baseline PLY/checkpoint.
- The same 32 held-out cameras and original GT PNGs.
- The same 979 × 546 output size, background, SH degree, renderer settings, and unchanged CUDA extension.
- The same exact K counts: 2,050,123; 1,537,592; 1,025,061; 512,530; 205,012; 102,506.
- The same quality helpers and per-view aggregation: PSNR and SSIM; LPIPS only if its package and model weights are already locally available.
- The same synchronized render timing protocol, separately reporting ranking/setup time, GPU-event time, synchronized render-call wall time, PNG-save time, and GPU memory.

Compute the gradient score once, save it and the sampling/loss/config metadata in a new experiment directory, and create one stable ranking to reuse across all budget experiments. Do not use test images to build the ranking. This isolates the selector change from model training and camera-dependent selection.

## 9. Recommended implementation architecture

A separate script under gaussian-splatting\experiments\gradient_sensitivity should:

1. Load the baseline model and training camera list in fixed order.
2. Freeze/detach non-opacity inputs using a GaussianModel-like proxy; expose one detached activated opacity leaf to render().
3. For each selected training camera, call the regular differentiable renderer and the same training RGB loss.
4. Call torch.autograd.grad(loss, alpha_leaf); accumulate abs gradient per Gaussian into a CPU float32 score vector and release the graph.
5. Save scores, stable ranked original IDs, exact sampled camera names/order, loss weights, software versions, and hashes under a new isolated experiment directory.
6. Reuse that ranking for all six retained budgets and evaluate only after the score is frozen.
7. Include an integrity check proving model parameters and checkpoint/PLY files did not change.

The script must bypass render.py’s torch.no_grad() wrapper, but does not need to edit render.py or the CUDA rasterizer.

## 10. Risks and limitations

- The gradient is local to the current model and chosen loss. It is not the exact counterfactual error from deleting a Gaussian and is not automatically equivalent to PUP sensitivity.
- Absolute gradients reduce sign cancellation but may favor residual-rich regions or training-camera coverage.
- Activated-opacity and raw-logit gradients can rank saturated Gaussians differently.
- Visibility enters implicitly through rasterizer backward: points with radius zero are skipped. This does not make the score a view-dependent selector; aggregation still produces one global score/ranking.
- The C++ backward allocates gradients for all parameter channels, not just opacity. The 6 GB single-view peak is unknown until measured.
- Scores can vary with sampled views, loss weights, exposure, background, and image resolution. Record these inputs and evaluate ranking stability.
- Do not infer rendering quality improvements until all six budgets are evaluated on the held-out test set.

## Source files inspected

- scene\gaussian_model.py:32-47,102-143,263-315 — opacity activation, getters, PLY-to-tensor loading.
- gaussian_renderer\__init__.py:18-30,54-110,117-125 — render graph, opacity input, output tensors.
- submodules\diff-gaussian-rasterization\diff_gaussian_rasterization\__init__.py:21-42,44-141,174-207 — custom autograd interface and gradient return mapping.
- submodules\diff-gaussian-rasterization\rasterize_points.cu:129-223 — backward gradient tensor allocation and return.
- submodules\diff-gaussian-rasterization\cuda_rasterizer\backward.cu:163-164,579-635 — visibility skip and alpha/opacity derivative accumulation.
- train.py:118-142,176-185 — training loss, backward, and optimizer updates; these updates are not part of the proposed sensitivity pass.
- submodules\fused-ssim\fused_ssim\__init__.py:8-39 — fused SSIM custom autograd forward/backward used when available.
- utils\loss_utils.py:40-41,56-75 — L1 and fallback SSIM helpers.
- arguments\__init__.py:85-100 — default lambda_dssim=0.2.
- scene\cameras.py:56-58,86-89 — GT image storage and camera transforms.
- render.py:48-60 — official inference wrapper uses torch.no_grad(); do not call it for gradient scoring.

## Conclusion

The requested activated-opacity gradient is accessible without changing Graphdeco or CUDA code by using a detached leaf opacity proxy with the existing differentiable render path. Incremental one-view-at-a-time scoring and CPU accumulation are practical in principle, but the 6 GB backward peak has not been measured. First perform a controlled one-view memory/gradient pilot; if it passes, compute a deterministic all-219-training-view score and compare it against opacity Top-K on the same six budgets and 32 held-out views.

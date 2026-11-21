# Fixed Top-K Selector Analysis

**Date:** 2026-11-20  
**Experiment reviewed:** Experiment 01 selector and Experiment 02 benchmark  
**Scope:** Read-only implementation analysis and next-experiment proposal. No source code, model, dataset, benchmark output, or renderer was modified; no rendering, training, or package operation was performed.

## Summary

Experiment 01 ranks each Gaussian by its activated opacity:

    score_i = sigmoid(raw_opacity_i)

For budgets below 100%, it performs a stable descending sort and keeps the first K IDs, where K = floor(N × percentage / 100). This is a single global ranking: it does not depend on a camera, visibility, projected size, image contribution, or random sampling. Experiment 02 computed the ranking once and reused it for every camera and budget evaluation pass. The selected set is static across views and has no temporal state.

This is intentionally a simple baseline heuristic. Opacity does not measure a Gaussian’s actual effect on the rendered image, which explains why the quality loss becomes large at low retained counts.

## 1. Exact ranking

The source path is:

D:\3DGS-Research\gaussian-splatting\experiments\fixed_topk\opacity_topk.py

- opacity_ranking() at lines 24-29 reads gaussians.get_opacity, flattens it, checks for finite values, then calls torch.argsort(scores, descending=True, stable=True).
- The model getter is defined in scene\gaussian_model.py:129-130; it returns sigmoid(_opacity). The raw model parameter is a logit, while the ranking score is activated opacity in (0,1).
- select_by_opacity() at lines 102-124 takes the first K IDs from the supplied ranking for budgets below 100%. K is produced by retained_count() at lines 15-21: floor(N × percentage / 100).
- At 100%, select_by_opacity() special-cases the full set: it returns arange(N) and the original model in source order, without gathering a copy.

Thus, for r < 100%, the exact selection rule is:

    ids_r = stable_argsort(sigmoid(raw_opacity), descending=True)[0 : floor(N*r/100)]

It does not rank by scale, visibility, projected radii, SH magnitude, screen-space contribution, sensitivity, Gaussian ID as a score, or random values. Original row IDs only break equal-opacity ties because the sort is stable.

## 2. Global or view-dependent

The selection function accepts a Gaussian model, a percentage, and optionally a precomputed ranking; it receives no camera or viewpoint. The score and ranking are therefore global.

In Experiment 02, benchmark_opacity_topk.py computes opacity_ranking(model) once at line 270. It then creates a subset for a budget before the camera loop at lines 295-302; that subset is passed through all 32 camera renders at line 302. Each budget uses the same selected IDs for all 32 views.

The benchmark repeats subset construction once per budget per timing repetition, but it does not recompute selection per frame. It randomizes budget execution order with a seeded Python random.Random at lines 277 and 295-297 to reduce order bias; this affects only benchmark ordering, not Gaussian selection.

If select_by_opacity() is called without a ranking argument, it computes opacity_ranking() itself at line 117. Callers should pass/reuse the ranking when comparing multiple budgets, as Experiment 02 does.

## 3. Reproducibility and state

- No random sampling or random seed is used by opacity_topk.py.
- The descending sort requests stable tie handling. Equal scores preserve source row order; the selected original IDs remain attached to the subset.
- For an unchanged model tensor, device, dtype, supported PyTorch operation, and budget, selection is deterministic. If opacity values or model ordering change, the selected set can change.
- The benchmark’s seeded random permutation selects which budget runs first; it does not alter rankings or IDs.
- No camera state, frame history, hysteresis, or temporal memory is used. The same static set is used across all views and all repeats.

## 4. Why opacity ranking loses quality at smaller budgets

Opacity is one parameter in front-to-back alpha compositing, not a direct measure of image contribution:

- A high-opacity Gaussian can be behind other primitives, cover a visually unimportant area, or matter only to some viewpoints.
- A lower-opacity Gaussian may still affect many pixels because it has a large projected footprint or lies in front of important structure.
- Small, high-frequency details may depend on many modest-opacity Gaussians.
- The ranking ignores SH color and view direction, spatial scale/rotation, camera visibility, projected coverage, occlusion, and the image error caused by removing a primitive.
- The one global set cannot allocate different Gaussian budgets to different camera views.
- Static selection avoids temporal set changes, but it cannot adapt quality to a moving camera or preserve view-specific details.

Experiment 02 supports this limitation quantitatively: 75% retained 25.2118 dB / 0.88166 SSIM, while 50% retained 23.5604 dB / 0.85672; at 25% and below the drops became much larger. These figures are from the fixed-opacity method on the same 32 held-out views and are not claims about other ranking methods.

## 5. Proposed next research experiment

### Training-view aggregated loss-gradient ranking

The next isolated experiment should replace opacity-only ranking with a global, training-view-informed score while keeping the same budgets and unchanged rasterizer. This tests whether image-loss information selects a better static subset before adding view-dependent selection.

Proposed score:

1. Select a fixed, documented subset of training cameras only. Do not use the 32 held-out test views when constructing scores.
2. For each camera, render the full baseline against its training image and compute the existing reconstruction loss.
3. Obtain the per-Gaussian gradient with respect to the raw opacity logit, using the differentiable renderer’s existing backward path.
4. Aggregate an absolute gradient score across the chosen training views, for example:

       score_i = mean_v(abs(d L_v / d raw_opacity_i))

5. Rank scores globally with a stable descending sort and retain the same floor-based K values: 100%, 75%, 50%, 25%, 10%, and 5%.
6. Use the selected global IDs for every camera at inference. Keep the CUDA rasterizer, test cameras, GT, output resolution, and benchmark methodology the same as Experiment 02.
7. Compare aggregate and per-view PSNR/SSIM, timing, selection overhead, memory, and visual comparisons against both the full baseline and opacity Top-K.

This is a gradient-based selection proxy, not exact leave-one-Gaussian-out sensitivity and not a PUP-equivalent score. A local gradient measures response near the current parameter value; setting a Gaussian’s opacity to zero can be a much larger change. State this clearly in any subsequent report.

### Feasibility and risks

The rasterizer backward path and training loop already use gradients, but a full-resolution backward pass with 2.05 million Gaussians may have significant memory cost on the 6 GB RTX 3050. First run a small pilot on a few training cameras, without optimizer steps, to measure memory and confirm gradients are finite. Aggregate one camera at a time so computation graphs can be released. If the pilot exceeds available memory, reduce the number of score cameras or use a carefully documented lower-resolution score pass; keep final test evaluation at the established native resolution.

Training-view gradient magnitude may overfit the sampled training viewpoints and favor their visible regions. Use a fixed camera sample and report the score-view protocol. Keep the test set held out until final evaluation. Gradient scale also depends on the loss definition and parameterization, so report the exact loss and aggregation.

This experiment remains global: every test view receives the same selected IDs. View-conditioned ranking and temporal consistency should remain separate later experiments so their effects are not mixed into this comparison.

## 6. Source references

- experiments\fixed_topk\opacity_topk.py:15-29 — budget floor rule and activated-opacity stable ranking.
- experiments\fixed_topk\opacity_topk.py:39-98 — consistently indexed Gaussian subset and retained original IDs.
- experiments\fixed_topk\opacity_topk.py:102-124 — Top-K selection and 100% identity path.
- scene\gaussian_model.py:44-45,129-130 — sigmoid activation for opacity.
- experiments\fixed_topk\benchmark_opacity_topk.py:270-302 — ranking reuse, warm-up, budget ordering, and subset reuse across cameras.
- gaussian_renderer\__init__.py:89-125 — rasterizer invocation and returned radii/visibility; visibility is an output signal, not this selector’s score.
- train.py:142,165-171 — existing backward and screen-space densification statistics, which are not used by Experiment 01 selection.

## Conclusion

The current selector is deterministic, stable global Top-K by activated opacity. It does not use camera, visibility, image contribution, sensitivity, randomness, or temporal state. The next clean experiment is a static, training-view aggregated loss-gradient ranking at the same six budgets, with a 6 GB memory pilot and the test cameras reserved for evaluation. No implementation should be added until that experiment is approved.

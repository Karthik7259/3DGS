# Experiment 01: Fixed Opacity-Based Top-K Implementation

**Date:** 2026-11-20  
**Baseline:** D:\3DGS-Research\experiments\baseline_truck, iteration 30,000  
**Validation scope:** All-budget structural checks plus one test-view render at full and 5% counts. No test-set benchmark or metric evaluation was run.

## Outcome

Implemented an isolated, optional opacity Top-K selector. The official render.py and gaussian_renderer\__init__.py files are unchanged. The selector is not enabled by default and does not modify the trained model or rasterizer. All six retention budgets passed their count, bounds, uniqueness, and aligned-tensor checks. The original renderer worked with selection bypassed, and the unchanged rasterizer accepted a 5% subset for one unsaved test view.

## Files created

- gaussian-splatting\experiments\fixed_topk\opacity_topk.py — reusable ranking/count/subset implementation.
- gaussian-splatting\experiments\fixed_topk\validate_opacity_topk.py — model integrity, budget, tensor shape, and optional single-view smoke validation.
- gaussian-splatting\experiments\fixed_topk\__pycache__\ — Python 3.11 bytecode cache produced by syntax/import validation.

Updated D:\3DGS-Research\INSTALLATION_LOG.md.

No Graphdeco source files, CUDA extension files, dataset files, baseline checkpoint/PLY, or existing render outputs were modified. A git status check before implementation showed existing modifications in submodules/diff-gaussian-rasterization, submodules/fused-ssim, and submodules/simple-knn; those pre-existing working-tree changes were left untouched.

## Selection definition

For each Gaussian, the score is its activated opacity:

    score_i = sigmoid(raw_opacity_i)

Scores are ranked descending. The sort is stable, so ties retain ascending original row order. Original Gaussian IDs are the source row indices and are stored in the selection object. The selector does not use radii/visibility as a score.

Budget count uses floor(N * percentage / 100), ensuring a budget never exceeds its nominal percentage. At 100%, IDs remain in original order and the original model object is passed through without copying its parameter tensors.

## Exact counts

Original count N = 2,050,123.

| Retained | K (floor rule) |
|---:|---:|
| 100% | 2,050,123 |
| 75% | 1,537,592 |
| 50% | 1,025,061 |
| 25% | 512,530 |
| 10% | 205,012 |
| 5% | 102,506 |

## Implementation details

opacity_topk.py provides:

- retained_count() with supported-budget validation.
- opacity_ranking() using activated opacity and stable descending torch.argsort.
- select_by_opacity() returning selected original_ids plus a renderer-compatible model view.
- GaussianSubset, which gathers XYZ, activated opacity, activated scale, normalized rotation, DC SH, and rest SH using the same IDs. Combined SH is constructed from the selected DC/rest tensors only when requested. Covariance mode also uses selected scales and source rotations only.
- A special 100% fast path that returns the original model object and original row order, avoiding full-model gathering/copying.

The experimental module does not change the default render() function. The validator imports and calls Graphdeco's existing render() with either the original model or the subset view.

## Validation results

Loaded the trained model using the saved experiment configuration and Scene at iteration 30,000.

- Confirmed iteration: 30,000.
- Confirmed original count: 2,050,123.
- For all budgets, verified exact K, one-dimensional long indices, no duplicate indices, all IDs in [0, N), and matching leading dimensions.
- Verified expected tensor shapes:
  - XYZ: (K, 3)
  - Opacity: (K, 1)
  - Scaling: (K, 3)
  - Rotation: (K, 4)
  - Combined degree-3 SH: (K, 16, 3)
- Verified 100% uses IDs 0 through N-1 in original order, returns the original model object, and preserves original tensor values/storage.
- Captured original parameter object identities, storage pointers, and PyTorch version counters before selection; all remained unchanged after testing every budget.
- CUDA was available on the RTX 3050 Laptop GPU. At the preflight query it had 6,002 MiB free.
- The original, unfiltered renderer completed one test camera with selection disabled. Radii length was N and image dimensions matched the camera.
- The 5% subset (K=102,506) completed the same single test camera through the unchanged rasterizer. Radii length was K, output dimensions matched the full render, and output values were finite.
- Neither smoke render was saved to disk. No full 32-camera render, rendering benchmark, PSNR/SSIM/LPIPS evaluation, or training was run.

The selector validation is structural and rasterizer-compatible. It does not establish image quality at reduced budgets; that requires a separately approved evaluation run.

## Issues and limitations

- Budget rounding is explicitly floor-based. This is conservative when N times a percentage is fractional.
- Activated opacity is monotonic with raw opacity, but the implementation explicitly ranks the activated values to match the requested score definition.
- Stable sorting allocates a full ranking index tensor. The model remains on GPU; subset attribute gathers allocate additional tensors proportional to K. This is expected for compact rasterizer inputs.
- The full model must still be loaded before selecting, so this reduces rasterizer population, not the memory needed to store the source model.
- No selection quality, speedup, or memory reduction is claimed from a single-view smoke test.
- Python generated a local __pycache__ as part of validation; it contains only bytecode for the two new scripts.

## Exact validation command

Run from the repository directory:

    & 'D:\Miniconda\envs\3dgs\python.exe' -u 'experiments\fixed_topk\validate_opacity_topk.py' -m 'D:\3DGS-Research\experiments\baseline_truck' --verify-render

This loads the saved baseline configuration, validates all budgets and model preservation, then renders one test camera twice without saving: once with the original model and once with the 5% subset.

## Next experiment procedure

For a later subset-quality evaluation, use the original 32 test cameras and this module’s select_by_opacity(model, percentage) result as the GaussianModel-like argument to the existing render() function. Save outputs into a new experiment-specific directory, not the baseline. Report the retained K for each view, PSNR/SSIM and any locally available LPIPS, plus end-to-end rendering time. Do not interpret opacity as sensitivity or contribution.

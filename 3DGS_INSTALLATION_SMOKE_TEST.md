# 3DGS Installation Smoke Test

**Test date:** 2026-11-20  
**Project:** `D:\3DGS-Research\gaussian-splatting`  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

## Project state

The parent repository is on `main` and tracks `origin/main`.

The only parent-level changes are modifications to these submodules:

- `submodules/diff-gaussian-rasterization`
- `submodules/simple-knn`
- `submodules/fused-ssim`

No main-3DGS source file was modified.

Intentional submodule setup changes:

- diff-gaussian-rasterization: `define_macros=[("USE_CUDA", "1")]`
- simple-knn: `define_macros=[("USE_CUDA", "1")]`
- fused-ssim: `WIN32_LEAN_AND_MEAN=1` and `USE_CUDA=1`

Generated build directories and egg-info directories may exist inside submodules, but no repository source file or main training logic was changed.

All submodules remained on their recorded commits.

## Environment

The active interpreter is:

```text
D:\Miniconda\envs\3dgs\python.exe
Python 3.11.18
```

Installed core packages:

| Package | Version |
|---|---|
| PyTorch | 2.11.0+cu128 |
| TorchVision | 0.26.0+cu128 |
| NumPy | 2.4.6 |
| Pillow | 13.0.0 |
| OpenCV | 5.1.0 |
| plyfile | 1.1.5 |
| tqdm | 4.70.1 |
| joblib | 1.6.0 |

GPU state:

- NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Compute capability: `(8, 6)`
- Total memory: 6.00 GiB
- PyTorch CUDA runtime: 12.8
- CUDA available: True

`matplotlib` is not installed. It is used only by optional fused-SSIM plot/test utilities and is not imported by the core `train.py`, `render.py`, or 3DGS rendering/training modules.

`python -m pip check` reported:

```text
No broken requirements found.
```

## Extension verification

### diff-gaussian-rasterization

- Package import: PASS
- `_C` extension import: PASS
- `GaussianRasterizationSettings` import: PASS
- `GaussianRasterizer` import: PASS
- CUDA tensor operation test: PASS
- Installed module:
  `D:\Miniconda\envs\3dgs\Lib\site-packages\diff_gaussian_rasterization\_C.cp311-win_amd64.pyd`

### simple-knn

- Package import: PASS
- `_C` extension import: PASS
- `distCUDA2` CUDA call: PASS
- Result device: `cuda:0`
- Result shape: `(4,)`
- Installed module:
  `D:\Miniconda\envs\3dgs\Lib\site-packages\simple_knn\_C.cp311-win_amd64.pyd`

### fused-ssim

- `fused_ssim` import: PASS
- `fused_ssim_cuda` import: PASS
- Identical-image SSIM: `1.0`
- Forward SSIM result: finite and on `cuda:0`
- Backward pass: PASS
- Gradient finite: PASS
- Installed module:
  `D:\Miniconda\envs\3dgs\Lib\site-packages\fused_ssim_cuda.cp311-win_amd64.pyd`

## Main 3DGS module imports

The following imports passed:

- `gaussian_renderer`
- `scene`
- `scene.gaussian_model`
- `scene.cameras`
- `scene.dataset_readers`
- `arguments`
- `utils`
- `utils.loss_utils`
- `utils.general_utils`
- `utils.graphics_utils`

## Command-line interface verification

Read-only `--help` execution passed for:

- `train.py`
- `render.py`
- `metrics.py`

The scripts displayed argument groups/options without import errors. No training, rendering, or model execution was started.

## Smoke-test script

Reusable script:

`D:\3DGS-Research\test_3dgs_installation.py`

It performed:

1. Python/PyTorch version checks
2. TorchVision and core package checks
3. CUDA availability and GPU detection
4. Basic CUDA tensor multiplication
5. All three extension imports
6. `simple_knn.distCUDA2` CUDA execution
7. Fused SSIM forward and backward execution
8. Main 3DGS module imports

Smoke-test output summary:

```text
[PASS] Python/PyTorch environment
[PASS] TorchVision
[PASS] CUDA availability
[PASS] GPU detection
[PASS] Basic CUDA tensor operation
[PASS] numpy
[PASS] Pillow
[PASS] opencv-python
[PASS] plyfile
[PASS] tqdm
[PASS] joblib
[PASS] matplotlib optional package
[PASS] diff-gaussian-rasterization imports
[PASS] simple-knn CUDA operation
[PASS] fused-ssim forward/backward
[PASS] all listed main 3DGS modules
FINAL: PASS
```

## Remaining issues

- `matplotlib` is absent but optional for core 3DGS and the repository's fused-SSIM plot benchmark. It was not installed.
- The repository remains clean of main-source modifications.
- Only intentional setup.py macros exist in the three submodules.
- Generated build/egg-info directories are build artifacts and not source changes.
- No dataset or trained model is present.

## Final readiness assessment

**READY for a baseline 3DGS repository smoke test and dataset/setup stage.**

The original 3DGS Python code imports, all CUDA extensions import and execute on the RTX 3050, the CLI help entry points work, and `pip check` is clean.

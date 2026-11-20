# Repository Analysis

## Repository

- URL: https://github.com/graphdeco-inria/gaussian-splatting
- Local path: `D:\3DGS-Research\gaussian-splatting`
- Remote: `origin https://github.com/graphdeco-inria/gaussian-splatting`
- Clone status: Successfully cloned recursively
- Main branch status: `main` tracks `origin/main`; no uncommitted files were reported
- Commit: `54c035f7834b564019656c3e3fcc3646292f727d`
- Commit date: 2024-10-30
- Commit subject: `fix submodule name in environment.yml`

## Submodule status

All registered submodules are initialized and checked out at the commits recorded by the repository:

| Submodule | Recorded commit | Status |
|---|---|---|
| `SIBR_viewers` | d8856f60c5384cc1975439193bb627d77d917d77 | Initialized |
| `submodules/diff-gaussian-rasterization` | 9c5c2028f6fbee2be239bc4c9421ff894fe4fbe0 | Initialized |
| `submodules/diff-gaussian-rasterization/third_party/glm` | 5c46b9c07008ae65cb81ab79cd677ecc1934b903 | Initialized |
| `submodules/fused-ssim` | 1272e21a282342e89537159e4bad508b19b34157 | Initialized |
| `submodules/simple-knn` | 86710c2d4b46680c02301765dd79e465819c8f19 | Initialized |

The submodule status output contained no `+`, `-`, or `U` markers, indicating that the checked-out submodule commits match the parent repository.

## Repository structure

The repository root contains:

- `train.py` - optimizer/training entry point
- `render.py` - trained-model rendering entry point
- `metrics.py` - rendering metric evaluation
- `convert.py` - dataset conversion utilities
- `full_eval.py` - evaluation workflow
- `environment.yml` - Conda environment definition
- `README.md` - setup, training, rendering, and viewer documentation
- `gaussian_renderer/` - PyTorch/CUDA rasterizer integration
- `scene/` - cameras, dataset readers, and `GaussianModel`
- `arguments/` - training, pipeline, and model argument groups
- `utils/` - camera, graphics, image, loss, system, and COLMAP utilities
- `submodules/` - CUDA extension sources
- `SIBR_viewers/` - real-time visualization submodule
- `assets/` - README images
- `lpipsPyTorch/` - LPIPS utilities

There is no repository-root `requirements.txt`.

## Important files

### `train.py`

Main optimizer entry point. Imports `diff_gaussian_rasterization`, `simple_knn`, and optional `fused_ssim`. Default command:

```text
python train.py -s <path-to-COLMAP-or-NeRF-Synthetic-dataset>
```

Evaluation command:

```text
python train.py -s <path-to-dataset> --eval
```

### `render.py`

Loads a trained model and renders train/test outputs:

```text
python render.py -m <path-to-trained-model>
python render.py -m <path-to-pretrained-model> -s <path-to-source-dataset>
```

### `gaussian_renderer`

Contains `__init__.py` and network GUI support. It imports:

- `GaussianRasterizationSettings`
- `GaussianRasterizer`

from `diff_gaussian_rasterization`.

### `scene`

Contains scene loading and model implementation:

- `cameras.py`
- `colmap_loader.py`
- `dataset_readers.py`
- `gaussian_model.py`

`gaussian_model.py` imports `distCUDA2` from `simple_knn._C` and optionally imports `SparseGaussianAdam`.

### `arguments`

Contains `ModelParams`, `PipelineParams`, and `OptimizationParams` used by training and rendering.

### `utils`

Contains camera/graphics/image/loss utilities, COLMAP model readers/writers, and system helpers.

## Dependency definition

The repository defines `environment.yml` rather than `requirements.txt`. It specifies:

- Python 3.7.13
- pip 22.3.1
- Conda CUDA Toolkit 11.6
- PyTorch 1.12.1
- TorchVision 0.13.1
- TorchAudio 0.12.1
- `plyfile`
- `tqdm`
- `opencv-python`
- `joblib`
- Local CUDA extension submodules:
  - `submodules/diff-gaussian-rasterization`
  - `submodules/simple-knn`
  - `submodules/fused-ssim`

The existing `3dgs` environment has Python 3.11.18, PyTorch 2.11.0+cu128, TorchVision 0.26.0+cu128, TorchAudio 2.11.0+cu128, CUDA Toolkit 12.8.93, and CUDA 12.8 wheels. The repository's environment file is therefore a reference for package architecture, not the intended environment for this existing setup.

## CUDA extensions

### `diff-gaussian-rasterization`

The setup builds `diff_gaussian_rasterization._C` from:

- `cuda_rasterizer/rasterizer_impl.cu`
- `cuda_rasterizer/forward.cu`
- `cuda_rasterizer/backward.cu`
- `rasterize_points.cu`
- `ext.cpp`

It also includes the `third_party/glm` submodule.

### `simple-knn`

The setup builds `simple_knn._C` from:

- `spatial.cu`
- `simple_knn.cu`
- `ext.cpp`

### `fused-ssim`

The setup builds `fused_ssim_cuda` from:

- `ssim.cu`
- `ext.cpp`

These extensions have not been compiled or installed.

## Dataset, training, and rendering commands

Training:

```text
python train.py -s <path-to-COLMAP-or-NeRF-Synthetic-dataset>
python train.py -s <path-to-dataset> --eval
```

Rendering:

```text
python render.py -m <path-to-trained-model>
python render.py -m <path-to-trained-model> --skip_train
python render.py -m <path-to-trained-model> --skip_test
python render.py -m <path-to-pretrained-model> -s <path-to-source-dataset>
```

Metrics:

```text
python metrics.py -m <path-to-trained-model>
```

Dataset conversion is documented with:

```text
python convert.py -s <path-to-input-images>
```

No datasets or trained models were downloaded.

## Compatibility concerns for this Windows system

- The repository officially expected Visual Studio 2019 and CUDA 11.8 in its original environment file, but its README states limited testing with CUDA 12 and PyTorch 2.0.
- This system has Visual Studio 2022 MSVC 19.43.34810 and CUDA Toolkit 12.8.93. A minimal CUDA 12.8 compilation against this MSVC toolchain already succeeded for `sm_86`.
- PyTorch 2.11.0+cu128 reports CUDA 12.8 and GPU computation succeeds on this RTX 3050.
- The RTX 3050 has Compute Capability 8.6 and satisfies the README's Compute Capability 7.0+ requirement.
- The 6 GB VRAM is below the README's 24 GB reference-quality recommendation. Training must use lower-iteration or memory-reduction settings and may require dataset/point-count tuning.
- The repository environment pins old Python/PyTorch/CUDA versions. The existing 3dgs environment is newer, so compiling all CUDA extensions against the current PyTorch ABI and CUDA 12.8 is the key compatibility check.
- The repository includes Windows-specific extension build instructions and still assumes `cl.exe` must be initialized in the developer environment.
- The default environment setup would create or replace a Conda environment; it was not run.
- The original `environment.yml` includes Conda CUDA Toolkit 11.6 and therefore should not be used as-is with the existing CUDA 12.8 setup.

## Recommended next step

Before compiling or installing any repository dependencies, verify that the existing `3dgs` environment contains the non-extension Python dependencies used by the repository. Then compile the CUDA extensions one at a time in the Visual Studio developer environment, starting with `diff-gaussian-rasterization`, followed by `simple-knn` and `fused-ssim`. Do not replace or create Conda environments.

# Fused-SSIM Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`  
**Project:** `D:\3DGS-Research\gaussian-splatting`  
**Target:** `D:\3DGS-Research\gaussian-splatting\submodules\fused-ssim`

## Pre-build Git status

Before modification:

- Parent repository: `main` tracked `origin/main`
- Parent repository had the existing modified diff-gaussian-rasterization and simple-knn submodules
- `fused-ssim` submodule: detached HEAD
- `fused-ssim` submodule: clean; no uncommitted changes

No pre-existing user modifications were present in `fused-ssim`.

## Build configuration

`setup.py` used `CUDAExtension` with:

- Package: `fused_ssim`
- Compiled module: `fused_ssim_cuda`
- Sources: `ssim.cu`, `ext.cpp`
- Build backend: PyTorch `BuildExtension`

The extension contains:

- Python wrapper in `fused_ssim/__init__.py`
- CUDA forward/backward implementation in `ssim.cu`
- PyBind module in `ext.cpp`

No existing `USE_CUDA` or Windows SDK macro was present.

## Initial build

Exact command, run from the `fused-ssim` directory:

```text
python -m pip install --no-build-isolation .
```

Process-local environment:

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

The initial build failed in `ssim.cu` inside a PyTorch CUDA header:

```text
c10/cuda/CUDACachingAllocator.h:
invalid combination of type specifiers
StreamSegmentSize(cudaStream_t s, bool char, size_t sz)
```

The root Windows SDK conflict is `rpcndr.h` defining:

```cpp
#define small char
```

The parameter name `small` in PyTorch's `StreamSegmentSize` constructor is expanded to `char`, producing `bool char`.

## First targeted change

The minimum extension-scoped Windows macro was added:

```python
define_macros=[("WIN32_LEAN_AND_MEAN", "1")]
```

This prevented the Windows SDK `small` conflict.

The build then advanced and failed on the known PyTorch 2.11 header issue:

```text
torch/csrc/dynamo/compiled_autograd.h(1143):
error C2872: 'std': ambiguous symbol
```

## Final targeted change

Because the build showed two independent Windows/PyTorch header conflicts, `setup.py` was updated with both build-specific macros:

```python
define_macros=[
    ("WIN32_LEAN_AND_MEAN", "1"),
    ("USE_CUDA", "1")])
```

No CUDA/C++ source, PyTorch header, other submodule, or permanent environment variable was changed.

## Final build

The same command was rerun:

```text
python -m pip install --no-build-isolation .
```

Toolchain:

- Python: `D:\Miniconda\envs\3dgs\python.exe`
- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA Toolkit: 12.8.93
- MSVC: 19.43.34810
- Windows SDK: 10.0.22621.0
- GPU: NVIDIA GeForce RTX 3050 Laptop GPU
- Capability: `(8, 6)`

Result:

```text
Successfully built fused_ssim
Successfully installed fused_ssim-0.0.0
Build process exit=0
```

Wheel SHA-256:

```text
138af7126f5ba0b51a566b2b7f51490b2f0d20ed498144dcdec83f1e4c1093a5
```

## Installed extension

Package location:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\fused_ssim
```

Compiled module:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\fused_ssim_cuda.cp311-win_amd64.pyd
```

The `.pyd` size is 317,440 bytes (0.30 MB).

## Import and CUDA verification

Reusable test:

`D:\3DGS-Research\test_fused_ssim_cuda.py`

Test output:

```text
PyTorch: 2.11.0+cu128
CUDA: 12.8
GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
CUDA available: True
fused_ssim import: PASS
fused_ssim_cuda import: PASS
Identical SSIM: 1.0
SSIM result device: cuda:0
SSIM finite: True
SSIM range 0-to-1: True
Backward pass: PASS
Gradient finite: True
```

The test exited with code 0.

`python -m pip check` reported:

```text
No broken requirements found.
```

## Git state

`fused-ssim` now has:

```text
M setup.py
```

Generated build and egg-info directories exist in the submodule but were not committed.

The parent repository reports modified:

- `submodules/diff-gaussian-rasterization`
- `submodules/simple-knn`
- `submodules/fused-ssim`

No other source files were changed.

## Final assessment

`fused-ssim` is built, installed, importable, and verified on CUDA for both forward SSIM calculation and backward propagation.

Both build macros are extension-scoped and remain with `fused-ssim/setup.py` as temporary Windows/PyTorch 2.11 compatibility workarounds:

- `WIN32_LEAN_AND_MEAN=1`
- `USE_CUDA=1`

No `fused-ssim` source edits, datasets, training, rendering, or unrelated package installations were performed.

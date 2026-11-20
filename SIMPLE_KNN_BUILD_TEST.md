# Simple-KNN Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`  
**Project:** `D:\3DGS-Research\gaussian-splatting`  
**Target:** `D:\3DGS-Research\gaussian-splatting\submodules\simple-knn`

## Pre-build Git status

Before the build:

- Parent repository: `main` tracked `origin/main`
- Parent repository had only the pre-existing diff-gaussian-rasterization submodule modification
- `simple-knn` submodule: detached HEAD
- `simple-knn` submodule: clean; no uncommitted changes
- No pre-existing user modifications were present in `simple-knn`

The rasterizer submodule remained modified because of its separate `USE_CUDA` workaround.

## Pre-build setup

`setup.py` used `CUDAExtension` with:

- Name: `simple_knn._C`
- Sources: `spatial.cu`, `simple_knn.cu`, `ext.cpp`
- Windows C++ flag: `/wd4624`
- No existing `USE_CUDA` macro

Because this extension includes `torch/extension.h` and is a CUDA extension, the PyTorch 2.11 Windows C2872 header ambiguity could occur. It was not added automatically before the first build.

## First build attempt

The exact command was run from the `simple-knn` directory:

```text
python -m pip install --no-build-isolation .
```

Process-local environment:

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

The build compiled:

- `ext.cpp`
- `simple_knn.cu`
- `spatial.cu`

It then failed in `spatial.cu` with:

```text
torch/csrc/dynamo/compiled_autograd.h(1143): error C2872: 'std': ambiguous symbol
```

The build stopped with `ninja: build stopped: subcommand failed` and pip exit code 1.

A warning also appeared at `simple_knn.cu(24)`:

```text
warning C4005: '__CUDACC__': macro redefinition
```

This warning was not the build failure.

## Applied workaround

After the C2872 result, the minimum extension-scoped change was added to `simple-knn/setup.py`:

```python
define_macros=[("USE_CUDA", "1")],
```

No PyTorch header, CUDA source, C++ source, global environment variable, or other submodule was modified.

## Second build attempt

The same command was rerun:

```text
python -m pip install --no-build-isolation .
```

with the same VS developer environment and process-local variables.

Toolchain:

- Python: `D:\Miniconda\envs\3dgs\python.exe`
- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA Toolkit: 12.8.93
- MSVC: 19.43.34810
- Windows SDK: 10.0.22621.0
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Capability: `(8, 6)`

The build succeeded with exit code 0.

Pip reported:

```text
Successfully built simple_knn
Successfully installed simple_knn-0.0.0
```

Wheel SHA-256:

```text
3df63ec8abf3034641ae5c18621a6db2495a038da837bb6ea48b239ebc9c833f
```

The C2872 error did not recur.

## Generated extension

Installed package location:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\simple_knn
```

Compiled module:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\simple_knn\_C.cp311-win_amd64.pyd
```

The `.pyd` size is 885,760 bytes (0.84 MB).

Pip package version:

```text
simple_knn-0.0.0
```

## Import and CUDA verification

Reusable test:

`D:\3DGS-Research\test_simple_knn_cuda.py`

Test output:

```text
PyTorch: 2.11.0+cu128
CUDA: 12.8
GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
CUDA available: True
simple_knn import: PASS
simple_knn._C import: PASS
distCUDA2 call: PASS
Distance result device: cuda:0
Distance result shape: (4,)
```

The test exited with code 0.

`python -m pip check` reported:

```text
No broken requirements found.
```

## Git state after build

`simple-knn` now reports:

```text
M setup.py
?? build/
?? simple_knn.egg-info/
```

Only `setup.py` was explicitly modified. `build/` and `simple_knn.egg-info/` are generated build artifacts.

No `fused-ssim` build or modification occurred.

## Final status

`simple-knn` is built, installed, importable, and verified for CUDA execution on the RTX 3050.

The extension-scoped `USE_CUDA=1` workaround resolved C2872 for this extension and should remain with `simple-knn/setup.py` until a repository-specific official fix or patched PyTorch environment supersedes it.

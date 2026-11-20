# CUDA Build Diagnostic

**Diagnostic date:** 2026-11-20  
**Project:** `D:\3DGS-Research`  
**Repository:** `D:\3DGS-Research\gaussian-splatting`  
**Extension:** `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`  
**Scope:** Read-only diagnosis. No compilation, installation, package modification, source modification, environment modification, or compiler-bypass action was performed.

## Previous build attempt

The previous attempt ran:

```text
python -m pip install --no-build-isolation .
```

from:

```text
D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization
```

It ran inside the Visual Studio 2022 x64 developer environment and pip exited 1 during wheel creation.

Relevant recorded log entry:

- Section: `diff-gaussian-rasterization Compilation`
- Result: Failed before CUDA/C++ compilation began
- Reported warning:

```text
UserWarning: It seems that the VC environment is activated but
DISTUTILS_USE_SDK is not set. This may lead to multiple activations of
the VC env. Please set `DISTUTILS_USE_SDK=1` and try again.
```

Pip later reported that the wheel could not be built; the actual block occurred when PyTorch's `BuildExtension._check_abi()` raised the warning.

## Exact commands executed

The Conda environment was queried with:

```text
D:\Miniconda\Scripts\conda.exe run -n 3dgs python -c "<Python diagnostic>"
```

Key environment command:

```text
import sys, torch
print(sys.executable)
print(sys.version)
print(torch.__version__)
print(torch.version.cuda)
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0))
print(torch.cuda.get_device_capability(0))
```

The Visual Studio developer environment was initialized in a child `cmd.exe` process with:

```text
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
```

The diagnostic shell also checked:

```text
where cl
cl
where nvcc
nvcc --version
set CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8
set TORCH_CUDA_ARCH_LIST=8.6
call D:\Miniconda\condabin\conda.bat activate 3dgs
python -c "import os,sys,torch; ..."
```

No build command was run during this diagnosis.

## Live outputs

### Conda and PyTorch

```text
Python executable: D:\Miniconda\envs\3dgs\python.exe
Python: 3.11.18 | packaged by Anaconda, Inc.
Python compiler: MSC v.1942 64-bit AMD64
PyTorch: 2.11.0+cu128
torch.version.cuda: 12.8
torch.cuda.is_available(): True
GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
CUDA capability: (8, 6)
```

### CUDA paths

```text
Process CUDA_PATH:
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8

Machine CUDA_PATH:
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8

User CUDA_PATH:
<not set>
```

No permanent environment variable was changed.

### Developer environment

The x64 developer prompt banner was emitted successfully:

```text
Visual Studio 2022 Developer Command Prompt v17.13.6
```

Compiler discovery after initialization:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe
Microsoft (R) C/C++ Optimizing Compiler Version 19.43.34810 for x64
```

CUDA discovery after initialization:

```text
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe

nvcc: NVIDIA (R) Cuda compiler driver
Cuda compilation tools, release 12.8, V12.8.93
Build cuda_12.8.r12.8/compiler.35583870_0
```

Inside the initialized and Conda-activated shell:

```text
CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8
TORCH_CUDA_ARCH_LIST=8.6
Python executable=D:\Miniconda\envs\3dgs\python.exe
PyTorch=2.11.0+cu128
torch.version.cuda=12.8
torch.cuda.is_available=True
```

The current developer shell diagnostic was therefore able to discover and activate all required executable/toolchain components.

## Root cause of the previous failure

The previous build was **not blocked by missing CUDA, missing PyTorch, missing GPU support, missing `cl.exe`, a bad `nvcc` path, or an incorrect Conda Python**.

The exact root cause was PyTorch's Windows build guard:

```text
If IS_WINDOWS
AND 'VSCMD_ARG_TGT_ARCH' is present
AND 'DISTUTILS_USE_SDK' is absent
```

PyTorch raises `UserWarning` from `torch.utils.cpp_extension.BuildExtension._check_abi()` before `build_extensions()` reaches any source compilation.

This is confirmed directly in PyTorch 2.11's local source:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\torch\utils\cpp_extension.py

IS_WINDOWS and 'VSCMD_ARG_TGT_ARCH' in os.environ
and 'DISTUTILS_USE_SDK' not in os.environ
```

The initialized developer environment supplies `VSCMD_ARG_TGT_ARCH`; `DISTUTILS_USE_SDK` was not supplied to the prior build process. The guard was intentionally raised by PyTorch and not by CUDA Toolkit 12.8 or MSVC.

## Extension build configuration

`setup.py` uses:

```text
torch.utils.cpp_extension.CUDAExtension
torch.utils.cpp_extension.BuildExtension
```

It declares:

- `diff_gaussian_rasterization._C`
- `rasterize_points.cu`
- `cuda_rasterizer/rasterizer_impl.cu`
- `cuda_rasterizer/forward.cu`
- `cuda_rasterizer/backward.cu`
- `ext.cpp`
- GLM include path under `third_party/glm`

No `pyproject.toml` or `setup.cfg` was present.

There are no source modifications and no setup-time code that bypasses compiler compatibility.

### Compatibility assessment

- **Python 3.11:** Supported by the `cp311` PyTorch wheel and the existing environment.
- **PyTorch 2.11:** CUDA 12.8 wheel is present and GPU operations succeed.
- **CUDA 12.8:** `nvcc` 12.8.93 is installed and discoverable.
- **MSVC 2022:** MSVC 19.43.34810 is within CUDA 12.8's supported Visual Studio 2022/MSVC 193x range.
- **RTX 3050:** Capability `(8, 6)` matches `TORCH_CUDA_ARCH_LIST=8.6`.
- **Windows SDK:** 10.0.22621.0 is installed.
- **Source configuration:** Standard PyTorch CUDA extension setup; no missing source file or known setup-time source incompatibility was found.

The CUDA header guard accepts `_MSC_VER` 1910 through 1949 for this CUDA 12.8 installation. MSVC 19.43 corresponds to `_MSC_VER` 1943, so it is within the supported range.

## Failure-category assessment

| Possible block | Status |
|---|---|
| Environment activation | Developer and Conda activation work |
| Missing compiler | No |
| Incorrect `cl.exe` PATH | No, after developer initialization |
| Missing or wrong CUDA Toolkit | No |
| CUDA detection | No, PyTorch CUDA is available |
| PyTorch/Python compatibility | No blocking incompatibility found |
| Build configuration | **Yes; `DISTUTILS_USE_SDK=1` was absent** |
| Unsupported compiler override | Not used |
| Missing source or setup configuration | No |

## Installation state

Read-only verification found:

```text
diff_gaussian_rasterization = None
```

No installable wheel or compiled extension was created by the failed attempt, and no package exists in the active environment.

## Recommended next action

The environment is technically ready for compilation, but the next build must provide `DISTUTILS_USE_SDK=1` only to the child build process, alongside the existing developer environment, Conda environment, `CUDA_PATH`, and `TORCH_CUDA_ARCH_LIST=8.6`.

Do not set unsupported compiler flags or bypass CUDA/MSVC compatibility checks.

No compilation or installation was performed at diagnosis time.

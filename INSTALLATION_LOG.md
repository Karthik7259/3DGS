# Installation Log

**Project:** Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting  
**Date:** 2026-11-20  
**Workspace:** D:\3DGS-Research

---

## Step 1 — Workspace and Tool Verification

### 1.1 Workspace

| Item | Result |
|------|--------|
| Directory | D:\3DGS-Research |
| Exists | ✅ Yes |
| Existing files | SYSTEM_INFO.md (764 B), INSTALLATION_LOG.md (1184 B) |
| Action taken | No files deleted or overwritten (SYSTEM_INFO.md updated with expanded info) |

### 1.2 Tool Checks

#### Git
| Field | Value |
|-------|-------|
| Status | ✅ Installed |
| Version | git version 2.47.0.windows.2 |
| Path | C:\Program Files\Git\cmd\git.exe |
| Verification | `git --version` ✅ |
| Notes | Fully functional, on PATH |

#### Miniconda
| Field | Value |
|-------|-------|
| Status | ✅ Installed (but NOT on system PATH) |
| Version | conda 26.9.4 |
| Distribution | Miniconda3 py314_26.9.4-1 (exe, win-64) |
| Path | D:\Miniconda |
| Executable | D:\Miniconda\Scripts\conda.exe |
| Verification | `& "D:\Miniconda\Scripts\conda.exe" --version` → conda 26.9.4 ✅ |
| Solver | libmamba (default) |
| Existing envs | base (D:\Miniconda), 3dgs (D:\Miniconda\envs\3dgs) |
| Issues | (1) Not on PATH — `where.exe conda` fails. (2) `C:\Users\karth\.condarc` has PermissionError preventing `conda env list` from running cleanly. |

#### Anaconda
| Field | Value |
|-------|-------|
| Status | ⚠️ Remnants detected, possibly inaccessible |
| Path entries on PATH | C:\Users\karth\anaconda3, ...\Scripts, ...\Library\bin, ...\Library\mingw-w64\bin, ...\Library\usr\bin |
| Accessibility | Access denied when checking C:\Users\karth\anaconda3 |
| Notes | Old Anaconda installation entries remain on the system PATH but may no longer be functional |

#### Python (System)
| Field | Value |
|-------|-------|
| Status | ✅ Installed |
| Version | Python 3.11.9 |
| Path | C:\Users\karth\AppData\Local\Programs\Python\Python311\python.exe |
| Verification | `python --version` ✅ |

#### Visual Studio C++ Build Tools
| Field | Value |
|-------|-------|
| Status | ⚠️ Partially installed — MSVC compiler MISSING |
| VS 2022 BuildTools path | C:\Program Files\Microsoft Visual Studio\2022\BuildTools |
| VS 2022 Enterprise path | C:\Program Files\Microsoft Visual Studio\2022\Enterprise (minimal — DIA SDK only) |
| VC\Tools contents | Only LLVM found; no MSVC directory |
| cl.exe found | ❌ No |
| MSBuild | Present in BuildTools |
| Windows SDK | ✅ Installed — versions 10.0.10240.0, 10.0.19041.0, 10.0.22621.0 |
| CMake | ✅ Present at C:\Program Files\CMake\bin |
| Notes | The MSVC C++ compiler (cl.exe) is not installed. The "Desktop development with C++" workload component needs to be added to VS Build Tools 2022. |

### 1.3 CUDA Toolkit

| Field | Value |
|-------|-------|
| Status | ✅ Installed |
| Installed version | CUDA 12.8 (V12.8.93) |
| nvcc verification | `nvcc --version` ✅ |
| Installation path | C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8 |
| CUDA_PATH env var | C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8 |
| Driver-reported CUDA | 13.0 (maximum supported by driver) |
| Notes | Driver supports up to CUDA 13.0; installed SDK is 12.8. This is normal — the driver is forward-compatible. No action needed. |

### 1.4 GPU Status (nvidia-smi)

| Field | Value |
|-------|-------|
| GPU | NVIDIA GeForce RTX 3050 (Laptop) |
| Driver | 581.86, WDDM mode |
| CUDA reported | 13.0 |
| Temperature | 41°C |
| Power | 9W / 75W cap |
| VRAM | 0 MiB / 6144 MiB used |
| GPU Utilization | 1% |
| Compute Mode | Default |
| Running processes | None |
| Status | ✅ Healthy and accessible |

---

## Step 2 — Install Missing Prerequisites

### 2.1 Summary of What Needs Action

| Tool | Current Status | Action Required |
|------|---------------|-----------------|
| Git | ✅ 2.47.0 | None |
| Miniconda | ✅ conda 26.9.4 at D:\Miniconda | Fix PATH and .condarc permission issue |
| Python | ✅ 3.11.9 | None |
| MSVC Build Tools | ⚠️ cl.exe missing | Add MSVC C++ compiler component to existing VS 2022 BuildTools |
| Windows SDK | ✅ 10.0.22621.0 | None |
| CUDA Toolkit | ✅ 12.8 | None (do not modify) |

### 2.2 Issue: Conda not on PATH and .condarc permission

**Problem:** Conda is installed at `D:\Miniconda` but not added to the PATH. Additionally, `C:\Users\karth\.condarc` has a permission error.

**Recommended fix (requires user action):**

1. Fix `.condarc` permissions — in a regular (non-sandboxed) PowerShell:
   ```powershell
   icacls "$Env:USERPROFILE\.condarc" /grant "$Env:USERNAME:(F)"
   ```

2. Initialize conda for PowerShell:
   ```powershell
   & "D:\Miniconda\Scripts\conda.exe" init powershell
   ```

3. Restart PowerShell, then verify:
   ```powershell
   conda --version
   conda activate 3dgs
   ```

### 2.3 Issue: MSVC C++ Compiler (cl.exe) Missing

**Problem:** Visual Studio 2022 BuildTools is installed, but the MSVC C++ compiler workload is not present. Only LLVM tools were found. The `cl.exe` compiler is required to compile CUDA-based Python extensions (e.g., diff-gaussian-rasterization, simple-knn).

**Required components:**
- `Microsoft.VisualStudio.Workload.VCTools` — Desktop development with C++
- Includes: MSVC v143 compiler, C++ ATL, Windows SDK integration

**Estimated disk space:** ~2–4 GB

**Installation command (requires Administrator):**
```powershell
# Download the VS Build Tools installer
Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_BuildTools.exe" -OutFile "$Env:TEMP\vs_BuildTools.exe"

# Modify existing installation to add C++ workload
Start-Process -FilePath "$Env:TEMP\vs_BuildTools.exe" -ArgumentList `
    "--add Microsoft.VisualStudio.Workload.VCTools",`
    "--includeRecommended",`
    "--quiet",`
    "--wait",`
    "--norestart" `
    -Verb RunAs -Wait
```

**⏸️ Awaiting user approval before running this installation.**

---

## Files Created/Updated

| File | Action | Path |
|------|--------|------|
| SYSTEM_INFO.md | Updated | D:\3DGS-Research\SYSTEM_INFO.md |
| INSTALLATION_LOG.md | Updated | D:\3DGS-Research\INSTALLATION_LOG.md |

---

## MSVC Build Tools Investigation

**Investigation date:** 2026-11-20  
**Scope:** Inspection only. No installer, environment variable, CUDA, PyTorch, or package changes were made.

### Existing Visual Studio Build Tools installation

Visual Studio Installer metadata reports two complete Visual Studio 2022 Build Tools instances:

| Instance | Version | Installation path | Relevant state |
|---|---|---|---|
| Current/newer instance | 17.14.45 (17.14.37906.3) | `C:\Program Files\Microsoft Visual Studio\2022\BuildTools` | No `VC\Tools\MSVC` directory found |
| Existing C++ instance | 17.13.6 (17.13.35931.197) | `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` | MSVC toolset found |

The Visual Studio Installer executable and `vswhere.exe` are present at `C:\Program Files (x86)\Microsoft Visual Studio\Installer`. The installer was queried only; it was not started or modified.

### Installed components

| Component | Result | Evidence |
|---|---|---|
| MSVC C++ compiler | ✅ Installed in the x86 Build Tools instance | MSVC toolset `14.43.34808` |
| `cl.exe` | ✅ Present | Four host/target variants under the MSVC toolset |
| C++ build tools workload | ✅ Reported by component query for the registered Build Tools installation | `Microsoft.VisualStudio.Workload.VCTools` |
| Windows SDK | ✅ Installed and reusable | SDK directories include `10.0.22621.0` |
| CMake | ✅ Installed | System CMake 4.3.2 at `C:\Program Files\CMake\bin\cmake.exe`; VS CMake integration also exists |
| Ninja | ✅ Available | VS-bundled `ninja.exe` exists; a Python Scripts `ninja.exe` is also on PATH |

### Missing components

No required compiler component is missing from the existing x86 Build Tools instance. The newer `C:\Program Files\Microsoft Visual Studio\2022\BuildTools` instance appears to be a separate minimal installation because its `VC\Tools\MSVC` directory is absent. Its installer metadata should not be confused with the older x86 instance that supplies the compiler.

`cl.exe` is not expected to work from an ordinary PowerShell prompt unless the Visual Studio developer environment has been initialized. This is a PATH/environment initialization issue, not evidence that the executable is absent.

### `cl.exe` search results

The recursive search found these Visual Studio 2022 compiler locations under:

`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin`

- `Hostx64\x64\cl.exe` — reports Microsoft C/C++ Optimizing Compiler 19.43.34810 for x64
- `Hostx64\x86\cl.exe` — reports version 19.43.34810 for x86
- `Hostx86\x64\cl.exe` — reports version 19.43.34810 for x64
- `Hostx86\x86\cl.exe` — reports version 19.43.34810 for x86

An older Visual Studio 2017 Express installation also contains `cl.exe`, but it is not the recommended toolchain for this project.

### Minimum recommended components

For Graphdeco 3D Gaussian Splatting CUDA-based Python extensions, use the existing Visual Studio 2022 Build Tools C++ environment with:

- MSVC v143 x64/x86 compiler and libraries (`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`)
- Windows SDK 10.0.22621.0 (already installed and reusable)
- MSBuild/C++ build tools integration
- CMake (already installed; useful for extension builds)
- Ninja is optional; the Visual Studio-bundled copy is already available

CUDA and PyTorch are separate prerequisites and were intentionally not installed or changed during this investigation.

### Estimated disk space

Because the required MSVC compiler, SDK, CMake integration, and Ninja are already present in the x86 Build Tools installation, the additional space required for the recommended compile setup is **approximately 0 GB**. If the user instead chooses to add the C++ workload to the newer minimal `C:\Program Files` instance, allow approximately **2–4 GB** for the compiler/libraries and related workload payloads. This is an estimate, not an installation action.

The existing Windows SDK does not need to be installed again.

### Recommended next action

Do not install or uninstall anything based on the earlier “`cl.exe` missing” result. Use the existing x86 Build Tools instance and initialize its developer command environment before building, for example through its `Common7\Tools\VsDevCmd.bat`/developer prompt. Then verify `cl`, CMake, and the CUDA/Python build from that initialized shell. If a build system specifically selects the newer `C:\Program Files` instance, explicitly select the x86 Build Tools instance rather than modifying Visual Studio at this stage.

---

## CUDA and MSVC Compatibility Verification

**Verification date:** 2026-11-20  
**Scope:** Read-only verification. No software, PATH, environment, CUDA, PyTorch, or Conda changes were made.

### CUDA Toolkit

| Item | Result |
|---|---|
| `nvcc.exe` | `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe` |
| Toolkit directory | `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8` |
| Exact version | CUDA Toolkit 12.8, V12.8.93 |
| Verification | `nvcc --version` completed successfully |

### NVIDIA GPU

`nvidia-smi` completed successfully:

- GPU: NVIDIA GeForce RTX 3050
- Driver: 581.86
- Available VRAM: 6144 MiB total; 6144 MiB available at verification time (0 MiB used)
- Driver-reported CUDA compatibility: 13.0

### MSVC compiler

The existing x86 Visual Studio Build Tools developer environment was initialized using:

`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat`

Results:

- `cl.exe`: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe`
- Compiler: Microsoft C/C++ Optimizing Compiler 19.43.34810 for x64
- Toolset directory: MSVC 14.43.34808 (v143)
- Target architecture: x64
- Windows SDK: 10.0.22621.0

The first batch-file attempts returned process exit code `-1073740791` because this PowerShell session had an invalid `ComSpec` value (`D:\Miniconda\Scripts`). Retrying with `ComSpec` corrected only inside the child `cmd.exe` process succeeded; no persistent environment variable was changed.

### CMake and Ninja

- CMake 4.3.2: `C:\Program Files\CMake\bin\cmake.exe`
- Ninja 1.12.1: Visual Studio-bundled copy at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe`

### Conda environment

The existing environment path is present:

`D:\Miniconda\envs\3dgs`

After activating `3dgs` in a child command process:

- Python: 3.11.18
- `where python`:
  - `D:\Miniconda\envs\3dgs\python.exe`
  - `C:\Users\karth\AppData\Local\Programs\Python\Python311\python.exe`

The first result is the active environment interpreter. The second is a later PATH candidate and does not indicate that the environment is inaccessible.

### Disk space

| Drive | Free space at verification |
|---|---:|
| C: | 22.49 GB |
| D: | 24.67 GB |

### Compatibility assessment

**Assessment: compatible, with no CUDA/MSVC version-blocking warning found.**

NVIDIA's official [CUDA 12.8 Windows Installation Guide](https://docs.nvidia.com/cuda/archive/12.8.1/cuda-installation-guide-microsoft-windows/) lists Visual Studio 2022 17.x as supported for native x86_64 compilation. The installed CUDA 12.8 `include\crt\host_config.h` accepts MSVC `_MSC_VER` values from 1910 through 1949; MSVC 19.43 corresponds to `_MSC_VER` 1943 and is within that range. Therefore CUDA 12.8 can use the installed MSVC 19.43.34810 compiler for x64 extension builds.

The driver-reported CUDA 13.0 is a driver compatibility level, while `nvcc` is CUDA Toolkit 12.8; these values serve different purposes and are not a conflict. PyTorch remains uninstalled as requested, so Python extension compilation can be verified now but PyTorch-dependent builds cannot run until that separate prerequisite is intentionally installed.

### Step 2.4 — CUDA and Compiler Compatibility Test

This was a read-only toolchain test using a disposable directory. No persistent environment variables were changed.

| Check | Result |
|---|---|
| `CUDA_PATH` | `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8` |
| `where nvcc` inside the VS developer environment | `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe` |
| `where cl` inside the VS developer environment | `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe` |
| `cl /Bv` | MSVC 19.43.34810.0, x64 compiler and linker passes |
| `nvcc --version` | CUDA 12.8, V12.8.93 |
| Windows SDK | 10.0.22621.0 |

A minimal CUDA program containing a kernel launch and `cudaDeviceSynchronize()` was created at `D:\3DGS-Research\temp_test\compatibility_test.cu` and compiled with:

```text
nvcc -arch=sm_86 compatibility_test.cu -o compatibility_test.exe
```

Compilation **succeeded** with exit code 0 and produced `compatibility_test.exe`. The temporary directory and all files created for this test were then removed successfully.

`cl /Bv` emits `D8003: missing source filename` when invoked without a source file; this is expected for a version-only check, and its version output was captured. A direct `where cl` from the ordinary PowerShell prompt did not find the compiler because the developer environment was not initialized; `where cl` succeeded after `VsDevCmd.bat` initialization. No compiler compatibility bypass flag was used.

**Test result:** CUDA Toolkit 12.8 successfully invoked MSVC 19.43.34810 for an x64 CUDA compilation targeting the RTX 3050 architecture (`sm_86`). No compatibility warning or compilation error occurred.

---

## PyTorch and CUDA Installation

**Installation date:** 2026-11-20  
**Environment:** `D:\Miniconda\envs\3dgs` (`3dgs`)  
**Scope:** Only the requested PyTorch CUDA wheels were installed. The base Conda environment, CUDA Toolkit, NVIDIA driver, and system-wide packages were not modified.

### Pre-installation checks

- `D:\Miniconda\Scripts\conda.exe run -n 3dgs python --version` reported Python 3.11.18.
- `torch` and `torchvision` were absent before installation.
- `torchaudio` was already present before installation; pip reported the requested `torchaudio==2.11.0` as already satisfied and aligned it with the requested CUDA build.
- Pre-installation free space: C: 17.35 GB; D: 24.51 GB.

### Installation

The following command completed successfully with exit code 0:

```text
D:\Miniconda\Scripts\conda.exe run -n 3dgs python -m pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu128
```

### Installed versions

| Package | Installed version | Location |
|---|---|---|
| PyTorch | 2.11.0+cu128 | `D:\Miniconda\envs\3dgs\Lib\site-packages` |
| TorchVision | 0.26.0+cu128 | `D:\Miniconda\envs\3dgs\Lib\site-packages` |
| TorchAudio | 2.11.0+cu128 | `D:\Miniconda\envs\3dgs\Lib\site-packages` |

### CUDA and GPU verification

The reusable verification script is [test_pytorch_cuda.py](D:/3DGS-Research/test_pytorch_cuda.py). It completed successfully with exit code 0:

- PyTorch CUDA runtime: 12.8
- CUDA availability: `True`
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- GPU capability: `(8, 6)`
- CUDA tensor matrix multiplication: successful
- Result device: `cuda:0`
- CUDA synchronization: successful
- Total GPU memory: 6,441,926,656 bytes
- Allocated GPU memory: 9,306,112 bytes
- Reserved GPU memory: 23,068,672 bytes
- TorchVision import/version: 0.26.0+cu128
- TorchAudio import/version: 2.11.0+cu128

Post-installation free space was C: 17.35 GB and D: 20.31 GB. No installation errors or CUDA runtime warnings occurred. The only pre-existing package condition was the already-installed TorchAudio package, which matched the requested version/build.

A post-install `pip check` reported an unrelated existing dependency issue: `ipython` 9.0.2 and `ipython-pygments-lexers` 1.1.1 require `pygments`, which is not installed. No attempt was made to fix it because additional packages were outside this installation scope.

---

## Basic Python Dependencies

**Audit date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`  
**Python:** 3.11.18  

### Repository dependency audit

The repository imports were inspected across `train.py`, `render.py`, `metrics.py`, `convert.py`, `gaussian_renderer/`, `scene/`, `utils/`, `arguments/`, and `lpipsPyTorch/`.

Dependencies used by the repository:

- PyTorch, TorchVision, and TorchAudio
- NumPy
- Pillow
- OpenCV
- `plyfile`
- `tqdm`
- `joblib`
- Local `lpipsPyTorch` module

SciPy, Matplotlib, PyYAML, and an external LPIPS package were not found in the audited repository imports and were not installed.

### Packages already installed

| Package | Installed version | Compatibility |
|---|---|---|
| torch | 2.11.0+cu128 | Compatible; CUDA available |
| torchvision | 0.26.0+cu128 | Compatible |
| torchaudio | 2.11.0+cu128 | Compatible |
| numpy | 2.4.6 | Python 3.11 compatible |
| pillow | 13.0.0 | Python 3.11 compatible |

The repository's local `lpipsPyTorch` module was present and uses the installed torchvision implementation.

### Packages newly installed

| Package | Installed version | Reason |
|---|---|---|
| plyfile | 1.1.5 | PLY model/data file support |
| tqdm | 4.70.1 | Progress reporting used by training/rendering |
| opencv-python | 5.1.0.95 | Image/COLMAP camera utilities |
| joblib | 1.6.0 | Parallel/depth utilities |
| pygments | 2.21.0 | Resolved existing IPython package dependency |
| cloudpickle | 3.1.3 | Dependency installed by joblib |

No PyTorch, TorchVision, TorchAudio, CUDA Toolkit, NVIDIA driver, or CUDA extension packages were changed or installed.

### Compatibility notes

- NumPy 2.4.6 is compatible with the current Python 3.11 environment and is also satisfied by `plyfile`.
- Pillow 13.0.0 supports the repository's PIL image operations.
- OpenCV 5.1.0.95 provides a Python 3.11-compatible `cv2` module.
- `joblib` 1.6.0 also installed its `cloudpickle` dependency.
- Pygments 2.21.0 resolved the previously reported IPython dependency gap.
- The original `environment.yml` was not used, so no Python or PyTorch downgrade occurred.

### Verification

`D:\3DGS-Research\test_dependencies.py` was created as a reusable import test.

Results:

- torch: PASS, 2.11.0+cu128
- torchvision: PASS, 0.26.0+cu128
- torchaudio: PASS, 2.11.0+cu128
- numpy: PASS, 2.4.6
- Pillow: PASS, 13.0.0
- opencv-python: PASS, 5.1.0
- plyfile: PASS
- tqdm: PASS, 4.70.1
- joblib: PASS, 1.6.0
- lpipsPyTorch: PASS
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Overall import test: PASS

`python -m pip check` reported:

```text
No broken requirements found.
```

---

## diff-gaussian-rasterization Compilation

**Attempt date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`  
**Extension:** `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`

### Build inspection

The extension uses `torch.utils.cpp_extension.CUDAExtension` and `BuildExtension` in `setup.py`. It declares:

- Package: `diff_gaussian_rasterization`
- Compiled module: `diff_gaussian_rasterization._C`
- CUDA sources: `rasterizer_impl.cu`, `forward.cu`, `backward.cu`, `rasterize_points.cu`
- C++ source: `ext.cpp`
- Extra include: `third_party/glm`

No `pyproject.toml` was present. No source files were modified.

### Build command and environment

The build was run from the extension directory inside the Visual Studio 2022 x64 developer environment:

```text
python -m pip install --no-build-isolation .
```

Verified child-process values:

- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA Toolkit: 12.8.93
- CUDA architecture: 8.6
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`
- MSVC: 19.43.34810 for x64
- cl.exe: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe`
- nvcc: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe`
- Windows SDK: 10.0.22621.0

The normal `cl /Bv` no-source check produced the expected D8003 status and was handled as non-fatal.

### Compilation result

**FAILED before CUDA/C++ compilation began.**

Pip exited 1 while building the wheel. PyTorch reported:

```text
UserWarning: It seems that the VC environment is activated but
DISTUTILS_USE_SDK is not set. This may lead to multiple activations of
the VC env. Please set `DISTUTILS_USE_SDK=1` and try again.
```

The build reached metadata and began `build_ext`, then raised `torch.utils.cpp_extension._check_abi` from `build_extensions` before compiling the extension sources.

No `--allow-unsupported-compiler`, source edit, CUDA downgrade, PyTorch downgrade, or random workaround was used. The build stopped at this configuration error as requested.

### Installation/import test

No installable wheel was created. The module was not installed, and:

- `diff_gaussian_rasterization` could not be imported
- `diff_gaussian_rasterization._C` was not present
- `GaussianRasterizationSettings` and `GaussianRasterizer` could not be imported

No verification test script was created because the compilation did not succeed.

---

## diff-gaussian-rasterization Compilation — Second Attempt

**Attempt date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

### Exact build command

Run from `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`:

```text
python -m pip install --no-build-isolation .
```

### Process-local environment variables

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`
- Visual Studio 2022 x64 developer environment initialized

### Toolchain verification

- Python: `D:\Miniconda\envs\3dgs\python.exe`
- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- GPU capability: `(8, 6)`
- CUDA Toolkit: 12.8.93
- nvcc: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe`
- MSVC: 19.43.34810 for x64
- cl.exe: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe`
- Windows SDK: 10.0.22621.0

### Build result

**Compilation started and failed.** This attempt passed the prior `DISTUTILS_USE_SDK` guard. NVIDIA compilation began for all five extension source units; backward, forward, rasterizer implementation, and the C++ `ext.cpp` step began successfully. Compilation stopped while compiling `rasterize_points.cu`.

The concrete compiler error was:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\torch\include\torch\csrc\dynamo\compiled_autograd.h(1143): error C2872: 'std': ambiguous symbol

Candidate from:
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\include\fstream(20): 'std'

Candidate identified by CUDA/MSVC instantiation context:
D:\Miniconda\envs\3dgs\Lib\site-packages\torch\include\torch\csrc\dynamo\compiled_autograd.h
```

PyTorch's Ninja build reported:

```text
ninja: build stopped: subcommand failed.
RuntimeError: Error compiling objects for extension
```

Pip exit status: 1.

Warnings before the error:

- `auxiliary.h(163): warning #177-D: variable "p_proj" was declared but never referenced`
- nvcc warning that offline compilation support for architectures earlier than compute/sm/lto_75 will be removed in a future release

The extension module was not installed:

```text
diff_gaussian_rasterization = None
```

No source files were modified, no other extensions were compiled, and no packages or environment variables were changed permanently.

---

## diff-gaussian-rasterization Controlled USE_CUDA Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

### Change made

The rasterizer submodule was clean before the test. A minimum one-line change was added to `submodules/diff-gaussian-rasterization/setup.py`:

```python
define_macros=[("USE_CUDA", "1")],
```

No source code, PyTorch headers, other submodules, or permanent environment variables were changed.

### Exact build command

```text
python -m pip install --no-build-isolation .
```

Process-local build values:

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

### Toolchain

- Python: `D:\Miniconda\envs\3dgs\python.exe`
- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA Toolkit: 12.8.93
- MSVC: 19.43.34810
- Windows SDK: 10.0.22621.0
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Capability: `(8, 6)`

### Build result

Compilation succeeded with exit code 0. The C2872 `std` ambiguity did not recur.

Pip reported:

```text
Successfully built diff_gaussian_rasterization
Successfully installed diff_gaussian_rasterization-0.0.0
```

The package location is `D:\Miniconda\envs\3dgs\Lib\site-packages\diff_gaussian_rasterization`, and the compiled module is:

```text
_C.cp311-win_amd64.pyd
```

### Verification

`D:\3DGS-Research\test_diff_gaussian_rasterization.py` passed:

- PyTorch: 2.11.0+cu128
- CUDA: 12.8
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- `diff_gaussian_rasterization` import: PASS
- `GaussianRasterizationSettings` import: PASS
- `GaussianRasterizer` import: PASS
- CUDA matrix/tensor operation: PASS
- Result device: `cuda:0`
- `pip check`: No broken requirements found

The temporary macro resolved the build error and is recommended to remain until a confirmed official upstream PyTorch fix or repository-maintained alternative is selected.

---

## simple-knn Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

### Pre-build state

The `simple-knn` submodule was detached at its recorded commit and had no uncommitted changes before this test.

### Setup and first build

`simple_knn/setup.py` initially had no `USE_CUDA` macro. The build command was:

```text
python -m pip install --no-build-isolation .
```

The build reached `spatial.cu` and failed with:

```text
torch/csrc/dynamo/compiled_autograd.h(1143): error C2872: 'std': ambiguous symbol
```

Pip and Ninja reported build failure exit code 1.

### Workaround and successful build

A one-line extension-scoped macro was added:

```python
define_macros=[("USE_CUDA", "1")],
```

Process-local build values remained:

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

The same build command succeeded with exit code 0:

```text
Successfully built simple_knn
Successfully installed simple_knn-0.0.0
```

C2872 did not recur.

### Installed extension

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\simple_knn\_C.cp311-win_amd64.pyd
```

### Verification

`D:\3DGS-Research\test_simple_knn_cuda.py` passed:

- PyTorch: 2.11.0+cu128
- CUDA runtime: 12.8
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Capability: `(8, 6)`
- `simple_knn` import: PASS
- `simple_knn._C` import: PASS
- `distCUDA2` CUDA call: PASS
- Result device: `cuda:0`
- Result shape: `(4,)`

`pip check` reported no broken requirements.

---

## Tanks and Temples Truck Dataset Download

**Download date:** 2026-11-20  
**Status:** Download complete; archive not extracted

### Download

- Source: `https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip`
- Tool: Portable aria2 1.37.0
- Connections: 8
- Resume: enabled
- Destination: `D:\3DGS-Research\downloads\graphdeco_tandt_db.zip`

### Timing and speed

- Started: 15:47:07
- Completed: 16:18:02
- Duration: approximately 30 minutes 55 seconds
- Existing partial: 53.07 MiB
- Downloaded for completion: approximately 598 MiB
- Average aria2 speed: 330 KiB/s
- Final result: OK/download completed

### Final archive

- Size: 651.01 MiB
- Length: 682,628,995 bytes
- ZIP integrity: Passed; no bad entries
- SHA-256:
  `816E62F22A161ABBFE841D2A6B10CDF036E297C9FA289B3BFEEE9C6EC526D7E1`

No official aggregate-archive checksum was available, so the SHA-256 is locally calculated only.

### D drive

- Free after download: 18.92 GB

### Truck structure observed

Archive inspection found:

- 251 JPG images
- 979×546 resolution for all Truck images
- `tandt/truck/sparse/0/cameras.bin`
- `tandt/truck/sparse/0/images.bin`
- `tandt/truck/sparse/0/points3D.bin`
- `tandt/truck/sparse/0/project.ini`

The archive was not extracted and no preprocessing, training, or rendering was performed.

---

## Dataset Selection Refresh

**Planning refresh date:** 2026-11-20  
**Status:** No dataset downloaded or extracted

### Refreshed storage

- C: free: 17.31 GB
- D: free: 19.56 GB
- `D:\3DGS-Research`: 614.20 MB
- `D:\3DGS-Research\gaussian-splatting`: 614.09 MB
- `D:\3DGS-Research\datasets`: missing
- `D:\3DGS-Research\downloads`: missing

### Recommended first baseline scene

**Tanks and Temples — Truck**

- Real-world COLMAP dataset
- Approximately 251 images
- Approximately 980×545 source resolution
- Official preprocessed scene in the Graphdeco T&T archive
- Official archive: 682,628,995 bytes / 651 MiB
- No `convert.py` step is expected for the preprocessed archive

Official source:

```text
https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip
```

Planned destination:

```text
D:\3DGS-Research\datasets\tandt_db\truck
```

The report recommends a 7k original-resolution baseline, with `-r 2` as the memory fallback for 6 GB VRAM.

No acquisition or extraction action was performed.

---

## Dataset Selection

**Planning date:** 2026-11-20  
**Status:** No dataset downloaded or extracted

### Storage

- C: free: 17.50 GB
- D: free: 19.56 GB
- `D:\3DGS-Research`: 614.19 MB
- `D:\3DGS-Research\gaussian-splatting`: 614.09 MB

### Recommended dataset

**Tanks and Temples — Truck**

Reasons:

- Real-world novel-view scene
- Approximately 251 images
- Approximately 980×545 source resolution
- Preprocessed COLMAP scene
- Official Graphdeco archive
- 682,628,995-byte / 651-MiB archive
- Much smaller than Mip-NeRF 360 Pt. 1
- Suitable for a 7k baseline with 6 GB VRAM

Official source:

```text
https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip
```

### Acquisition plan

Proposed storage:

```text
D:\3DGS-Research\downloads\tandt_db.zip
D:\3DGS-Research\datasets\tandt_db\truck
```

No download or extraction was performed.

No `convert.py` step is expected because the official archive is preprocessed.

Recommended baseline:

```text
python train.py -s D:\3DGS-Research\datasets\tandt_db\truck -m D:\3DGS-Research\output\truck_baseline_7k -r 1 --iterations 7000 --test_iterations -1 --save_iterations 7000 --disable_viewer --quiet
```

Fallback resolution:

```text
-r 2
```

---

## Complete 3DGS Installation Smoke Test

**Test date:** 2026-11-20  
**Project:** `D:\3DGS-Research\gaussian-splatting`  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

### Project state

The parent repository remained on `main` and only reported modifications to:

- `submodules/diff-gaussian-rasterization`
- `submodules/simple-knn`
- `submodules/fused-ssim`

The three modifications are intentional setup.py build macros. No main 3DGS training/rendering source file was modified.

### Environment

- Python: 3.11.18
- PyTorch: 2.11.0+cu128
- PyTorch CUDA runtime: 12.8
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
- Capability: `(8, 6)`
- Total GPU memory: 6.00 GiB
- TorchVision: 0.26.0+cu128
- NumPy: 2.4.6
- Pillow: 13.0.0
- OpenCV: 5.1.0
- plyfile: 1.1.5
- tqdm: 4.70.1
- joblib: 1.6.0

`matplotlib` was absent. It is optional for the fused-SSIM plot tests and is not required by core 3DGS training/rendering.

`pip check`:

```text
No broken requirements found.
```

### Extension imports and CUDA operations

- diff-gaussian-rasterization: import PASS
- diff-gaussian-rasterization `_C`: PASS
- simple-knn: import PASS
- simple-knn `_C`: PASS
- `distCUDA2`: PASS on CUDA
- fused-ssim: import PASS
- fused-ssim CUDA module: PASS
- Fused SSIM forward/backward: PASS
- Identical-image SSIM: 1.0

### Main architecture imports

Passed for:

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

### CLI verification

Read-only `--help` verification passed for:

- `train.py`
- `render.py`
- `metrics.py`

No dataset, training, or rendering operation was run.

### Smoke-test script

Created:

`D:\3DGS-Research\test_3dgs_installation.py`

It completed with:

```text
FINAL: PASS
```

Detailed report:

`D:\3DGS-Research\3DGS_INSTALLATION_SMOKE_TEST.md`

### Final assessment

The complete installation is ready for the next baseline 3DGS experiment/dataset stage. No remaining core dependency conflict was found.

No `fused-ssim` build or modification occurred.

---

## fused-ssim Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`

### Pre-build state

The `fused-ssim` submodule was detached at its recorded commit and had no uncommitted changes before this test.

### Build configuration

The extension builds `fused_ssim_cuda` from `ssim.cu` and `ext.cpp`, and exposes the Python API from `fused_ssim/__init__.py`.

### Initial build

The command was:

```text
python -m pip install --no-build-isolation .
```

The first build failed in `c10/cuda/CUDACachingAllocator.h` because Windows SDK macro `small` expanded to `char`.

The targeted first workaround was:

```python
define_macros=[("WIN32_LEAN_AND_MEAN", "1")]
```

This removed the `small`/`char` conflict. The build then exposed the known PyTorch 2.11 C2872 header issue.

### Final targeted build

The extension-scoped macros were finalized as:

```python
define_macros=[
    ("WIN32_LEAN_AND_MEAN", "1"),
    ("USE_CUDA", "1")])
```

Process-local values remained:

- `DISTUTILS_USE_SDK=1`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

The build succeeded:

```text
Successfully built fused_ssim
Successfully installed fused_ssim-0.0.0
```

### Installed extension

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\fused_ssim_cuda.cp311-win_amd64.pyd
```

### Verification

`D:\3DGS-Research\test_fused_ssim_cuda.py` passed:

- PyTorch: 2.11.0+cu128
- CUDA runtime: 12.8
- CUDA available: True
- GPU: NVIDIA GeForce RTX 3050 Laptop GPU
- Capability: `(8, 6)`
- `fused_ssim` import: PASS
- `fused_ssim_cuda` import: PASS
- Identical-image SSIM: `1.0`
- SSIM result finite: True
- SSIM result device: `cuda:0`
- Backward pass: PASS
- Gradient finite: True

`pip check` reported no broken requirements.

---

## Truck Dataset Extraction and Inspection (2026-11-20)

Inspected `downloads\graphdeco_tandt_db.zip` again and extracted only its `tandt/truck/` subtree to `datasets\truck`. The pre-existing destination folder was empty. The archive remains unchanged.

Verification summary:

- Extracted 255 files totaling 187,282,181 bytes (about 178.6 MiB).
- 251 `.jpg` images; all are 979 × 546 and all decoded successfully with no corruption found.
- `sparse\0\cameras.bin`, `images.bin`, and `points3D.bin` are present and parse using the repository's existing COLMAP reader.
- Reconstruction: one `PINHOLE` camera, 251 registered images, and 136,029 3D points; camera references and point observation tracks passed structural checks.
- Scene structure and PINHOLE model are supported by the original Graphdeco loader. Intended scene path: `D:\3DGS-Research\datasets\truck`.
- Caveat recorded in `TRUCK_DATASET_INSPECTION_REPORT.md`: COLMAP camera dimensions are 1957 × 1091 while stored images are 979 × 546, a roughly 2× mismatch that may affect projection alignment.
- D: free space after extraction: 20,126,486,528 bytes (about 18.75 GiB).
- No training, rendering, downloads, package installation, or source modifications were performed.

Full results: `TRUCK_DATASET_INSPECTION_REPORT.md`.

---

## Truck Baseline Training Preparation (2026-11-20)

Inspected the original Graphdeco loader, scene selection, camera/image creation, training script, and arguments. Created `BASELINE_TRAINING_PREPARATION.md` with the analysis and suggested command.

- `datasets\truck` has the expected `images/` and `sparse/0/` layout; `Scene` recognizes it as COLMAP data. The binary reader handles its `PINHOLE` camera.
- The loader reads image dimensions from the opened JPG for image tensors, but FOV from the COLMAP camera dimensions and focal lengths. It does not correct Truck's approximately 2× calibration/image scale mismatch. `--resolution` does not repair it.
- Lightweight check in `D:\Miniconda\envs\3dgs`: parsed all 251 camera records and constructed one real repository camera at 979×546 on CUDA. RTX 3050 6GB detected. The check did not modify the dataset; no `points3D.ply` was created.
- Recommended bounded configuration: native 979×546, 7,000 iterations, SH degree 2, reduced densification, evaluation at 1k/3k/7k, output `D:\3DGS-Research\output\truck_baseline_7k`. Estimated peak VRAM 4–6 GB; OOM remains possible.
- Exact command and caveats are in `BASELINE_TRAINING_PREPARATION.md`. Training and rendering were not started; source/data files and packages were not changed.

---

## Truck Camera Calibration Analysis (2026-11-20)

Created `CAMERA_CALIBRATION_ANALYSIS.md` after rereading the Truck COLMAP camera binary and tracing Graphdeco's loader and projection path.

- COLMAP camera: `PINHOLE`, 1957 × 1091, `[fx, fy, cx, cy] = [1163.254728, 1156.280405, 978.5, 545.5]`; all 251 JPGs are 979 × 546.
- Actual/calibration scales are 0.5002554931 (width) and 0.5004582951 (height), near 2× downsampling with a tiny axis difference attributable to integer rounding. It is strongly consistent with downscaling, but dimensions alone do not prove the production history.
- Correction/refinement to the prior preparation note: a centered pinhole FOV is invariant under proportional image resize. Graphdeco computes FOV from COLMAP dimensions/focal lengths and rasterizes at the actual image dimensions; effective pixel focal lengths therefore scale to approximately 581.925 and 578.670. The factor-of-two dimensions alone do not establish a projection error.
- Recommendation: do not upscale or patch the original loader. Preserve the archive and dataset; validate alignment first. If image-coordinate metadata is needed for downstream tools, create an isolated derived dataset with scaled intrinsics and a provenance manifest. Full comparison and a pre-training overlay/reprojection validation plan are in the analysis report.
- Read-only work only: no source/data/archive changes, package installs, training, or rendering.

---

## Truck Dataset Alignment Validation (2026-11-20)

Created `DATASET_ALIGNMENT_VALIDATION.md` and generated read-only diagnostics under `D:\3DGS-Research\validation`.

- All 251 registered image records resolve to 979 × 546 JPGs; the `PINHOLE` calibration, poses, and 136,029 sparse points parse successfully.
- Camera poses are finite with normalized quaternions and form a smooth, compact loop. Headings generally face the reconstructed scene.
- Checked 1,083,072 3D-to-2D observations: no negative-depth projections; scaled residual median 0.334 px, p95 1.103 px, max 2.089 px.
- Six representative overlays show close alignment of observed COLMAP features and projected sparse points. No gross camera/image alignment anomaly detected.
- The sparse cloud includes an extended tail and many short tracks; noted for later training review, but not associated with large residuals in this check.
- Alignment perspective: suitable to proceed to a baseline. Limitations and no-ground-truth caveat are in the report.
- Visualizations: `truck_trajectory_sparse_cloud.png` and `truck_reprojection_overlays.png`; metrics and script also saved under `validation\`.
- Dataset, source, COLMAP files, and ZIP remain unchanged. No training, rendering, downloads, or package installations were performed.

---

## Truck Baseline Training Configuration (2026-11-20)

Created `BASELINE_TRAINING_CONFIGURATION.md` after inspecting the official training arguments, scene loader, Gaussian initialization/densification, renderer, save/checkpoint, and evaluation paths.

- Recommended canonical 30,000-iteration, SH degree 3 baseline with original densification/pruning/opacity-reset defaults. Native 979 × 546 images; evaluation split 219 training / 32 held out.
- Use official `--data_device cpu` to reduce VRAM used by the 251 RGB images and alpha masks without changing the training algorithm. Estimate 3.5–5.8 GiB training peak on 6 GB; OOM remains possible.
- The loader creates `sparse\0\points3D.ply` if absent. To preserve the validated original dataset, the proposed command uses a separate `truck_baseline_input` copy (copy command included in the report, not run).
- Preflight argument parser and one camera load passed; CUDA RTX 3050 detected. No full Scene initialization, training loop, or render was run. Output directory was not created; code creates it when training starts.
- Current D: free space: 20,123,467,776 bytes (~18.74 GiB). Recommend reserving up to ~5 GB output and 1 GB temporary headroom; estimates depend on final Gaussian count.
- Exact command, storage method, caveats, and checklist are in the configuration report. Original dataset, source, validation reports, and ZIP remain unchanged. No packages or downloads were added.

---

## Isolated Truck Baseline Dataset Preparation (2026-11-20)

Created `training_data\truck_baseline` as a physical copy of `datasets\truck` and created `experiments\baseline_truck`. Updated `BASELINE_DATASET_PREPARATION.md` with the manifest, hash, disk, preflight, and next-command details.

- Initial copy: 255 files / 187,282,181 bytes; all source/copy file hashes matched, including the three COLMAP binary SHA-256 values. All 251 copied JPGs decoded at 979 × 546; no missing/extra files, size mismatches, symlinks, or junctions.
- Official Graphdeco reader loaded the copied dataset: 219 train / 32 evaluation cameras, 136,029 initial points, extent 5.847915. All 251 camera objects loaded successfully.
- The reader generated `sparse\0\points3D.ply` (3,673,017 bytes) only under `training_data\truck_baseline`. Original `datasets\truck` remains 255 files and has no PLY.
- Training parser accepted the exact proposed flags. RTX 3050 CUDA detected. Output directory write test succeeded; retained `.preflight_write_test.txt` (51 bytes).
- D: free: 20,123,447,296 bytes before copy; 19,931,860,992 bytes after copy, generated PLY, and output probe (about 18.56 GiB).
- Exact next training command is in the report. No training or rendering was run. Original dataset, source code, validation reports, and downloaded ZIP remain unchanged. No packages/downloads were added and no files were deleted.

---

## Final Truck Baseline Training Command Audit (2026-11-20)

Created `FINAL_BASELINE_TRAINING_AUDIT.md` with the exact manually reviewable command and parameter audit.

- Command targets `training_data\truck_baseline` and `experiments\baseline_truck`; no unintended source/original dataset/ZIP paths.
- Verified 30,000 iterations, SH degree 3, native 979 × 546 resolution, CPU image storage, official densification/pruning defaults, `--eval` split of 219/32, and checkpoints at 7,000/15,000/30,000.
- Prior parser/loader preflight passed for this command and copied dataset; 251 camera objects were loaded, CUDA available, output write probe succeeded.
- Current `nvidia-smi`: RTX 3050 6GB, 0 MiB VRAM used, 6,002 MiB free, 1% utilization, 50 °C. D: free: 18,675,679,232 bytes (~17.39 GiB).
- Estimated duration: 1–3 hours (unbenchmarked; paper's 26:54 Truck reference is on A6000). Estimated storage up to 6 GB plus 1 GB headroom. OOM risk remains material because 6 GB is below official low-memory guidance.
- No training/rendering was started. No files outside the audit report and this log were modified in this audit.

---

## Baseline Truck Rendering and Evaluation (2026-11-20)

Created `BASELINE_RENDERING_AND_EVALUATION.md`. Verified and rendered the iteration-30,000 baseline without retraining.

- Final checkpoint tuple reports iteration 30,000, SH degree 3, and 2,050,123 Gaussians. Final PLY has the same vertex count. Checkpoint size: 1,476,097,814 bytes; PLY size: 508,432,036 bytes. Saved `cfg_args` records the expected isolated dataset and CPU image storage.
- Official `render.py` completed: 219 train and 32 test render/GT PNG pairs under `train/ours_30000` and `test/ours_30000`.
- Mean saved-PNG metrics using repository helpers: test PSNR 25.5404 dB / SSIM 0.88525; train PSNR 27.7720 dB / SSIM 0.91601. Train aggregate covers all 219 views; training log used a five-camera train sample.
- LPIPS was not computed: VGG/LPIPS weight files are not cached, and official `metrics.py` would download them. No download was attempted.
- Five held-out comparisons with amplified difference images are in `experiments\baseline_truck\visualizations\test_view_comparisons.png`.
- Approximate render+save throughput: 4.2 frames/s (~0.24 s/frame); not a kernel-only benchmark. GPU memory after processing returned to 0 MiB used / 6,002 MiB free; peak was not sampled.
- Current D: free after rendering: approximately 11.785 GiB. Dataset, model, checkpoint, source, and ZIP remain unchanged. No training, package installation, or download occurred.

## Gaussian Selection Architecture Analysis (2026-11-20)

Created GAUSSIAN_SELECTION_ARCHITECTURE_ANALYSIS.md after read-only inspection of Graphdeco rendering code and baseline PLY/config metadata.

- Traced PLY load through scene/camera, gaussian_renderer, Python rasterizer contract, C++/CUDA setup, projection, SH/covariance processing, tile ordering and compositing.
- Confirmed 2,050,123 PLY vertices and degree-3 SH layout. Tensor dimensions are derived from the PLY schema and loader/getter code; the large checkpoint/model tensors were not reloaded.
- Identified aligned inference-only gathering immediately before the rasterizer as the safest stock-CUDA selection point. The rasterizer defines P from means3D.shape[0] and returns subset-sized radii.
- Confirmed radii>0 is a geometric/projected visibility signal, not contribution/importance. Per-Gaussian depth and contribution are not returned; depth can be computed from positions and camera transform, while contribution needs further measurement.
- Reviewed opacity pruning and screen-space gradient densification; neither implements Gaussian removal sensitivity. The report distinguishes heuristic/gradient/counterfactual scores and recommends fixed Top-K, sensitivity, view-dependent, then temporal stages.
- No source, model, dataset, checkpoint, or existing render/evaluation outputs were changed. No training, rendering, package installation, download, or full model load occurred.

## Experiment 01: Fixed Opacity-Based Top-K (2026-11-20)

Created an isolated selector and validation harness under gaussian-splatting\experiments\fixed_topk. The official renderer files and CUDA rasterizer were not modified.

- Score: activated opacity sigmoid(raw opacity), ranked descending with stable ties preserving original row order. Original row IDs are retained. This is a baseline heuristic, not sensitivity or contribution.
- Floor-based K values for N=2,050,123: 100%=2,050,123; 75%=1,537,592; 50%=1,025,061; 25%=512,530; 10%=205,012; 5%=102,506.
- Loaded baseline iteration 30,000. All budgets passed exact count, unique/in-bounds index, and XYZ/opacity/scale/rotation/SH aligned-dimension checks. 100% preserved source order and used the original model object. Original parameter identities, storage pointers, and version counters were unchanged.
- With selection bypassed, the original renderer completed one test camera. The same view rendered through the unchanged CUDA rasterizer with the 5% subset (102,506 points). Both calls saved no images; no full test set, benchmark, or metrics were run.
- No baseline model, dataset, original renderer, CUDA code, or existing baseline output was changed. Existing dirty states in diff-gaussian-rasterization, fused-ssim, and simple-knn submodules were observed before implementation and left untouched.
- Validation command and limitations are documented in FIXED_TOPK_IMPLEMENTATION_REPORT.md. A local Python bytecode cache was created for the new scripts.

## Experiment 02: Fixed Opacity Top-K Quality and Performance Benchmark (2026-11-20)

Created and ran experiments\fixed_topk\benchmark_opacity_topk.py in a separate output directory, experiments\fixed_topk_benchmark.

- Verified 32 existing test render PNGs and 32 GT PNGs. All 32 loaded test camera images matched their indexed saved GT PNG exactly; the harness now checks every camera/GT pair.
- Preflight: 100% output for one camera was pixel-identical to the existing baseline render; 5% subset rendered successfully. Full run then evaluated all six budgets (2,050,123; 1,537,592; 1,025,061; 512,530; 205,012; 102,506 Gaussians) on all 32 test views, with one warm-up and three timed repetitions per budget.
- Test PSNR/SSIM means by retention: 100% 25.5404/0.88525; 75% 25.2118/0.88166; 50% 23.5604/0.85672; 25% 19.3648/0.73801; 10% 13.6679/0.49505; 5% 10.3477/0.33505. All 32 100% rendered PNGs matched the saved original baseline PNGs pixel-for-pixel.
- Timings used synchronized CUDA events and synchronized wall-clock render-call times, with image saving measured separately. GPU-stream FPS ranged from 20.40 at 100% to 83.39 at 5%; synchronized render-call FPS ranged from 19.21 to 66.99. The shared opacity ranking took 0.236 s. PNG saving took 8.6–9.4 seconds per 32-view pass.
- Per-process PyTorch peak allocated/reserved memory was measured per view; maximum observed across budgets was 1.39/1.54 GiB. This is not total device usage. LPIPS was unavailable because required LPIPS/VGG weights were not cached; no downloads were attempted.
- Output artifacts are isolated under experiments\fixed_topk_benchmark (about 155.1 MiB). SHA-256 hashes for the baseline checkpoint/PLY, official renderer, rasterizer sources, and Experiment 01 selector matched before and after. The baseline render outputs, GT, metrics JSON, visualizations, dataset, and source were not modified.
- Full results, CSVs, visual comparisons, methodology, timing caveats, and limitations are in FIXED_TOPK_BENCHMARK_REPORT.md. No sensitivity/view-dependent/temporal method or training was run.

## Fixed Top-K Selector Analysis (2026-11-20)

Created FIXED_TOPK_SELECTOR_ANALYSIS.md after read-only inspection of the Experiment 01 selector, Experiment 02 harness, Gaussian opacity getter, and renderer/training gradient paths.

- Exact score is activated opacity: sigmoid(raw opacity logit). For budgets below 100%, stable descending torch.argsort selects the first floor(N × percentage / 100) Gaussian IDs; ties retain source row order. The 100% case passes through the original model in source order.
- Selection is global and viewpoint-independent. Experiment 02 computes one ranking and reuses the same selected IDs across camera views; it reconstructs each budget subset once per repetition, outside the camera loop. No random selection or temporal state is used. The benchmark's seeded random order only shuffles budget execution.
- Explained that opacity is not image contribution/sensitivity and ignores scale/SH/camera/projected visibility, occlusion, removal error, and temporal adaptation. Experiment 02's quality drop at low budgets is consistent with these limits.
- Proposed, but did not implement, a global training-view aggregated opacity-gradient ranking at the same six budgets. The test split stays held out. The report labels this a gradient proxy (not exact removal sensitivity/PUP), and flags the need for a small memory/gradient pilot on the 6 GB GPU.
- No source, model, dataset, baseline/benchmark output, or renderer was modified. No rendering, training, package installation, or download occurred.

## Gradient Sensitivity Feasibility Audit (2026-11-20)

Created GRADIENT_SENSITIVITY_FEASIBILITY_AUDIT.md from read-only inspection of GaussianModel, renderer, custom rasterizer autograd/CUDA backward, and training loss.

- Confirmed raw opacity is an (N,1) logit parameter and get_opacity returns sigmoid(raw opacity). The custom backward returns per-Gaussian opacity gradients. Raw-logit gradient differs from the requested activated-opacity derivative by the sigmoid factor alpha(1-alpha).
- Recommended a detached leaf activated-opacity proxy in a separate script, direct torch.autograd.grad(loss, alpha_leaf), detached non-opacity parameters, no optimizer/backward-step, and per-view incremental absolute-gradient aggregation. No source/CUDA changes are needed.
- Proposed the existing training RGB loss (L1 + 0.2 DSSIM) as the primary score objective; no gradient was computed.
- Estimated CUDA backward output tensors at about 586 MiB for 2.05M degree-3 Gaussians (75 float channels per Gaussian, plus possible inverse-depth gradient). Combined with the measured 1.31 GiB forward peak this is only a planning lower bound, not an observed backward peak. One-view RTX 3050 VRAM feasibility needs a pilot.
- Recommended a deterministic 32-view training-camera stability check followed by all 219 training views if memory allows; aggregate one view at a time into a CPU score vector (~7.82 MiB). Reserve the same 32 test views for final evaluation.
- Provided explicitly labeled, unmeasured runtime planning estimates, fair comparison design for all six Gaussian budgets, and risks/limitations.
- No score computation, render, training, source/model/dataset/experiment modification, package installation, or download occurred.

## Single-View Gradient Sensitivity Memory Pilot (2026-11-21)

Created and ran experiments\sensitivity_pilot\gradient_memory_pilot.py for exactly one deterministic training camera: index 0, image 000002.jpg, 979 × 546.

- A separate proxy supplied a detached, cloned activated-opacity leaf to the unchanged renderer. Existing fused training loss (0.8 L1 + 0.2 DSSIM) and torch.autograd.grad() were used. No optimizer, loss.backward(), or parameter update was invoked.
- Gradient result: shape (2,050,123,1), float32; all 2,050,123 values finite; 693,897 nonzero; min −0.0154180; max 0.00896856; mean absolute 2.99896e-7; median absolute 0.
- Timings with CUDA synchronization: forward+loss 2.9283 s; gradient 0.3361 s; total 3.2664 s. First call had no warm-up. An unsaved normal render afterward passed in 0.0425 s.
- Pre-forward memory: 519,024,128 allocated / 811,597,824 reserved bytes; nvidia-smi 914 MiB used, 5,089 MiB free. Peak: 2,020,045,824 allocated / 2,057,306,112 reserved bytes. After cleanup: 8.125 MiB allocated / 20 MiB reserved; after process exit nvidia-smi returned to 0 MiB used / 6,002 MiB free.
- Parameter values and tensor identity/storage/version checks passed. SHA-256 checks for checkpoint, PLY, renderer, GaussianModel, and rasterizer sources matched before/after. No image was saved.
- Machine-readable results are in experiments\sensitivity_pilot\pilot_results.json; report is SENSITIVITY_MEMORY_PILOT_REPORT.md. No multi-view scoring was performed.

## 10-View Sensitivity Accumulation Pilot (2026-11-21)

Completed exactly ten deterministic training-camera gradient passes for the 30,000-iteration baseline. Sampling used equal intervals including both ends of the lexicographically sorted, unshuffled 219-camera training list: loader indices/camera IDs 0, 24, 48, 73, 97, 121, 145, 170, 194, 218 (images 000002.jpg, 000029.jpg, 000056.jpg, 000085.jpg, 000112.jpg, 000140.jpg, 000167.jpg, 000196.jpg, 000223.jpg, 000251.jpg).

- Per-view activated-opacity gradients used the existing RGB loss `0.8 * mean_L1 + 0.2 * (1 - SSIM)` and `torch.autograd.grad`; no optimizer step or parameter update occurred.
- All ten views completed with finite gradients. Score vector has 2,050,123 nonnegative finite CPU float32 values; 200,910 (9.7999%) are zero. Maximum 0.003497158642858267; mean 2.649858288350515e-7; median 5.2522878490890434e-8; population standard deviation 6.440523065975867e-6.
- Peak CUDA memory: 2,062,716,416 bytes allocated / 2,105,540,608 bytes reserved. CPU score accumulator: 8,200,492 bytes; process RSS after scoring: 3,540,074,496 bytes. Total run time: 16.6842 seconds.
- `.pt` and `.npy` score files were independently loaded and found identical; shape, dtype, CPU placement, finite/nonnegative/nonzero checks and top-10 ranking validation passed. Checkpoint, model PLY and inspected source hashes match before/after; Gaussian parameter identity/version/grad-state checks passed.
- The ten passes and score artifacts completed before a final JSON bookkeeping `KeyError` (uninitialized integrity metadata). Results were independently verified and metadata repaired without rerunning gradients. The script now initializes the integrity record. Its computation-time SHA-256 and corrected-final-script SHA-256 are both recorded in `pilot_results.json`.
- Deliverables: experiments\sensitivity_10view_pilot\compute_sensitivity_10views.py, sensitivity_scores_10views.pt, sensitivity_scores_10views.npy, pilot_results.json, and SENSITIVITY_10VIEW_PILOT_REPORT.md. No training, test-view scoring, all-219-view scoring, rendering outputs, or Top-K benchmark was performed.

## Full 219-View Sensitivity Accumulation (2026-11-21)

Computed the requested global activated-opacity gradient scores over all 219 training cameras in deterministic lexicographic image-name order (loader indices 0-218; `shuffle=False`), exactly once each, at 979 x 546 using the iteration-30000 baseline and existing renderer.

- Per-view loss: `0.8 * mean_L1 + 0.2 * (1 - SSIM)` using fused_ssim. Gradients used a detached activated-opacity leaf and `torch.autograd.grad`; absolute values were accumulated sequentially in CPU float32 and divided by 219. No optimizer was created or called, and no model parameters changed.
- All 219 views completed with 2,050,123 finite gradient entries each. Final 2,050,123-score vector is finite, nonnegative, nonzero, on CPU; `.pt` and `.npy` contents match exactly.
- Score summary: min 0; max 0.001772217801772058; mean 2.531939742311806e-7; median 7.15574657306206e-8; population std 4.391141374071594e-6; zero scores 48,011 (2.34186%).
- Top Gaussian IDs: 1838749, 1838952, 84544, 1595792, 20060, 1045672, 1838847, 635823, 618485, 1804839. Full top 100 and scores are in the experiment output.
- Runtime 62.9551 s (0.2760 s/view end-to-end; average forward/loss 0.06593 s, gradient 0.08074 s). Peak CUDA 2,066,010,112 allocated / 2,116,026,368 reserved bytes. CPU score vector 8,200,492 bytes; process RSS after scoring 3,555,721,216 bytes. Post-cleanup CUDA: 11,018,752 allocated / 44,040,192 reserved bytes; nvidia-smi 182 MiB used / 5,821 MiB free.
- Baseline checkpoint, inference PLY, and inspected source hashes matched before/after. Per-tensor model parameter hashes and identity/version/grad-state checks passed.
- Deliverables: experiments\sensitivity_full_219views\compute_sensitivity_219views.py, sensitivity_scores_219views.pt, sensitivity_scores_219views.npy, per_view_results.csv, sensitivity_summary.json, top_100_gaussians.csv, and SENSITIVITY_FULL_219VIEW_REPORT.md. No model training, benchmark rendering, or Top-K benchmark was performed.

## Sensitivity vs. Opacity Ranking Analysis (2026-11-21)

Completed a read-only comparison of activated opacity from the iteration-30000 PLY and the full 219-view sensitivity vector. Activated opacity was calculated by applying `torch.sigmoid` to the PLY's raw opacity logits, matching Graphdeco's `get_opacity`; score order remained aligned to PLY/Gaussian IDs.

- Tie-aware Spearman (average ranks): -0.067878. Raw Pearson: -0.020536. Log10 Pearson on positive pairs: -0.113755 (2,002,112 pairs; 48,011 zero-sensitivity pairs excluded).
- Top-K shared set counts for 100/75/50/25/10/5%: 2,050,123 / 1,175,062 / 483,046 / 66,304 / 4,051 / 799. Overlap at 5% is 0.7795% of the selected set (Jaccard 0.00391).
- Sensitivity has 48,011 exact zero scores (2.3419%); opacity has no zero scores. Mean absolute positional rank difference is 707,327; full directional examples are in the CSV.
- Visualizations, metrics, overlap/disagreement CSVs, and script are under experiments\sensitivity_ranking_analysis. Existing fixed-opacity benchmark metrics are cited for context only; no rendering or benchmarking was done.
- Input hashes were unchanged. No checkpoint, model, score file, benchmark output, or repository source was modified.

## Sensitivity-Guided Global Top-K Benchmark (2026-11-21)

Ran the separate sensitivity-ranked benchmark against the existing fixed-opacity results. Used the 30K baseline PLY inference model and full 219-view activated-opacity gradient scores; selected one camera-independent global ranking and rendered all 32 held-out test views at each exact fixed benchmark count.

- Test order and correspondence were verified against the fixed benchmark's 100% per-view records, saved baseline GT PNGs, and camera-loaded images before rendering. Full-resolution test renders used the unchanged Graphdeco renderer/rasterizer.
- Used one warm-up view per budget, then three 32-view timing repetitions with the same seeded budget permutation as Fixed Top-K. Synchronized render-call FPS excludes selection and PNG writing; ranking, per-budget gather, and combined one-pass selection/render times are reported separately.
- 100% sensitivity output was pixel-identical to all 32 baseline render PNGs; mean PSNR/SSIM matched at 25.5404/0.88525.
- Sensitivity PSNR/SSIM at 75/50/25/10/5%: 24.1068/0.87247, 21.4538/0.82521, 17.0807/0.71168, 13.8959/0.58295, 12.5286/0.51335. Corresponding fixed-opacity values are retained in the comparison report/CSV. Sensitivity was lower at 75-25%, higher at 10-5%; no general superiority claim is made.
- Sensitivity synchronized render FPS at 100/75/50/25/10/5%: 22.72/32.83/36.12/44.11/36.34/50.99. Timing at 100% differed from the separate fixed run despite identical pixels; cross-run speed differences are interpreted cautiously.
- All six ID sets passed count, uniqueness, valid-range, and descending-score checks. 192 per-view metric rows and 576 timing samples were produced. LPIPS was unavailable from local cached dependencies/weights; no install/download was attempted.
- Before/after integrity checks matched for checkpoint, final PLY, sensitivity score file, renderer/rasterizer sources, baseline config/metrics/test assets, and checked Fixed Top-K result files/render outputs. Existing fixed results were read-only.
- Deliverables are in experiments\sensitivity_topk_benchmark, including benchmark script, aggregate/per-view metrics, timings, selected IDs, fixed-vs-sensitivity comparison, render images, visualization collage, integrity records, and SENSITIVITY_TOPK_BENCHMARK_REPORT.md. No training, source change, or view-dependent selection was performed.

## View-Dependent Scoring Feasibility Audit (2026-11-21)

Completed a read-only inspection of the Graphdeco model, camera, renderer, rasterizer binding/CUDA forward path, and existing fixed-opacity Gaussian subset implementation. No selector was implemented and no rendering, training, benchmark, sensitivity calculation, installation, or download was performed.

- `GaussianModel` exposes world-space XYZ, sigmoid activated opacity, exponentiated scale, normalized rotation, covariance and SH features. `Camera` exposes camera center and view/projection transforms. `gaussian_renderer.render` sends consistently indexed attributes to the existing rasterizer.
- Rasterizer Python outputs include rendered RGB, per-Gaussian radii and depth; `visibility_filter` is only `radii > 0`. CUDA internally composites per pixel, but does not expose per-Gaussian composited contribution. `in_frustum` tests near-plane depth (`z > 0.2`); lateral clipping is commented out.
- A separate chunked projected-footprint proxy is feasible without training or source/CUDA/renderer changes. Recommended proxy: viewport eligibility × clipped projected ellipse footprint × activated opacity, with a documented area cap, followed by percentile normalization and blending with the cached global sensitivity percentile. This estimates unoccluded screen-space footprint, not true composited contribution.
- Existing `experiments/fixed_topk/opacity_topk.py` demonstrates renderer-compatible subset gathering while preserving original IDs. Selection can remain optional and use the unchanged renderer.
- Sensitivity's skewed magnitude distribution makes min-max normalization fragile. Recommend average-tie percentile ranks with deterministic ID tie-breaking; explore blend weights as an ablation. Keep score construction deterministic and cache global sensitivity ranks and fixed-camera view scores by model/camera identity.
- The full audit, equations, cost estimates, implementation/validation plan, risks, and source references are in `VIEW_DEPENDENT_SCORING_FEASIBILITY_AUDIT.md`.

## View-Dependent Scoring Pilot (2026-11-21)

Implemented and ran the first standalone projected-footprint importance scorer for exactly training loader indices 0, 109, and 218 at native 979 x 546 resolution. The scorer uses Graphdeco's iteration-30000 model and camera pipeline; it does not call the renderer or rasterizer.

- Scoring formula: activated opacity times capped projected 2D Gaussian area (`2*pi*sqrt(det(Sigma2D))`, with the Graphdeco `0.3` covariance low-pass), image-area normalization, and an approximate clipped fraction of the rasterizer-matched 3-sigma support square. A score is zero unless center depth exceeds 0.2 and the projected support intersects the image. Covariance projection mirrors `computeCov2D`'s perspective Jacobian and `1.3*tan(FoV)` clamp. The report documents the square-clipping approximation and limitations.
- Used zero-anchored deterministic percentile normalization with average ranks for positive ties, and combined `0.5 * sensitivity_percentile + 0.5 * view_percentile`. The global sensitivity normalization is shared across views.
- Loaded 2,050,123 Gaussians, 219 training cameras, and 32 evaluation cameras. The checkpoint iteration was 30,000; loaded PLY XYZ rows matched checkpoint XYZ exactly (maximum difference 0), establishing stable Gaussian row IDs.
- Visible counts at indices 0/109/218: 1,197,844 / 1,332,169 / 1,142,791. Raw-score maxima: 0.1388373 / 0.1450815 / 0.1402078. Top-100 shared counts: 3 (0 vs 109), 0 (0 vs 218), 0 (109 vs 218). Tie-aware Spearman correlations: 0.75873, -0.00304, 0.03691 respectively. These indicate camera-dependent scores, not a rendering-quality claim.
- Verified all raw/normalized/combined values finite and in their expected ranges; recomputed normalized and combined vectors from saved raw scores and obtained exact array matches. Model parameter hashes and SHA-256 hashes for checkpoint, baseline PLY, sensitivity file, and 11 inspected Graphdeco source files matched before/after.
- Outputs are under `experiments/view_dependent_scoring_pilot`: standalone script, three raw `.npy` vectors, three combined `.npy` vectors, camera JSON files with top-100 IDs/scores and XYZ, `pilot_summary.json`, `per_gaussian_camera_scores.npz`, and `VIEW_DEPENDENT_SCORING_PILOT_REPORT.md`.
- Script scoring run time was 201.06 seconds, including model/camera loading and checkpoint-row verification. No Top-K selection, benchmark, training, rendering, source modification, package installation, or download was performed.

## Sensitivity + View-Dependent Top-K Benchmark (2026-11-21)

Completed the camera-dependent combined importance benchmark on all 32 official test views, using the iteration-30000 Truck baseline, 2,050,123 Gaussians, native 979 x 546 images, and budgets 100/75/50/25/10/5%. Weights were alpha=0.5 and beta=0.5. Each camera recomputed its own projected-footprint score and combined ranking. The renderer and CUDA rasterizer were unchanged.

- The pilot's opacity-weighted projected-footprint proxy was reused and normalized with its deterministic zero-anchored percentile/midrank method. Global sensitivity was normalized once using the same method. This score is a projection/footprint proxy, not true composited contribution.
- Test camera order and loaded GT pixels matched the prior Fixed Opacity and Global Sensitivity Top-K runs. The 100% output was pixel-identical to baseline across all 32 views and matched baseline PSNR/SSIM.
- Distinct per-camera selected sets: 32 of 32 at every budget below 100%; 100% is the shared complete set. Exact rankings are saved as uint32 per-camera files and selected prefixes/counts are mapped in `selected_gaussian_ids.json`.
- Combined PSNR/SSIM at 100/75/50/25/10/5%: 25.5404/0.88525, 24.4076/0.87162, 21.0311/0.82429, 14.2176/0.68055, 12.5942/0.58188, 11.8009/0.51512. Combined PSNR beat global sensitivity only at 75% and beat fixed opacity only at 5%. At 5%, SSIM was slightly above global sensitivity. Results are mixed and do not support general superiority.
- Mean synchronized render-call FPS at 100/75/50/25/10/5%: 24.51/30.53/32.93/34.13/46.24/89.31. High standard deviations at 25% and 10% are reported. Score generation, view normalization, blending, and ranking across the 32-view sweep took about 34.4 seconds; uncached end-to-end FPS including this work was about 0.88-0.92 across budgets. Cached-score selection-plus-render FPS is reported separately.
- PSNR, SSIM, and timing were measured with the same saved-PNG Graphdeco metrics and three synchronized timing repetitions used in prior Top-K benchmarks. LPIPS was skipped because local weights were unavailable; nothing was downloaded or installed.
- Before/after SHA-256 digests matched for the checkpoint, baseline Gaussian PLY, global sensitivity scores, pilot scorer, fixed/global benchmark implementations, renderer, rasterizer sources, relevant model/camera/reader files, and prior benchmark outputs/test assets. `results/integrity.json` reports `all_hashes_match=true`.
- All new outputs are under `experiments/sensitivity_view_topk_benchmark`, including requested result CSVs, per-camera selection ranking manifest/files, rendered PNGs, comparison images, four plots, summary JSON, and `SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md`. No training, source/dataset/model modification, install, download, or deletion occurred.


## Sensitivity + View-Dependent Weight Sweep (2026-11-21)

Completed the controlled five-setting alpha/beta ablation across all 32 official Truck test views and 50/25/10/5% Gaussian budgets. The 30K baseline model and dataset were read-only; the original Graphdeco renderer and CUDA rasterizer were used. Each setting had three synchronized timing passes.

- Reused the previous combined benchmark's per-camera normalized view scores and the same deterministic percentile normalization. The view score remains an opacity-weighted projected-footprint proxy. No scoring formula changed.
- Sensitivity-only selected IDs matched the previous global Sensitivity Top-K manifests exactly. Equal-weight selected sets matched the previous combined benchmark for all views and budgets; PSNR/SSIM matched exactly. View-only selection was verified to rank by the normalized view scores alone.
- Independent ranking recomputation checked all 160 weight/camera rankings; every SHA-256 matched. Camera-specific settings produced 32 distinct sets per budget; sensitivity-only correctly produced one global set.
- Best PSNR and SSIM at 50% and 25% came from alpha=0.75/beta=0.25. Sensitivity-only had best PSNR at 10% and 5%. SSIM leaders were alpha=0.75/beta=0.25 at 10%, and alpha=0.5/beta=0.5 at 5%. View-only was lower than sensitivity-only at every budget. The 75/25 blend beat both individual methods on both metrics at 50% and 25%, but there was no universal best weight.
- Three-pass synchronized renderer FPS and end-to-end timings are separated. End-to-end includes score loading/normalization, blend/rank preparation, subset gathering, and rendering, while reusing cached view scores; it excludes the initial projected-footprint computation. LPIPS was not run because local weights were unavailable; no download or installation was attempted.
- Before/after SHA-256 checks matched for all 677 protected inputs and prior experiment artifacts. No model, checkpoint, dataset, source, CUDA, prior results, or baseline renders changed. No training or deletion occurred.
- Deliverables are under `experiments/sensitivity_view_weight_sweep`, including the benchmark driver, timing-accounting and repeatability scripts, 640 per-view metric rows, 1,920 synchronized render samples, aggregate/comparison CSVs, six plots, integrity/repeatability records, `benchmark_summary.json`, and `SENSITIVITY_VIEW_WEIGHT_SWEEP_REPORT.md`.

## Temporal Consistency Feasibility Audit (2026-11-21)

Completed the read-only temporal-consistency audit. The official 32 test views are the every-eighth sorted COLMAP image names (IDs 1, 9, ..., 249): a meaningful but sparse camera path, not timestamped video. Mean adjacent test-view motion is 2.395 COLMAP units / 36.80 degrees, versus 0.338 units / 5.78 degrees across all registered adjacent cameras. The sorted training-only path has 0.383 units / 6.58 degrees mean steps.

- Recomputed no-temporal selection stability using the validated alpha=0.75/beta=0.25 scores. On the 31 test-view transitions, mean overlap at 50/25/10/5% was 93.95/88.25/73.05/67.73%. On the denser 218-transition training-camera path, it was 98.15/96.38/91.66/89.94%, with mean Jaccard 0.9639/0.9308/0.8491/0.8212. The 219-camera score-and-rank analysis took 218.1 seconds and made no renderer calls.
- Recommended an explicit minimum-overlap constraint because its turnover bound and fixed-budget behavior are directly interpretable. Proposed no-temporal/weak/medium/strong retention thresholds of 0.00/0.90/0.95/0.98, with 10% and 25% as initial budgets, grounded in measured baseline churn. No temporal selector was implemented.
- Audited previous-selection bonus, switching penalty, hysteresis, and minimum-overlap selection. For fixed-size Top-K, the same bonus and penalty lambda induce the same ranking (they differ by a constant); overlap constraint is distinct and guarantees a minimum retained fraction.
- Reviewed camera ordering and poses, temporal metrics, image-based flicker limitations, Python-only state, memory/compute costs, lag risks, and exact Graphdeco/research source functions. Existing RGB renders alone do not provide a reliable flicker metric without depth/flow-aware warping.
- Before/after hashes matched for 10 protected model, dataset, score, and source files. No renderer, training, model/dataset/source/CUDA change, package installation, download, or deletion occurred.
- Report: `TEMPORAL_CONSISTENCY_FEASIBILITY_AUDIT.md`. Supporting trajectory, per-transition overlap, and 219-camera analysis files are under `experiments/temporal_consistency_feasibility_audit`.

## Temporal Selection Rendering Pilot (2026-11-21)

Completed the controlled rendering pilot on 20 evenly spaced, filename-ordered cameras from the 219-camera training path. The official test split was not used. The existing iteration-30000 Truck model (2,050,123 Gaussians), Graphdeco renderer, CUDA rasterizer, temporal selector, and 75/25 sensitivity/view score were used without modifying protected inputs.

- Evaluated baseline, Temporal Medium (R=0.95), and Temporal Strong (R=0.98) sequentially at 10% (205,012 Gaussians) and 5% (102,506). Temporal selections were generated in order along the same 20-camera subset for both budgets.
- The 5% Temporal Strong smoke render passed at 979x546 and confirmed the rasterizer received exactly 102,506 Gaussians. All 120 method/budget/camera outputs were saved and rendered three synchronized times for timing. Total renderer calls: 367 including smoke and warm-ups.
- Mean PSNR/SSIM by method and 10%/5% budget: baseline 13.1562/0.59473 and 11.5862/0.50711; medium 14.3171/0.61890 and 13.1013/0.55044; strong 14.3375/0.61841 and 13.1347/0.55076. These are 20 training-view pilot results, not test-set claims.
- Mean adjacent selection overlap at 10%/5%: baseline 67.86%/61.66%; medium 95.00%/95.00%; strong 98.00%/98.00%. These indicate set stability only. Camera-motion-dependent RGB frame differences were recorded separately and are not optical-flow-compensated flicker metrics.
- Mean render-call throughput was 80.18/71.17 FPS for baseline, 55.40/63.79 for medium, and 56.63/65.10 for strong at 10%/5%. Selection work (score generation, per-camera normalization/ranking, selector, and subset gather) averaged about 1.09–1.15 seconds per camera/configuration; adding this overhead yielded about 0.85–0.91 end-to-end FPS. Timings and accounting are fully defined in the report/CSV.
- Peak PyTorch memory ranged from 0.705–0.782 GiB allocated and 0.877 GiB reserved. An independent validator checked 120 selected-ID files, exact counts/unique IDs/bounds, all 114 transitions and retention constraints, 120 render image dimensions, and all 278 protected hashes. Integrity passed.
- Outputs, comparison sheets, plots, camera and selection manifests, metrics, smoke results, and integrity records are under `experiments/temporal_rendering_pilot`. Report: `TEMPORAL_RENDERING_PILOT_REPORT.md`. No training, package installation, download, dataset/model/source modification, or deletion occurred. No larger benchmark was run.

## Selection Pipeline Profiling (2026-11-21)

Completed a selection-only profile using five evenly spaced filename-ordered training cameras (indices 0, 54, 109, 164, 218), both established budgets (10% and 5%), and baseline, Temporal Medium (R=.95), and Temporal Strong (R=.98). Three repetitions were run after stage warm-ups. No renderer or rasterizer calls occurred.

- On this small sample, independent end-to-end selection pipeline means were 1.074–1.106 seconds per camera across all six method/budget conditions, consistent with the prior approximately 1.09–1.15 second estimate. The largest 10% Temporal Medium stages were projected-footprint scoring (398.74 ms, CUDA event 397.79 ms; 36.18% of measured total), per-view normalization (236.14 ms; 21.42%), and full CPU ranking (328.45 ms; 29.80%). Global sensitivity normalization cost 398.36 ms once and amortized to 79.67 ms/camera over this five-camera path; the pipeline already reuses it camera-independently.
- Temporal selection itself cost about 20–24 ms/camera (about 2%); selected-ID conversion/validation/transfer cost about 16–42 ms depending on K; subset gather took about 2.8–4.3 ms after warm-up. The selected-ID transfer device event was below 1 ms, so its remainder is CPU-side.
- `results/raw_stage_timings.csv` contains 333 samples; `aggregate_stage_timings.csv` contains per-stage distribution statistics and percent-of-total for each condition; `total_pipeline_repetitions.csv` contains 18 independent sequence timings. `visualizations/bottleneck_10pct.png` and `bottleneck_5pct.png` show stage timings.
- Correctness validation passed: repeated scores/normalization/rankings/selections were deterministic; all selected IDs met exact counts, bounds, uniqueness, and temporal retention requirements; common-camera selections matched the earlier rendering pilot where the sequence context was identical. Model tensor hashes matched before/after, and 278 protected source/model/dataset/previous-pilot hashes matched. Renderer calls: zero.
- Optimization feasibility notes are in `experiments/selection_pipeline_profiling/OPTIMIZATION_FEASIBILITY_ANALYSIS.md`. No optimization was implemented; caching, exact partial Top-K, stable GPU sorting, projected-score optimization, selector scratch reuse, and ID-copy reductions remain proposals only.
- Full report: `experiments/selection_pipeline_profiling/SELECTION_PIPELINE_PROFILING_REPORT.md`. No prior experiment was modified; no training, rendering benchmark, test-set use, installation, download, CUDA/system change, or deletion occurred.

## Temporal Selection Stability Pilot (2026-11-21)

Completed the selection-only minimum-overlap temporal pilot across all 219 filename-ordered Truck training cameras. No renderer calls, rendering, training, optimizer updates, package installation, download, or protected-file changes occurred.

- Combined scores used the existing normalized global sensitivity and per-camera projected-footprint scores with alpha=0.75 and beta=0.25. Tested fixed budgets of 50%, 25%, 10%, and 5% with minimum previous-selection retention levels 90%, 95%, and 98%, plus unconstrained baseline selection.
- All 16 conditions completed across 219 camera selections (218 valid transitions per condition). Mean overlap improved most at smaller budgets for stronger retention: at 10% budget, 91.665% baseline vs 92.362% / 95.047% / 98.000%; at 5%, 89.945% vs 91.417% / 95.001% / 98.000% for 90% / 95% / 98% retention.
- 11 selector unit tests passed. An independent replay verified all 16 exact-set delta logs and 3,504 frame states, selected counts, ID validity, log hashes, and retention constraints. The 20 protected-input hashes matched before and after.
- Simulation runtime was 414.22 seconds; scoring, normalization, and ranking took 221.49 seconds. No GPU/CPU memory telemetry or rendering performance was measured. Selection stability is not image quality or rendered temporal smoothness.
- Report: `experiments/temporal_selection_pilot/TEMPORAL_SELECTION_PILOT_REPORT.md`. Aggregate, per-transition, selected-ID delta manifest, integrity, and validation outputs are under `experiments/temporal_selection_pilot/results`; plots are in its `visualizations` directory. Earlier incomplete delta-log folders were preserved, and the final manifest references only the successful retry logs.

## Exact Partial Top-K Optimization (2026-11-21)

Completed a five-training-camera benchmark of exact deterministic Top-K alternatives on the existing 2,050,123-Gaussian Truck model. Kept the existing 0.75 sensitivity + 0.25 view-dependent score, 10%/5% budgets, and baseline / Temporal Medium (R=.95) / Temporal Strong (R=.98) selection rules. No rendering or rasterizer calls occurred.

- Benchmarked the original full NumPy lexsort, NumPy argpartition with deterministic boundary-tie repair, PyTorch CPU Top-K, and PyTorch CUDA Top-K. On baseline selection, NumPy argpartition ranked and selected 10% in 50.63 ms (6.48x faster than full sort) and 5% in 35.16 ms (9.33x). The corresponding measured single-condition pipeline speedups were 1.37x and 1.38x; common scoring/normalization costs remain dominant.
- All 120 outputs (5 cameras × 4 algorithms × 3 methods × 2 budgets) matched the full-sort reference in ordered Gaussian IDs. Exact K, uniqueness, bounds, repeat determinism, tie-boundary policy, and temporal retention checks passed. The eight exactness/unit tests passed.
- The six-configuration shared-score model yielded 1.202 s/camera for one reusable full sort and 1.127 s/camera for NumPy argpartition across all six conditions. Thus partial Top-K has a smaller benefit when one full ranking can be reused across many budgets/methods. CUDA Top-K was slower than NumPy argpartition in the measured CPU-wall pipeline due to transfer/synchronization and CPU tie repair.
- A pre-run SHA-256 manifest covered 2,904 files (10.26 GB) across the model, data, prior experiment outputs, original archive, and relevant source/rasterizer files. All protected hashes matched afterward; model tensor and sensitivity file hashes were unchanged.
- Report and artifacts are under `experiments/partial_topk_optimization`: `PARTIAL_TOPK_OPTIMIZATION_REPORT.md`, implementation and benchmark scripts, raw/aggregate timing CSVs, exact selection comparisons, deterministic tie tests, ID manifests, integrity verification, and visualizations. No previous experiment, training, dataset, source, or CUDA configuration was modified; no package installation or download occurred.

## View-Score Normalization Optimization (2026-11-21)

Completed an exact five-training-camera comparison of the existing average-tie percentile normalizer against sorted-unique/count implementations on NumPy CPU, PyTorch CPU, and PyTorch CUDA. Used the same filename-ordered cameras (indices 0, 54, 109, 164, 218), 10%/5% budgets, baseline and Temporal Medium/Strong configurations, the existing projected-footprint score, 0.75/0.25 combination, and exact partial Top-K selector. No rendering, training, rasterizer calls, test-view scoring, or full-camera scoring was performed in the final reported run.

- The fastest candidate was PyTorch CUDA unique/count normalization: 43.38 ms mean vs 247.41 ms for the existing NumPy normalizer (5.70x). H2D and D2H averaged 3.02 ms and 3.20 ms by CUDA events; device normalization averaged 36.63 ms. NumPy unique/count was 1.71x faster than reference; PyTorch CPU unique/count was slower.
- All five-camera normalized view-score vectors were bitwise identical across candidates (maximum absolute and relative difference 0). Combined scores, full rankings, and selected Gaussian sets were exact. All 360 repeated selection rows had exact K, unique in-range IDs, and matched the existing exact partial selector; temporal retention checks passed.
- End-to-end pipeline speedups for CUDA normalization were 1.26x–1.30x across temporal/budget settings (1.28x at 10% baseline; 1.30x at 5% baseline). The gain is smaller than normalization-only speedup because projected-footprint scoring and other pipeline stages remain.
- Six normalization determinism/tie tests passed. A pre-run SHA-256 manifest covered 3,043 files (10.34 GB); protected files, checkpoint, sensitivity scores, model parameters, and previous experiment outputs matched after the experiment.
- Report and artifacts are under `experiments/view_score_normalization_optimization`, including raw and aggregate timing, stage breakdowns, exactness comparisons, tests, visualizations, and integrity records. No prior experiment, original scorer, temporal selector, partial Top-K implementation, dataset, checkpoint, or CUDA/system configuration was modified; no packages or data were downloaded.
- Loader-scope disclosure: an initial discarded runner attempt used Graphdeco `Scene`, which opened test image files while instantiating evaluation cameras (no test scoring, selection, rendering, or metrics occurred). After detecting this, I reran and retained final results using the COLMAP split reader plus camera construction for only the five selected training images. The initial files were overwritten, and this limitation is documented in the optimization and integrity reports.

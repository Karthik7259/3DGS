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

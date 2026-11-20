# System Information

## Research Project
**Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting**

## Confirmed System Specifications

| Component | Value |
|-----------|-------|
| OS | Windows Build 26300 (Windows 11) |
| CPU | Intel i5-13450HX |
| RAM | 16 GB |
| GPU | NVIDIA GeForce RTX 3050 (Laptop) |
| VRAM | 6 GB (6144 MiB) |
| NVIDIA Driver | 581.86 |
| CUDA (driver-reported) | 13.0 |
| C: Drive Free | ~24.87 GB |
| D: Drive Free | ~26.06 GB |
| Project Location | D:\3DGS-Research |

## Tool Installation Status

| Tool | Status | Version | Path |
|------|--------|---------|------|
| Git | ✅ Installed | 2.47.0.windows.2 | C:\Program Files\Git\cmd\git.exe |
| Miniconda | ✅ Installed | conda 26.9.4 | D:\Miniconda |
| Anaconda | ⚠️ Path exists (C:\Users\karth\anaconda3 on PATH) but access denied | — | C:\Users\karth\anaconda3 |
| Python (system) | ✅ Installed | 3.11.9 | C:\Users\karth\AppData\Local\Programs\Python\Python311\python.exe |
| VS Build Tools 2022 | ⚠️ Partially installed — MSVC compiler (cl.exe) NOT found | — | C:\Program Files\Microsoft Visual Studio\2022\BuildTools |
| VS Enterprise 2022 | ⚠️ Minimal — only DIA SDK present, no VC tools | — | C:\Program Files\Microsoft Visual Studio\2022\Enterprise |
| Windows SDK | ✅ Installed | 10.0.22621.0 (latest) | C:\Program Files (x86)\Windows Kits\10 |
| CUDA Toolkit | ✅ Installed | 12.8 (V12.8.93) | C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8 |
| CMake | ✅ Installed | — | C:\Program Files\CMake\bin |

## GPU Status (nvidia-smi)

- GPU 0: NVIDIA GeForce RTX 3050 (Laptop), WDDM mode
- Temperature: 41°C
- Power: 9W / 75W
- Memory: 0 MiB / 6144 MiB used
- GPU Utilization: 1%
- Compute Mode: Default
- No running GPU processes

## Conda Environments

| Environment | Location | Status |
|-------------|----------|--------|
| base | D:\Miniconda | Active (read-only) |
| 3dgs | D:\Miniconda\envs\3dgs | Exists (not yet verified) |

## Known Issues

1. **Conda not on PATH** — `D:\Miniconda\Scripts` is not in the system PATH. Must use full path: `& "D:\Miniconda\Scripts\conda.exe"`.
2. **`.condarc` permission error** — `C:\Users\karth\.condarc` has a permission issue causing conda errors. Needs to be fixed before conda can fully operate.
3. **MSVC cl.exe missing** — Visual Studio 2022 BuildTools is installed but only has LLVM tools, not MSVC. The C++ desktop workload needs to be added.
4. **CUDA version note** — Driver reports CUDA 13.0 compatibility, but installed CUDA Toolkit is 12.8. This is normal (driver supports up to 13.0; toolkit 12.8 is the installed SDK).
5. **Anaconda remnants on PATH** — `C:\Users\karth\anaconda3` entries are on PATH but the directory may be inaccessible.

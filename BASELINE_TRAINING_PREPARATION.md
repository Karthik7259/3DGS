# Truck Baseline Training Preparation

**Prepared:** 2026-11-20  
**Dataset:** `D:\3DGS-Research\datasets\truck`  
**Repository:** `D:\3DGS-Research\gaussian-splatting`  
**Hardware:** NVIDIA RTX 3050 Laptop GPU (6 GB VRAM), 16 GB system RAM

## Dataset and loader recognition

The scene root contains `images/` and `sparse/0/`. `scene/Scene.__init__` recognizes any source directory containing `sparse/` as COLMAP. `scene/dataset_readers.py` first reads `sparse/0/images.bin` and `cameras.bin`, falling back to text files only if binary loading raises. It reads the 3D points from `points3D.bin` to create/load `points3D.ply`; in a normal training run, creating that PLY is a side effect in the dataset directory if it does not already exist.

The Truck files are present and previously verified: 251 JPG images, three COLMAP binaries, one `PINHOLE` camera, 251 registered image records, and 136,029 3D points. The original loader can recognize the structure and parse its model. `images.bin` names such as `000001.jpg` are joined to the default `images/` directory.

## Image and camera loading behavior

- `scene/dataset_readers.py::readColmapCameras` copies `width`, `height`, model, and focal parameters from the COLMAP camera record. For `PINHOLE`, it calculates horizontal and vertical FOV from `fx`, `fy` and the COLMAP width/height. It rejects camera models other than `PINHOLE` and `SIMPLE_PINHOLE`.
- `utils/camera_utils.py::loadCam` opens the image with PIL and uses the actual image size to choose the loaded pixel resolution.
- `--resolution -1` is the default. It automatically caps images wider than 1,600 px to 1,600 px; otherwise it keeps their actual size. Truck JPGs are 979×546, so the default keeps them at 979×546. `--resolution 1` explicitly also means original image size.
- `scene/cameras.py::Camera` stores the loaded image dimensions but uses the previously calculated COLMAP FOV to make the projection matrix. No code rescales the COLMAP intrinsics or FOV to match the JPG dimensions.

### Truck calibration scale mismatch

Truck's COLMAP camera says 1957×1091 with `[fx, fy, cx, cy] = [1163.254728, 1156.280405, 978.5, 545.5]`. The JPGs are 979×546. The calibration dimensions and principal point are nearly exactly twice the stored image dimensions. The loader retains the original FOV (`FovX ≈ 1.39870`, `FovY ≈ 0.88162`) and projects at the actual 979×546 render size. It does **not** halve focal lengths/principal point, adjust FOV, or otherwise reconcile this 2× scale.

Thus, the folder and file formats are loader-compatible, but the projection calibration does not match the pixel scale of the image files as loaded. `--resolution` only changes image resizing; it cannot correct this mismatch. Treat visual/quantitative results from an unmodified direct run as at risk until the calibration scale is investigated. This preparation made no data or source changes.

## Lightweight loading check

Used the existing `D:\Miniconda\envs\3dgs\python.exe` environment and repository code; no package was installed. Parsed all camera metadata through `readColmapCameras`, opened the first image, and instantiated one actual repository `Camera` object on CUDA.

- PyTorch: 2.11.0+cu128.
- CUDA available: yes.
- Device: NVIDIA GeForce RTX 3050 6GB Laptop GPU; reported total VRAM 6,441,926,656 bytes.
- Before one-camera load: 5,404,360,704 bytes free.
- After one-camera load: 5,320,476,624 bytes free.
- Camera records parsed: 251.
- Camera object loaded image: 979×546 on `cuda:0`; it retained the COLMAP-derived FOV above.
- The check did not initialize the full Scene, train, or render. `points3D.ply` was absent before and after; the check did not write to the dataset.

The default `python` on PATH is a separate CPU-only environment (PyTorch 2.2.2+cpu, and missing `plyfile`). Use the `3dgs` Conda environment for repository commands.

## Conservative baseline recommendation

The original 30,000-iteration recipe and SH degree 3 are not a conservative first run on a 6 GB GPU. Begin with a bounded 7,000-iteration run, native 979×546 image size, SH degree 2, and slower/less frequent densification. This reduces workload but cannot guarantee avoiding an out-of-memory condition; actual peak memory depends on Gaussian growth and other GPU use.

Suggested settings:

| Setting | Recommendation | Reason |
|---|---:|---|
| Image resolution | `--resolution 1` (native 979×546) | Already modest; default `-1` would also keep native size. |
| Iterations | `--iterations 7000` | Bounded initial baseline; below repository default 30,000. |
| SH degree | `--sh_degree 2` | Lower feature/memory load than default degree 3. |
| Densification start | `--densify_from_iter 500` | Repository default. |
| Densification end | `--densify_until_iter 5000` | Stops growth before the run ends. |
| Densification interval | `--densification_interval 200` | Less frequent growth than default 100. |
| Gradient threshold | `--densify_grad_threshold 0.0004` | More selective growth than default 0.0002. |
| Evaluation | `--eval`; at 1000, 3000, 7000 | Creates a held-out split (every eighth sorted image) and reports periodically. |
| Saving | At 7000 | Saves the final suggested checkpoint. |
| Output | `D:\3DGS-Research\output\truck_baseline_7k` | Separate, explicit run directory. |
| Viewer | `--disable_viewer` | Avoids optional GUI overhead for this initial run. |

The scene loader holds camera images on the selected data device; the default is CUDA. At 979×546, RGB float tensors for all 251 images alone are roughly 1.6 GB, with alpha masks and training allocations adding to that. A reasonable planning range for this configuration is about 4–6 GB peak GPU memory, with a real OOM risk near the 6 GB limit, especially during densification. This is an estimate, not a measured training result. Keep other GPU workloads closed. The 16 GB system RAM should be adequate for the image set and normal loader overhead, but leave room for the OS and Python/CUDA allocations.

## Exact suggested command (not run)

Run from PowerShell after activating the existing `3dgs` Conda environment:

```powershell
Set-Location D:\3DGS-Research\gaussian-splatting
python train.py `
  -s D:\3DGS-Research\datasets\truck `
  -m D:\3DGS-Research\output\truck_baseline_7k `
  --resolution 1 `
  --iterations 7000 `
  --sh_degree 2 `
  --densify_from_iter 500 `
  --densify_until_iter 5000 `
  --densification_interval 200 `
  --densify_grad_threshold 0.0004 `
  --eval `
  --test_iterations 1000 3000 7000 `
  --save_iterations 7000 `
  --disable_viewer
```

The output folder, `input.ply`, camera metadata, checkpoints, and normal training artifacts would be written only if this command is run. No training has been started.

## Risks and next decision

1. **Calibration mismatch is the main correctness risk.** The current repository loader leaves the approximately 2× camera/image size difference untouched. Image resizing flags cannot fix it. Resolve or explicitly accept that calibration issue before treating a direct run as a valid baseline.
2. **VRAM headroom is limited.** 6 GB is near the estimated peak range; densification can cause an out-of-memory failure. The recommended iteration/densification limits reduce exposure but do not guarantee success.
3. **Default Python is the wrong environment.** Invoke training in `3dgs`, which has the CUDA-enabled PyTorch build and loader dependencies.
4. **Training has side effects.** The loader may generate `datasets\truck\sparse\0\points3D.ply` if absent; output artifacts are written to the selected model path. Neither happened during this preparation.

No source code, dataset files, or packages were changed. No training or rendering was performed.

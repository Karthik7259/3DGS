# Baseline Training Dataset Preparation

**Date:** 2026-11-20  
**Original scene:** `D:\3DGS-Research\datasets\truck`  
**Isolated training scene:** `D:\3DGS-Research\training_data\truck_baseline`  
**Experiment output:** `D:\3DGS-Research\experiments\baseline_truck`

## Original dataset status

The original Truck scene had 255 files totaling 187,282,181 bytes (about 178.6 MiB) in three directories:

```text
truck/
├── images/                         251 JPG files, 979 × 546
└── sparse/
    └── 0/
        ├── cameras.bin
        ├── images.bin
        ├── points3D.bin
        └── project.ini
```

The original `sparse/0/points3D.ply` did not exist. The source tree had no symlink/junction/reparse points. The original ZIP was not accessed for modification.

## Physical copy and verification

Copied the dataset with Robocopy `/E /COPY:DAT` into the requested `training_data\truck_baseline` destination. The destination was absent before copying; no overwrite or merge occurred. No symlink or junction was created.

Before running the Graphdeco loader on the copy:

- File counts: original 255, copy 255.
- Directory counts: original 3, copy 3; relative directory structure matched.
- Missing files, extra files, size mismatches: none.
- SHA-256 was compared for every file; no mismatches were found.
- All 251 copied JPGs decoded successfully and were 979 × 546.
- Reparse points in the copy: none.

COLMAP binary SHA-256 values (original and copy matched both before and after loader preflight):

| File | SHA-256 |
|---|---|
| `sparse/0/cameras.bin` | `f183f5e1a0ddbca7bb4e1e12c74ee2939069ea69929710a5af0692d3f53e3ac5` |
| `sparse/0/images.bin` | `437cdb07de6e45ecb4bdf986f7faa0017148879437b66497145ecdb7ec31403e` |
| `sparse/0/points3D.bin` | `6ac9db28d60a3edd5e14c34e972ad2f4486f2925b0964f19c3ddb4d4cbf2069b` |

## Official loader preflight and generated files

Used the existing `D:\Miniconda\envs\3dgs` environment and repository code. The official `readColmapSceneInfo` loaded the copied scene with evaluation enabled:

- Training cameras: 219.
- Evaluation cameras: 32.
- Initial point cloud: 136,029 points.
- Scene extent: approximately 5.847915 COLMAP units.
- `cameraList_from_camInfos` constructed all 251 Graphdeco `Camera` objects and accessed all images at 979 × 546. Image tensors used CPU memory as specified by the planned `--data_device cpu` option; camera transforms were constructed with CUDA available.
- The proposed training arguments parsed successfully using the repository's `train.py` argument definitions.
- CUDA detected `NVIDIA GeForce RTX 3050 6GB Laptop GPU` (6,441,926,656 bytes reported). After camera loading, CUDA reported 5,320,476,624 bytes free.
- The requested output directory exists and accepted a 51-byte write probe. The probe is retained at `experiments\baseline_truck\.preflight_write_test.txt`; it can remain there during training.

As expected, the official reader generated `training_data\truck_baseline\sparse\0\points3D.ply` (3,673,017 bytes) from `points3D.bin`. It was created only inside the isolated copy. The original dataset still has no `points3D.ply` and retains its original 255 files and 187,282,181 bytes.

After loader preflight, the isolated copy contains 256 files totaling 190,955,198 bytes (original 255 copied files plus generated PLY). The experiment output directory currently contains only the 51-byte write-probe file; no model output was created.

Supporting verification artifacts are under `D:\3DGS-Research\validation`:

- `verify_truck_training_copy.py`
- `truck_copy_verification.json`
- `truck_copy_verification_run.txt`
- `baseline_copy_loader_preflight.py`
- `baseline_copy_loader_preflight.log`
- `baseline_copy_preflight_results.json`

## Disk usage

| Measurement | Result |
|---|---:|
| D: free before copy | 20,123,447,296 bytes (about 18.74 GiB) |
| Original dataset | 187,282,181 bytes (about 178.6 MiB) |
| Copy before loader-generated PLY | 187,282,181 bytes (about 178.6 MiB) |
| Copy after loader preflight | 190,955,198 bytes (about 182.1 MiB) |
| D: free after copy, PLY, and output probe | 19,931,860,992 bytes (about 18.56 GiB) |

Disk figures reflect available capacity reported by Windows and can vary slightly with filesystem allocation and other activity. There is ample room for the previously estimated training output budget.

## Exact next training command (not run)

The copy is already prepared, so no copy command is needed. From PowerShell:

```powershell
Set-Location 'D:\3DGS-Research\gaussian-splatting'
& 'D:\Miniconda\envs\3dgs\python.exe' train.py `
  -s 'D:\3DGS-Research\training_data\truck_baseline' `
  -m 'D:\3DGS-Research\experiments\baseline_truck' `
  --iterations 30000 `
  --resolution 1 `
  --sh_degree 3 `
  --data_device cpu `
  --eval `
  --test_iterations 7000 15000 30000 `
  --save_iterations 7000 15000 30000 `
  --checkpoint_iterations 7000 15000 30000 `
  --disable_viewer
```

This keeps the official iteration, SH, optimizer, and densification settings. `--data_device cpu` is the supported memory accommodation; evaluation creates a 219/32 split. Training is not started by this preparation.

## Integrity and scope

- Original dataset: unchanged; no generated PLY.
- Original ZIP: preserved and not modified.
- Graphdeco source: unchanged.
- The only loader-generated dataset file is the PLY inside the isolated copy.
- Output folder write probe is retained as described above.
- No training, rendering, package installation, downloads, or deletion occurred.

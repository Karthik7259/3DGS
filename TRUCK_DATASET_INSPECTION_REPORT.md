# Tanks and Temples Truck Dataset Inspection Report

**Inspection date:** 2026-11-20  
**Archive:** `D:\3DGS-Research\downloads\graphdeco_tandt_db.zip`  
**Extracted scene:** `D:\3DGS-Research\datasets\truck`

## Archive inspection and extraction

- Reopened the ZIP central directory and confirmed 1,072 total entries.
- Exact Truck subtree: `tandt/truck/` (259 ZIP entries, including directory entries).
- Extracted only that subtree, removing the archive prefix so the scene root contains `images/` and `sparse/` directly.
- The destination directory existed and was empty before extraction.
- The ZIP was not modified. No other scene or archive subtree was extracted.

## Extracted files and storage

| Item | Result |
|---|---:|
| Files | 255 |
| JPG images | 251 |
| COLMAP binary files | 3 |
| Configuration file | 1 (`sparse/0/project.ini`) |
| Total extracted file size | 187,282,181 bytes (about 178.6 MiB) |
| D: free after extraction | 20,126,486,528 bytes (about 18.75 GiB) |

## Images

- Count: 251.
- Extensions: `.jpg` (251).
- Resolution: all 251 are 979 × 546 pixels.
- Readability: every image was opened and decoded successfully using the installed Pillow library.
- Corruption check: none detected (`Image.verify()` passed on every file).

## COLMAP reconstruction

Files present under `sparse/0/`:

- `cameras.bin`
- `images.bin`
- `points3D.bin`
- `project.ini`

Parsed using the repository's existing `utils/read_write_model.py` reader:

- Camera count: 1.
- Camera 1 model: `PINHOLE`.
- Parameters `[fx, fy, cx, cy]`: `[1163.254728, 1156.280405, 978.5, 545.5]`.
- Camera metadata dimensions: 1957 × 1091.
- Registered images: 251; image names resolve to the image set, beginning with `000001.jpg`.
- 3D points: 136,029.
- Structural checks: every registered image references an existing camera; each 3D point has aligned image-ID and 2D-observation-index tracks; all 251 images have 3D observations.
- Result: the binary sparse reconstruction is readable and internally consistent under these checks.

## Compatibility with original Graphdeco 3D Gaussian Splatting

**Direct scene layout and format: compatible.** The original repository's scene reader looks for `images/` and `sparse/0/{cameras.bin,images.bin,points3D.bin}`. It supports `PINHOLE`, and all required paths and binaries are present. From `D:\3DGS-Research\gaussian-splatting`, the scene path is:

```powershell
python train.py -s D:\3DGS-Research\datasets\truck
```

Training was not run.

**Resolution/calibration caveat:** the COLMAP camera dimensions (1957 × 1091) are roughly twice the stored image dimensions (979 × 546), and the principal point in the binary model is centered on the larger dimensions. The Graphdeco loader reads FOV from the COLMAP camera dimensions and intrinsics, while the image files are lower resolution. The repository can load the dataset layout and PINHOLE data directly, but this scale mismatch may affect camera projection alignment. No files or calibration were changed; assess this before relying on quantitative results.

## Restrictions observed

- Original ZIP retained and not modified.
- Only the Truck subtree was extracted.
- No downloads, package installations, training, or rendering were performed.
- Original 3DGS source code was not modified.

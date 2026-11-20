# Dataset Selection Report

**Planning date:** 2026-11-20  
**Refresh date:** 2026-11-20  
**Project:** Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting  
**Workspace:** `D:\3DGS-Research`  

## Storage audit

Free disk space at planning time:

| Drive | Free space |
|---|---:|
| C: | 17.31 GB |
| D: | 19.56 GB |

Current project size:

| Path | Size |
|---|---:|
| `D:\3DGS-Research` | 614.20 MB / 0.60 GB |
| `D:\3DGS-Research\gaussian-splatting` | 614.09 MB / 0.60 GB |

The dataset plan keeps the archive and extraction under D:.

Existing dataset folders:

- `D:\3DGS-Research\datasets`: missing
- `D:\3DGS-Research\downloads`: missing

No dataset has been downloaded or extracted.

## Dataset requirements

The original Graphdeco repository accepts two scene types:

1. A COLMAP scene
2. A NeRF Synthetic/Blender scene

### COLMAP structure

The required COLMAP directory layout is:

```text
<scene>
|-- images
|   |-- <image 0>
|   |-- <image 1>
|   `-- ...
`-- sparse
    `-- 0
        |-- cameras.bin
        |-- images.bin
        `-- points3D.bin
```

The loader also accepts text versions of the camera and image files.

Supported intrinsics are `SIMPLE_PINHOLE` or `PINHOLE`. The loader rejects other camera models.

### Blender/NeRF Synthetic structure

The NeRF Synthetic loader expects:

```text
<scene>
|-- transforms_train.json
|-- transforms_test.json
|-- train
|   `-- r_*.png
|-- test
|   `-- r_*.png
`-- (optional) val
```

It reads Blender/NeRF camera-to-world matrices and camera angle, converts the axes to COLMAP-style world-to-camera matrices, and generates a random initial point cloud if no PLY exists. It does not require COLMAP.

### Passing a dataset to `train.py`

The source is passed with `-s` or `--source_path`:

```text
python train.py -s <dataset-scene-directory>
```

For a COLMAP scene, use `-i images` when a custom image directory name is needed. For the recommended preprocessed Truck scene, the default `images` directory should be sufficient.

`--eval` enables the Mip-NeRF-style train/test split. For a 7k baseline, `--test_iterations -1` avoids test-set memory spikes.

## Recommended scene

**Recommended: Tanks and Temples — Truck**

Reasons:

- It is a real-world dataset, unlike NeRF Synthetic.
- It is commonly used with 3DGS and directly covered by Graphdeco's official dataset archive.
- It has approximately 251 images, fewer than Train's approximately 301.
- Its provided image set is relatively low-resolution, approximately 980×545.
- The Graphdeco archive is 682,628,995 bytes (651 MiB) and is much smaller than the Mip-NeRF 360 Pt. 1 archive.
- It contains an official COLMAP sparse reconstruction, so `convert.py` is not required.
- It avoids the synthetic random-point-cloud initialization and is therefore more suitable for a real-world Gaussian-selection study.
- It is plausible for 6 GB VRAM at a 7k baseline with the `-r 2` fallback if needed.

This recommendation prioritizes real-world suitability and acquisition size rather than choosing a synthetic scene solely for low storage use.

This is the best combination for this hardware because it requires only the Graphdeco 651 MiB T&T archive, includes a real-world COLMAP reconstruction, and has fewer images and lower resolution than the other official T&T choice (`Train`).

The Mip-NeRF 360 Bonsai scene is a valid smaller scene by view count, but obtaining it requires the 11.68 GiB Pt. 1 archive or a separate scene package. The NeRF Synthetic Lego scene is smaller and simpler but is synthetic and less suitable for evaluating real-world Gaussian selection.

## Dataset alternatives

| Candidate | Type | Views | Size estimate | Why not first choice |
|---|---|---:|---:|---|
| **T&T Truck** | Real-world COLMAP | ~251 | Official archive 651 MiB; extracted planning reserve 1–2 GB | **Selected** |
| T&T Train | Real-world COLMAP | ~301 | Same official archive 651 MiB | Slightly more views and complexity |
| Mip-NeRF 360 Bonsai | Real-world COLMAP | 121 | Pt. 1 archive 12.535 GB; scene is smaller by view count but archive is much larger | Consumes most D: even before extraction |
| NeRF Synthetic Lego | Synthetic Blender | 100 train plus test/val | Full archive approximately 1.68 GB | Real-world criterion is not met; 100 train views plus test/val views add frames without COLMAP |

### Storage evidence

HTTP metadata verified:

- Graphdeco `tandt_db.zip`: 682,628,995 bytes, 651 MiB
- Mip-NeRF 360 Pt. 1 `360_v2.zip`: 12,535,427,936 bytes, 11.68 GiB
- Mip-NeRF 360 Pt. 2 `360_extra_scenes.zip`: 4,488,140,217 bytes, 4.18 GiB

The NeRF Synthetic full archive is approximately 1.68 GB according to publicly mirrored archive metadata. It is not the smallest archive available once the Graphdeco T&T package is considered.

## Official source

Official Graphdeco download:

```text
https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip
```

The repository README identifies this archive as `T&T+DB COLMAP (650MB)`.

The archive includes prepared COLMAP/Tanks-and-Temples and Deep Blending scenes. This planning step does not download it.

## Truck acquisition details

Planning values:

- Scene: `truck`
- Image count: approximately 251
- Image resolution: approximately 980×545
- Archive type: ZIP
- Compressed download: 682,628,995 bytes / 651 MiB
- T&T/DB archive extracted planning reserve: 1–2 GB
- Recommended working location: `D:\3DGS-Research\datasets\tandt_db`

The exact extracted size of the Truck-only folder could not be determined without opening/extracting the archive. A safe storage reservation is to retain 3 GB free on D: for ZIP plus extraction and early output.

The repository evaluation script uses original/full T&T images for Truck rather than the `images_2`, `images_4`, or `images_8` folders.

## Recommended resolution

Recommended for the first baseline:

- Start at the original approximately 980×545 resolution
- Use `-r 1`
- Do not use `--eval` for the shortest first baseline. It withholds a test set and may add testing overhead; add it later for a proper train/test evaluation.
- Use `--test_iterations -1` for the first 7k baseline to avoid test-set memory spikes
- Use `-m D:\3DGS-Research\output\truck_baseline_7k`

Fallback for 6 GB VRAM:

- `-r 2` reduces the source to approximately 490×273
- This is useful if the original resolution triggers out-of-memory errors
- Keep 7k iterations and the same split/settings for comparability

Do not use `-r 4` or `-r 8` for the first baseline unless memory remains insufficient.

## Preprocessing

The official archive is preprocessed and ready for COLMAP loader use.

No `convert.py` run is required after extraction if the Truck folder contains:

```text
truck
|-- images
|-- sparse
|   `-- 0
|       |-- cameras.bin
|       |-- images.bin
|       `-- points3D.bin
```

If text-format reconstruction files are present instead, the repository loader will fall back to:

```text
sparse/0/cameras.txt
sparse/0/images.txt
```

If those files are missing or the archive layout differs, use `convert.py` only after approval and only for this dataset; do not reconstruct or resize files by default.

## Expected extraction structure

After extracting the official archive and selecting Truck:

```text
D:\3DGS-Research\
|-- downloads\
|   `-- tandt_db.zip
`-- datasets\
    `-- tandt_db\
        |-- truck\
        |   |-- images\
        |   `-- sparse\
        |       `-- 0\
        |           |-- cameras.bin
        |           |-- images.bin
        |           `-- points3D.bin
        |-- train\
        `-- drjohnson\
        `-- playroom\
```

The exact names and contents should be verified after extraction; no extraction is authorized here.

## Safe acquisition commands

After approval:

```powershell
New-Item -ItemType Directory -Force D:\3DGS-Research\downloads
New-Item -ItemType Directory -Force D:\3DGS-Research\datasets
curl.exe -L "https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip" -o "D:\3DGS-Research\downloads\tandt_db.zip"
Expand-Archive -LiteralPath "D:\3DGS-Research\downloads\tandt_db.zip" -DestinationPath "D:\3DGS-Research\datasets\tandt_db" -Force
```

`Expand-Archive` is safe for a standard ZIP. Verify it first rather than deleting or overwriting existing directories.

## Exact baseline command

After extraction and structure verification:

```text
python train.py -s D:\3DGS-Research\datasets\tandt_db\truck -m D:\3DGS-Research\output\truck_baseline_7k -r 1 --iterations 7000 --test_iterations -1 --save_iterations 7000 --disable_viewer --quiet
```

Fallback if 6 GB VRAM is insufficient:

```text
python train.py -s D:\3DGS-Research\datasets\tandt_db\truck -m D:\3DGS-Research\output\truck_baseline_7k_r2 -r 2 --iterations 7000 --test_iterations -1 --save_iterations 7000 --disable_viewer --quiet
```

Do not use `--eval` for the first 7k baseline unless test splitting is intentionally desired.

## Next action

Wait for approval before:

1. Creating download/extraction folders
2. Downloading `tandt_db.zip`
3. Extracting the archive
4. Confirming the Truck scene structure
5. Starting `train.py`

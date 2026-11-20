# Truck Dataset Download Report

**Completed:** 2026-11-20  
**Project:** `D:\3DGS-Research`

## Download source

Official Graphdeco source:

```text
https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip
```

No mirror or additional dataset source was used.

## Download method

Portable tool:

```text
D:\3DGS-Research\tools\aria2\aria2-1.37.0-win-64bit-build1\aria2c.exe
```

Options used:

```text
-c
-x 8
-s 8
-k 1M
--file-allocation=none
--summary-interval=10
--console-log-level=notice
```

## Storage

- D: free before download: 19.50 GB
- D: free after download: 18.92 GB
- Archive destination: `D:\3DGS-Research\downloads\graphdeco_tandt_db.zip`

## Resume and completion

- Existing partial size: 53.07 MiB
- Resumed at 15:47:07
- Completed at 16:18:02
- Elapsed: approximately 30 minutes 55 seconds
- Downloaded from partial to complete: approximately 598 MiB
- Eight split connections were active during transfer
- Final aria2 status: OK/download completed
- Average aria2 speed: 330 KiB/s

Speed samples:

- Initial: 885 KiB/s
- At two-minute stage: approximately 334 KiB/s
- Near final stage: 80–94 KiB/s
- Final average: 330 KiB/s

Parallel connections were working; the connection count reached `CN:8`.

## Final archive

- Final size: 651.01 MiB
- Final length: 682,628,995 bytes
- SHA-256:
  `816E62F22A161ABBFE841D2A6B10CDF036E297C9FA289B3BFEEE9C6EC526D7E1`

No official Graphdeco checksum was confirmed for this aggregate archive. The SHA-256 above is the locally calculated hash, not an official published checksum.

## ZIP integrity

Python `zipfile.testzip()` reported:

```text
entries=1072
bad_entry=None
```

The central directory is valid and no corrupt entry was found.

## Archive structure

Top-level roots:

- `tandt/`
- `db/`

Second-level scenes:

- `tandt/truck/`
- `tandt/train/`
- `db/drjohnson/`
- `db/playroom/`

Truck was inspected from the ZIP central directory without extraction.

## Truck contents

- Truck entries: 259
- JPG images: 251
- JPG resolution: 979 × 546 for all 251 images
- Camera file: `tandt/truck/sparse/0/cameras.bin`
- Image poses: `tandt/truck/sparse/0/images.bin`
- Sparse points: `tandt/truck/sparse/0/points3D.bin`
- Project file: `tandt/truck/sparse/0/project.ini`

The Truck scene already contains a complete `images/` directory and COLMAP binary reconstruction files. It is directly compatible with the original Graphdeco loader if the archive is extracted with `tandt/truck` as the scene root.

The archive was not extracted, and no preprocessing was performed.

## Graphdeco compatibility assessment

Compatible with:

```text
python train.py -s D:\3DGS-Research\datasets\tandt_db\tandt\truck
```

if extracted with the archive's existing structure under `D:\3DGS-Research\datasets`.

After approval and extraction, the scene could be located under either:

```text
D:\3DGS-Research\datasets\tandt_db\tandt\truck
```

or the Truck folder could be placed directly at:

```text
D:\3DGS-Research\datasets\truck
```

No extraction or folder move was performed in this stage.

## Restrictions respected

- No extraction
- No training
- No rendering
- No source modification
- No additional dataset download
- No package installation
- Archive remains in `D:\3DGS-Research\downloads`

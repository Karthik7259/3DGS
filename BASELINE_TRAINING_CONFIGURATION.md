# Truck Baseline Training Configuration

**Prepared:** 2026-11-20  
**Repository:** `D:\3DGS-Research\gaussian-splatting`  
**Original dataset (preserved):** `D:\3DGS-Research\datasets\truck`  
**System:** RTX 3050 Laptop GPU (6 GB VRAM), 16 GB RAM, Python 3.11.18, PyTorch 2.11.0+cu128, CUDA 12.8

## 1. Dataset configuration

The Truck scene is compatible with the official Graphdeco COLMAP loader:

- 251 JPG images at 979 × 546.
- One `PINHOLE` camera and 251 registered image poses.
- 136,029 initial sparse 3D points.
- With `--eval`, the loader sorts camera names and holds out every eighth image: 32 evaluation cameras and 219 training cameras.
- Without `--eval`, all 251 registered cameras are used for training and no held-out evaluation set is formed.
- The loader computes scene extent using training-camera centers. With the proposed 32-view evaluation holdout, the same calculation as `getNerfppNorm` gives a radius/extent of approximately 5.8479 in COLMAP world units.
- Native image size is already small. `--resolution 1` keeps all images at 979 × 546. Default `-1` would also leave them unchanged because the width is under the automatic 1,600-pixel cap.

**Preserve the original dataset:** `readColmapSceneInfo` writes `sparse/0/points3D.ply` into the source scene when it is absent. The original Truck folder currently has only the three COLMAP binary files and `project.ini` in `sparse/0`; the PLY is absent. A training run pointed directly at the original scene would add that file. The proposed command therefore points to a separate working copy and leaves the verified original unchanged.

Prepare that copy only when ready to train, and only if the destination does not already exist:

```powershell
robocopy 'D:\3DGS-Research\datasets\truck' 'D:\3DGS-Research\datasets\truck_baseline_input' /E
```

`/E` copies subdirectories without mirror/delete behavior. Confirm the copied tree contains `images\` and `sparse\0\` before running training. The 178.6 MiB copy is not created by this preparation task.

## 2. Official training behavior and GPU considerations

The inspected repository defaults and relevant behavior are:

| Behavior | Official default/implementation |
|---|---|
| Iterations | 30,000. Position learning-rate schedule also defaults to 30,000 steps. |
| SH degree | 3 maximum; training starts at degree 0 and raises the active degree every 1,000 iterations. |
| Resolution | `-1`; images wider than 1,600 px are reduced to 1,600, otherwise original image size is used. |
| Gaussian initialization | Every point from the COLMAP sparse cloud initializes a Gaussian (136,029 here); initial scales are estimated with `distCUDA2`, rotations are identity, and opacity starts at 0.1. |
| Densification | Track screen-space gradients starting at iteration 500, clone/split at intervals of 100 while before iteration 15,000, using threshold 0.0002. |
| Pruning | `densify_and_prune` removes low-opacity points and applies size/radius pruning as implemented by the repository; the size threshold is 20 after the opacity-reset interval. |
| Opacity reset | Every 3,000 iterations; reset caps activated opacity at 0.01. |
| Optimizer | Default Adam; no sparse optimizer requested. |
| Viewer | Enabled by default; proposed command disables its GUI server. |
| Evaluation | Disabled by default. With `--eval`, every eighth sorted image is held out. Evaluation calls the renderer for test metrics; it does not write rendered image files by default. |
| Save/checkpoint | Default PLY saves at 7,000 and 30,000; final `--iterations` is appended to save iterations. Checkpoints are off unless `--checkpoint_iterations` is set. PLY saves contain model parameters; `.pth` checkpoints include captured model state and optimizer state. |

The renderer allocates screen-space point tensors and rasterization buffers, and computes visibility, tile/binning, image, and gradient data. Gaussian parameters, Adam state, clone/split operations, and densification-time temporary tensors grow with the number of Gaussians. These are the principal GPU-memory risks.

All camera images are normally loaded onto CUDA because `data_device` defaults to `cuda`. At 979 × 546, holding the 251 RGB float images and alpha masks on CUDA is roughly 2.0 GiB before model and rasterizer allocations. The recommended `--data_device cpu` keeps those camera tensors in system RAM and copies the selected view to CUDA for each training step. This is an official loader option and does not change the loss, camera geometry, SH degree, optimizer, or densification algorithm. It increases host-to-device transfers and uses about 2 GiB for image/mask tensors in RAM, which is reasonable on a 16 GB system.

Planning estimate with CPU camera storage: approximately 3.5–5.8 GiB peak VRAM, but actual use depends strongly on Gaussian growth, renderer work buffers, and other GPU processes. A 6 GB card can still run out of memory; there is no guarantee from a non-training preflight. Close other GPU applications and monitor VRAM during the first run.

## 3. Recommended baseline parameters

Keep the Graphdeco algorithm defaults for the scientific baseline. The only runtime accommodations are native resolution, CPU camera storage, periodic evaluation/checkpoints, and disabling the optional GUI.

| Parameter | Recommendation | Status/reason |
|---|---|---|
| Iterations | 30,000 | Official default and full baseline schedule. |
| Resolution | 1 (979 × 546) | Explicitly fixes native image scale; matches current default behavior for this dataset. |
| SH degree | 3 | Official default; retain the standard appearance capacity. |
| Densification interval | 100 | Official default. |
| Densify from/until | 500 / 15,000 | Official defaults. |
| Densify gradient threshold | 0.0002 | Official default. |
| Opacity reset interval | 3,000 | Official default. |
| Optimizer | `default` Adam | Official default. |
| Image storage | CPU | Memory accommodation; no algorithm setting is changed. |
| Evaluation split | `--eval` | Deterministic sorted-name holdout: 32 test / 219 train. |
| Evaluation iterations | 7,000; 15,000; 30,000 | Periodic metric checks, including before/during/after densification. |
| PLY save iterations | 7,000; 15,000; 30,000 | Interim and final model snapshots. |
| Checkpoints | 7,000; 15,000; 30,000 | Recovery points including final iteration. These include optimizer state and need more disk than PLY saves. |
| Viewer | Disabled | Avoids an unused GUI server; does not alter training. |

Graphdeco's `safe_state` seeds Python/NumPy/PyTorch random generators and selects CUDA device 0. CUDA kernels may still have nondeterministic behavior, so record repository revision, exact command, package versions, and output `cfg_args` with any research result.

## 4. Exact commands to use when training is approved

First create the separate input copy as described above. Then run this in PowerShell:

```powershell
Set-Location 'D:\3DGS-Research\gaussian-splatting'
& 'D:\Miniconda\envs\3dgs\python.exe' train.py `
  -s 'D:\3DGS-Research\datasets\truck_baseline_input' `
  -m 'D:\3DGS-Research\output\truck_baseline_official_30k' `
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

The command has not been run. It is deliberately explicit about baseline defaults so `cfg_args` and the run command show the chosen configuration. `--resolution 1`, `--data_device cpu`, `--eval`, the three iteration lists, and `--disable_viewer` are the non-default choices. The repository creates the model output directory automatically; the proposed output path does not currently exist. Its parent can be created under the writable project root.

## 5. Storage estimate

Current measured free space on D: is **20,123,467,776 bytes (about 18.74 GiB)**. The original Truck dataset contains **187,282,181 bytes (about 178.6 MiB)**. Validation reports and images already present are included in the current free-space measurement.

Approximate model storage depends on final Gaussian count. At SH degree 3, each PLY vertex stores 62 float fields (about 248 bytes per Gaussian, plus header). A training checkpoint stores Gaussian parameters, statistics, and Adam moments (roughly 720 bytes per Gaussian before small serialization overhead).

| Artifact | Planning estimate |
|---|---:|
| Separate input copy | 178.6 MiB |
| Generated input `points3D.ply` | About 3.7 MB for 136,029 points |
| Each saved PLY, assuming 0.5–1.5 million Gaussians | About 124–372 MB |
| Each checkpoint, same count range | About 360 MB–1.08 GB |
| Three PLY saves plus three checkpoints | Roughly 1.5–4.5 GB, highly dependent on Gaussian count |
| Practical output budget | Reserve up to about 5 GB |
| Temporary disk headroom | Reserve another 1 GB for logs/partial writes; dominant scene/model temporaries are RAM/VRAM allocations |

After the input copy, a 5 GB output allowance, and 1 GB temporary headroom, approximately **13 GiB** of D: free space should remain. This is a planning estimate, not a measured 3DGS model size. Gaussian counts above 1.5 million can exceed it; check free space before starting and between checkpoints.

## 6. Dry-run checks completed

A preflight script under `validation\baseline_preflight.py` imported training definitions without entering `train.py`'s main block, instantiated the same argument parser, parsed the recommended flags, parsed the dataset camera metadata, and loaded one actual camera with `data_device=cpu`.

- Argument parsing: passed for all listed options.
- Dataset paths: current Truck `images/` and `sparse/0/` resolve.
- Cameras: 251 metadata records; proposed `--eval` split gives 219 train and 32 evaluation cameras.
- Camera load: passed at 979 × 546 with image tensor on CPU.
- CUDA: available; device is NVIDIA GeForce RTX 3050 6GB Laptop GPU; reported total VRAM 6,441,926,656 bytes.
- D: free: 20,123,467,776 bytes.
- Output path: absent, as expected. The repository's `prepare_output_and_logger` creates it at training startup. No output directory was created during preflight.
- The preflight did not instantiate a full `Scene`, since the official reader would create `points3D.ply` in the dataset. It did not allocate the full camera set on CUDA or execute any training iterations.

## 7. Risks and limitations

- VRAM headroom is limited. `--data_device cpu` frees the large set of camera tensors from CUDA but does not cap Gaussian growth or rasterizer temporary memory.
- The model-size estimate assumes 0.5–1.5 million Gaussians; the final count is data- and optimization-dependent.
- CPU camera storage may reduce throughput because image tensors are copied for each selected training view. This is a memory/runtime tradeoff only.
- The full scene-loading path was intentionally not executed because it would write a generated PLY. Preflight covered metadata and one actual camera object, not the complete initialization/training loop.
- Evaluation performs renderer calls at the listed steps to calculate metrics. No standalone render operation is part of this preparation.
- The original camera/image resolution relationship has passed the prior alignment validation; do not alter the images or calibration as part of this baseline configuration.

## 8. Pre-training checklist

- [ ] Confirm no existing `datasets\truck_baseline_input` folder; if it exists, inspect it before copying.
- [ ] Copy the verified dataset to `datasets\truck_baseline_input` using the non-mirroring command above.
- [ ] Confirm all 251 JPGs and `sparse\0\{cameras.bin,images.bin,points3D.bin}` exist in the copy.
- [ ] Confirm at least 6 GB free on D: for the input copy and output budget; current measured free space is about 18.74 GiB.
- [ ] Close other GPU workloads and confirm `torch.cuda.is_available()` in `3dgs`.
- [ ] Run the exact command and save its console log alongside the output.
- [ ] Monitor VRAM and D: free space, especially during densification through iteration 15,000.
- [ ] Keep the original `datasets\truck` and downloaded ZIP unchanged.

**Training status:** Not started. No rendering, source edits, dataset edits, downloads, package installation, or large output creation occurred during this preparation.

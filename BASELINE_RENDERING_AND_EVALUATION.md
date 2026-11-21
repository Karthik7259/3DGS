# Baseline Rendering and Evaluation

**Date:** 2026-11-20  
**Experiment:** `D:\3DGS-Research\experiments\baseline_truck`  
**Dataset:** `D:\3DGS-Research\training_data\truck_baseline`  
**Repository:** `D:\3DGS-Research\gaussian-splatting`

## 1. Model verification

- `cfg_args` exists (265 bytes) and records the isolated dataset path, model path, `sh_degree=3`, `resolution=1`, `data_device='cpu'`, and `eval=True`.
- `chkpnt30000.pth` exists (1,476,097,814 bytes). It was loaded read-only on CPU; the checkpoint tuple reports iteration **30,000**, maximum SH degree **3**, and **2,050,123** Gaussian XYZ entries.
- `point_cloud/iteration_30000/point_cloud.ply` exists (508,432,036 bytes). Its PLY header says `element vertex 2050123`, agreeing with the checkpoint.
- The model, checkpoint, and saved configuration were not modified.

## 2. Rendering

Inspected official `render.py`: it loads the saved `cfg_args`, selects `--iteration`, loads the corresponding point-cloud PLY, and writes `train/ours_<iteration>/{renders,gt}` and `test/ours_<iteration>/{renders,gt}`. Both destinations were absent before rendering.

The official renderer completed successfully for iteration 30,000:

- Training: 219 renders and 219 paired GT images.
- Test: 32 renders and 32 paired GT images.
- All files are under the experiment directory at `train/ours_30000/` and `test/ours_30000/`.
- Render+GT PNG storage: 400,143,186 bytes total (about 381.6 MiB).

### Command used

```powershell
Set-Location 'D:\3DGS-Research\gaussian-splatting'
& 'D:\Miniconda\envs\3dgs\python.exe' render.py `
  -m 'D:\3DGS-Research\experiments\baseline_truck' `
  --iteration 30000 `
  --quiet
```

The output used the model path from `cfg_args`, which resolves to the same experiment directory.

## 3. Metrics

`metrics.py` evaluates the test render folders and reports PSNR, SSIM, and LPIPS. It attempts to create the VGG LPIPS network and load pretrained VGG/LPIPS weights. Those weights are not cached locally; invoking it would trigger downloads. To honor the no-download constraint, `metrics.py` was not run. The repository's `lpipsPyTorch` implementation imports `torchvision` VGG weights and calls `torch.hub.load_state_dict_from_url` for LPIPS weights.

PSNR and SSIM were computed for every rendered view using the repository's own `utils.image_utils.psnr` and `utils.loss_utils.ssim` helpers on paired saved PNGs:

| Split | Views | Mean PSNR | Mean SSIM | LPIPS |
|---|---:|---:|---:|---|
| Test | 32 | **25.5404 dB** | **0.88525** | Not computed (weights unavailable locally; no download performed) |
| Train | 219 | **27.7720 dB** | **0.91601** | Not computed (weights unavailable locally; no download performed) |

The test PSNR is close to the training log's 25.5485 dB; the small difference is expected because this evaluation compares 8-bit saved PNGs. The training log's 27.7190 dB train PSNR samples five training cameras at evaluation time; the table above averages all 219 training views, so the two train values use different view sets.

Per-view values and metric provenance are saved in [metrics_psnr_ssim.json](D:/3DGS-Research/experiments/baseline_truck/evaluation/metrics_psnr_ssim.json). The script used is [evaluate_rendered_baseline.py](D:/3DGS-Research/experiments/baseline_truck/evaluation/evaluate_rendered_baseline.py).

### Metric command used

```powershell
& 'D:\Miniconda\envs\3dgs\python.exe' -u `
  'D:\3DGS-Research\experiments\baseline_truck\evaluation\evaluate_rendered_baseline.py'
```

The script uses the repository PSNR/SSIM helpers and evaluates train/test separately. The official `metrics.py` command was inspected but intentionally not executed because it would download uncached LPIPS/VGG weights. If those weights are later supplied locally, its test-set invocation is:

```powershell
Set-Location 'D:\3DGS-Research\gaussian-splatting'
& 'D:\Miniconda\envs\3dgs\python.exe' metrics.py `
  -m 'D:\3DGS-Research\experiments\baseline_truck'
```

That official script only traverses the `test/` directory; train metrics in this report were computed with the same PSNR/SSIM helper implementations over `train/`.

## 4. Visual inspection

Created a five-view test contact sheet with ground truth, rendered view, and 4× amplified absolute difference:

- [Test-view comparison sheet](D:/3DGS-Research/experiments/baseline_truck/visualizations/test_view_comparisons.png)

The sampled views show the truck's overall shape, placement, color, and surrounding scene reproduced closely. Visible residuals are concentrated in fine foliage/texture, thin edges, high-frequency wood detail, and some shadows. The amplified difference column intentionally exaggerates small pixel errors.

The five held-out render indices are `00000`, `00008`, `00016`, `00023`, and `00031`; they correspond to separated positions in the sorted test-view sequence. No model or dataset file was altered to create the comparison sheet.

## 5. Rendering performance and GPU memory

The renderer progress output indicates about **4.2 saved frames/second**, approximately **0.24 seconds per frame**, for both training and test passes. This is an approximate end-to-end rate including rasterization, image transfer, and PNG saving; it is not a GPU-kernel-only benchmark. The combined 251-view pass took about one minute after initialization. This is rendering throughput and must not be confused with the user's 1 h 24 m 34 s training duration.

`nvidia-smi` snapshots:

- Before rendering: RTX 3050 6GB, 0 MiB used / 6,002 MiB free, 1% utilization, 50 °C.
- After render and metric processing: 0 MiB used / 6,002 MiB free, 0% utilization, 52 °C.
- Peak VRAM during rendering was not sampled, so no peak-memory claim is made.

## 6. Exact implementation commands

The exact rendering and metric commands are listed above. Visualization generation ran as part of `evaluate_rendered_baseline.py`. Model verification used `torch.load(..., map_location='cpu')` only to inspect the checkpoint tuple and iteration; it did not write to the checkpoint.

## 7. Limitations

- LPIPS is unavailable without pretrained VGG and LPIPS weight files. They were not cached and were not downloaded.
- PSNR/SSIM values here are from saved PNGs, whereas training-loop metrics are computed from float tensors before image saving.
- The train aggregate covers all 219 training images; the training log's train PSNR is a five-view sample.
- Rendering throughput includes disk I/O and is an approximate progress-bar rate; peak GPU memory was not captured.
- Visual comparison covers five held-out views, not every rendered image.

## Integrity and scope

Rendering wrote only new train/test render and GT folders under the baseline experiment. Evaluation JSON, script/log, and visualization were written under `experiments\baseline_truck`. The dataset, checkpoint, point-cloud model, repository source, and downloaded ZIP were not modified. No retraining, package installation, or download occurred.

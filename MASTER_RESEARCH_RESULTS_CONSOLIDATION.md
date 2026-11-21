# Master Research Results Consolidation

**Project:** Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting  
**Workspace:** `D:\3DGS-Research`  
**Consolidation date:** 2026-11-21

## Scope and evidence conventions

This report consolidates existing reports and saved result summaries in the workspace. No training, rendering, benchmarking, or new metric computation was performed for this consolidation. Values below are transcribed from the cited experiment reports unless explicitly marked as a calculated difference or speedup. The Truck scene, trained model, and RTX 3050 Laptop GPU are common context, but camera splits, camera counts, timing definitions, repetitions, and code paths differ among experiments. Results are compared directly only where the source reports identify a matched protocol.

“Measured” means reported by an experiment. “Calculated” means simple arithmetic from reported measurements, such as a delta or ratio. “Interpretation” is an evidence-bounded explanation. FPS values are not interchangeable: some are synchronized render-call rates, some include image I/O, and some are end-to-end selector-plus-render estimates.

## Executive summary

The baseline is the original Graphdeco 3DGS Truck model at iteration 30,000, with 2,050,123 Gaussians (SH degree 3). Its matched 32-camera test reference is 25.5404 dB PSNR and 0.88525 SSIM. The 219-camera training set is 979×546. LPIPS was unavailable because the required pretrained weights were not locally cached; no download was performed.

The experiments establish that activated-opacity ranking and the 219-view opacity-gradient sensitivity score select very different Gaussians. Sensitivity-only selection improved over opacity Top-K at 10% and 5% on the 32-test-view benchmark, but was worse at 75%, 50%, and 25%. A view-dependent opacity-weighted projected-footprint score demonstrably changes rankings with camera pose, but view-only quality was below sensitivity-only at every tested budget. The hybrid weight sweep found a budget-dependent result: sensitivity-dominant weighting (0.75 sensitivity / 0.25 view score) led both PSNR and SSIM at 50% and 25%; sensitivity-only led PSNR at 10% and 5%.

Temporal minimum-retention selection substantially stabilized sets. In a 20-training-camera rendering pilot, Medium (R=.95) and Strong (R=.98) improved PSNR over the per-camera hybrid baseline by about 1.16–1.18 dB at 10% and 1.52–1.55 dB at 5% (calculated from the pilot means). This is promising pilot evidence, not a full trajectory image-quality evaluation. Temporal selection also increases selection work; measured end-to-end throughput in that pilot remained approximately 0.85–0.91 FPS.

Exact implementation optimizations reduced selector-path cost. On the full 219-training-camera scalability run, the optimized exact path was 3.25×–4.22× faster than the original reference, depending on budget. The run covered four methods and four budgets, validated selection correctness and temporal retention, peaked at 1.045 GiB PyTorch allocated / 1.422 GiB reserved VRAM and 3.161 GiB process RSS, and found all 3,141 protected-file hashes unchanged. These are selection-pipeline results, not rendering FPS or image-quality results.

The strongest defensible contribution is a tested research pipeline that combines a global loss-gradient score and a camera-dependent projected-footprint proxy, adds explicit temporal retention, and makes the selection path substantially faster while preserving exact outputs for the adopted optimizations. The current evidence does not establish universal superiority over conventional pruning, generalization beyond one scene, or perceptual temporal smoothness.

## Dataset, model, and baseline context

| Item | Consolidated value | Evidence |
|---|---|---|
| Dataset | Tanks and Temples Truck, isolated copy at `training_data\truck_baseline` | Dataset preparation and benchmark reports |
| Training / test cameras | 219 / 32 | Baseline, sensitivity, and benchmark reports |
| Image resolution | 979×546 | Baseline and experiment reports |
| Baseline checkpoint | Iteration 30,000; SH degree 3 | Baseline rendering report |
| Gaussian count | 2,050,123 | Checkpoint and PLY verification |
| Test baseline quality | 25.5404 dB PSNR; 0.88525 SSIM over 32 views | Baseline and matched Top-K benchmarks |
| Training baseline quality | 27.7720 dB PSNR; 0.91601 SSIM over all 219 training renders | Baseline rendering report; differs from training log’s five-camera sampled metric |
| Evaluation limitation | LPIPS unavailable; pretrained weights were not cached and were not downloaded | Baseline and benchmark reports |

The baseline report notes that its all-training-view PNG PSNR/SSIM is not directly comparable with training-loop metrics computed on a five-view sample and before PNG quantization. Likewise, the baseline render progress rate of about 4.2 saved frames/s includes image transfer and PNG saving and is not comparable to benchmark render-call FPS.

## Master experiment inventory

| Experiment | Objective | Dataset / camera set | Methods compared | Budgets | Evaluation metrics | Main finding | Report location |
|---|---|---|---|---|---|---|---|
| Original 3DGS baseline | Train and validate reference model | Truck; 219 train, 32 test | Original Graphdeco model | 100% | PSNR, SSIM; LPIPS unavailable | 30K model has 2,050,123 Gaussians; test 25.5404/0.88525 | `BASELINE_RENDERING_AND_EVALUATION.md` |
| Fixed opacity Top-K | Global opacity pruning benchmark | Same 32 official test views | Full model and opacity Top-K | 100, 75, 50, 25, 10, 5% | PSNR, SSIM, synchronized render-call FPS, memory | Quality declines with pruning; 5% reaches 66.99 FPS but 10.3477/0.33505 | `FIXED_TOPK_BENCHMARK_REPORT.md` |
| Full sensitivity accumulation | Compute global gradient score | All 219 training views once | Mean absolute gradient w.r.t. activated opacity | All 2,050,123 | Score distribution, timings, gradient validity | Finite CPU float32 score vector; 48,011 zeros (2.3419%) | `experiments\sensitivity_full_219views\SENSITIVITY_FULL_219VIEW_REPORT.md` |
| Sensitivity vs opacity ranking | Read-only ranking comparison | Full model; sensitivity from 219 train views | Opacity vs global sensitivity | 100–5% | Correlation, overlap, rank disagreement | Weak negative correlation; overlap collapses at small budgets | `experiments\sensitivity_ranking_analysis\SENSITIVITY_RANKING_ANALYSIS_REPORT.md` |
| Global sensitivity Top-K | Render one global sensitivity ranking | Same 32 official test views | Opacity vs global sensitivity | 100, 75, 50, 25, 10, 5% | PSNR, SSIM, render-call FPS | Sensitivity better at 10/5%, worse at 75/50/25% | `experiments\sensitivity_topk_benchmark\SENSITIVITY_TOPK_BENCHMARK_REPORT.md` |
| View-score feasibility audit | Inspect renderer and candidate view scores | Source-level analysis, Truck model | Distance, projected footprint, rasterizer contribution | N/A | Source/code feasibility | Projected footprint feasible as proxy; rasterizer does not expose exact per-Gaussian composited contribution | `VIEW_DEPENDENT_SCORING_FEASIBILITY_AUDIT.md` |
| View-dependent scoring pilot | Compute per-camera score without rendering | 3 deterministic train cameras: indices 0, 109, 218 | Opacity-weighted projected footprint | Full score vector | Frustum counts, distribution, top IDs, rank correlations | Rankings changed substantially with camera; camera dependence only, not quality evidence | `experiments\view_dependent_scoring_pilot\VIEW_DEPENDENT_SCORING_PILOT_REPORT.md` |
| Sensitivity + view Top-K | Evaluate equal-weight per-camera hybrid | Same 32 official test views | 0.5 sensitivity + 0.5 view score | 100, 75, 50, 25, 10, 5% | PSNR, SSIM, render and end-to-end throughput | Mixed quality; beats fixed PSNR only at 5%; uncached scorer cost is large | `experiments\sensitivity_view_topk_benchmark\SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md` |
| Weight sweep | Select initial hybrid weights | Same 32 official test views | Sensitivity/view weights: 1/0, .75/.25, .5/.5, .25/.75, 0/1 | 50, 25, 10, 5% | PSNR, SSIM, throughput | .75/.25 best both metrics at 50/25; sensitivity-only PSNR best at 10/5 | `experiments\sensitivity_view_weight_sweep\SENSITIVITY_VIEW_WEIGHT_SWEEP_REPORT.md` |
| Temporal consistency feasibility audit | Test selection-set stability over trajectory | 219 training cameras | Unconstrained, R=.90/.95/.98 | 50, 25, 10, 5% | Overlap, Jaccard, change | Retention can strongly limit churn; no image quality measured | `TEMPORAL_CONSISTENCY_FEASIBILITY_AUDIT.md` and `experiments\temporal_consistency_feasibility_audit\` |
| Temporal selection pilot | Simulate sequential selection | All 219 training cameras | Baseline, Weak, Medium, Strong | 50, 25, 10, 5% | Overlap, Jaccard, changed IDs, correctness | Medium/Strong sharply stabilize low-budget sets; no render quality/runtime | `experiments\temporal_selection_pilot\TEMPORAL_SELECTION_PILOT_REPORT.md` |
| Temporal rendering pilot | Render sequential temporal selections | 20 sampled training cameras | Per-camera baseline, Medium R=.95, Strong R=.98 | 10, 5% | PSNR, SSIM, render FPS, end-to-end FPS, overlap | Temporal methods improved pilot PSNR and stability; selection dominates end-to-end time | `experiments\temporal_rendering_pilot\TEMPORAL_RENDERING_PILOT_REPORT.md` |
| Selection pipeline profiling | Locate selector overhead | Small representative training subset | Baseline, Medium, Strong; 10/5% | 10, 5% | Stage timing, memory | Score/covariance and full sorting were major costs; motivated exact optimization studies | `experiments\selection_pipeline_profiling\SELECTION_PIPELINE_PROFILING_REPORT.md` |
| Exact partial Top-K | Replace full sort with exact partial selection | 5 training cameras | NumPy argpartition, Torch CPU/CUDA vs full sort | 10, 5% | Rank and pipeline timing, ID equality | Argpartition rank stage 6.48×/9.33× faster at 10/5%; full pipeline gains smaller | `experiments\partial_topk_optimization\PARTIAL_TOPK_OPTIMIZATION_REPORT.md` |
| View-score normalization optimization | Accelerate exact percentile ranks | 5 training cameras | NumPy reference, NumPy unique, Torch CPU/CUDA unique | 10, 5% | Timing, bitwise equality, selection equality | CUDA unique normalizer 5.70× faster in isolation; pipeline 1.26×–1.30× faster | `experiments\view_score_normalization_optimization\VIEW_SCORE_NORMALIZATION_OPTIMIZATION_REPORT.md` |
| View-score computation optimization | Reduce transfers/sync in scorer | 5 training cameras | Reference, cached opacity, batched, pinned output | 10, 5% | Timing, score and ID exactness | Batched output 1.127× faster scoring; 1.074× mean pipeline gain | `experiments\view_score_computation_optimization\VIEW_SCORE_COMPUTATION_OPTIMIZATION_REPORT.md` |
| Camera-space covariance optimization | Compare exact and reassociated covariance math | 5 training cameras | Reference, cached matrix, BMM, transposed, symmetric formula | 10, 5% | Covariance/score/rank exactness, time | Cached exact matrix gives modest gain; faster reassociations changed values/order | `experiments\camera_space_covariance_optimization\CAMERA_SPACE_COVARIANCE_OPTIMIZATION_REPORT.md` |
| Consolidated pipeline benchmark | Integrate exact improvements | 5 training cameras, 3 repetitions | Original A through optimized E; temporal F variants | 10, 5% | Pipeline and stage timing; exactness | E reached 3.50×/3.54× vs A; temporal integrated numbers contaminated by in-timer oracle | `experiments\consolidated_pipeline_benchmark\CONSOLIDATED_PIPELINE_BENCHMARK_REPORT.md` |
| Full-scale scalability validation | Validate the selection pipeline over complete train path | All 219 training cameras; zero test cameras/images | Original, optimized exact, Temporal Medium, Temporal Strong | 50, 25, 10, 5% | Stage/end-to-end selection time, temporal stability, memory, correctness | Optimized exact path 3.25×–4.22× faster; exactness and integrity passed | `experiments\full_scale_scalability_validation\FULL_SCALE_SCALABILITY_VALIDATION_REPORT.md` |

## Consolidated rendering-quality results

### Matched 32-test-camera comparisons

These rows use the same 32 official test views, 979×546 images, baseline model, and retained counts. Opacity, sensitivity, and the equal-weight combined benchmark reports use matched render/metric handling. The weight sweep reuses the same test cameras and score definition. FPS still varies by run and includes different selector/setup accounting; quality is the strongest directly comparable quantity.

| Method | Retained | K | PSNR (dB) | SSIM | Render-call FPS | Test cameras | Conditions / provenance |
|---|---:|---:|---:|---:|---:|---:|---|
| Full baseline | 100% | 2,050,123 | 25.5404 | 0.88525 | 19.21 | 32 | Opacity benchmark synchronized render-call reference |
| Opacity Top-K | 75% | 1,537,592 | 25.2118 | 0.88166 | 23.66 | 32 | Global activated-opacity ranking |
| Sensitivity Top-K | 75% | 1,537,592 | 24.1068 | 0.87247 | 32.83 | 32 | Global 219-view gradient ranking |
| Hybrid 0.5/0.5 | 75% | 1,537,592 | 24.4076 | 0.87162 | 30.53 | 32 | Per-camera view score; 3 timed passes, high timing variation at some budgets |
| Opacity Top-K | 50% | 1,025,061 | 23.5604 | 0.85672 | 27.00 | 32 | Global activated-opacity ranking |
| Sensitivity Top-K | 50% | 1,025,061 | 21.4538 | 0.82521 | 36.12 | 32 | Global 219-view gradient ranking |
| Hybrid 0.75/0.25 | 50% | 1,025,061 | 21.8063 | 0.83698 | Not stated as paired sweep row | 32 | Weight sweep best PSNR and SSIM at this budget |
| Hybrid 0.5/0.5 | 50% | 1,025,061 | 21.0311 | 0.82429 | 32.93 | 32 | Same method as equal-weight benchmark |
| View-only | 50% | 1,025,061 | 14.9432 | 0.71177 | Weight-sweep range 32.93–77.91 | 32 | Camera-specific projected-footprint only; per-condition FPS in CSV |
| Opacity Top-K | 25% | 512,530 | 19.3648 | 0.73801 | 34.32 | 32 | Global activated-opacity ranking |
| Sensitivity Top-K | 25% | 512,530 | 17.0807 | 0.71168 | 44.11 | 32 | Global 219-view gradient ranking |
| Hybrid 0.75/0.25 | 25% | 512,530 | 17.4804 | 0.73791 | Not stated as paired sweep row | 32 | Weight sweep best PSNR and SSIM at this budget |
| Hybrid 0.5/0.5 | 25% | 512,530 | 14.2176 | 0.68055 | 34.13 | 32 | Per-camera; render FPS SD was high (17.12) |
| View-only | 25% | 512,530 | 13.8965 | 0.64971 | Weight-sweep range 32.93–77.91 | 32 | Camera-specific projected-footprint only |
| Opacity Top-K | 10% | 205,012 | 13.6679 | 0.49505 | 46.39 | 32 | Global activated-opacity ranking |
| Sensitivity Top-K | 10% | 205,012 | 13.8959 | 0.58295 | 36.34 | 32 | Global 219-view gradient ranking |
| Hybrid 0.75/0.25 | 10% | 205,012 | 12.9622 | 0.58448 | Not stated as paired sweep row | 32 | Highest SSIM in weight sweep; sensitivity-only had best PSNR |
| Hybrid 0.5/0.5 | 10% | 205,012 | 12.5942 | 0.58188 | 46.24 | 32 | Per-camera; render FPS SD was high (26.91) |
| View-only | 10% | 205,012 | 12.5369 | 0.53778 | Weight-sweep range 32.93–77.91 | 32 | Camera-specific projected-footprint only |
| Opacity Top-K | 5% | 102,506 | 10.3477 | 0.33505 | 66.99 | 32 | Global activated-opacity ranking |
| Sensitivity Top-K | 5% | 102,506 | 12.5286 | 0.51335 | 50.99 | 32 | Global 219-view gradient ranking |
| Hybrid 0.75/0.25 | 5% | 102,506 | 11.5214 | 0.50742 | Not stated as paired sweep row | 32 | Sensitivity-only had best PSNR |
| Hybrid 0.5/0.5 | 5% | 102,506 | 11.8009 | 0.51512 | 89.31 | 32 | Combined benchmark; SSIM slightly highest among listed methods |
| View-only | 5% | 102,506 | 11.5367 | 0.46934 | Weight-sweep range 32.93–77.91 | 32 | Camera-specific projected-footprint only |

The 100% results reproduce baseline output: sensitivity 100% was pixel-identical to baseline on all 32 views; combined 100% likewise had exact pixel agreement. Exact equality is a useful implementation check, not a pruned-method quality gain.

For weight sweep at 50/25/10/5%, the complete PSNR/SSIM pairs were: sensitivity-only 21.4538/0.82521, 17.0807/0.71168, 13.8959/0.58295, 12.5286/0.51335; 75/25 21.8063/0.83698, 17.4804/0.73791, 12.9622/0.58448, 11.5214/0.50742; 50/50 21.0311/0.82429, 14.2176/0.68055, 12.5942/0.58188, 11.8009/0.51512; 25/75 18.1786/0.77212, 13.9654/0.66213, 12.7954/0.57010, 11.9332/0.50659; view-only 14.9432/0.71177, 13.8965/0.64971, 12.5369/0.53778, 11.5367/0.46934.

### Temporal rendering pilot: separate 20-camera training-path evidence

This pilot used **20 sampled training cameras**, not the 32 official test views and not all 219 training cameras. Its baseline is the per-camera 0.75/0.25 hybrid, so these values must not be merged into the preceding 32-test-view table. PSNR gains shown below are calculated as temporal mean minus pilot baseline mean.

| Method | Budget | K | PSNR | SSIM | Render FPS | End-to-end FPS | Mean adjacent selection overlap | Mean Jaccard | PSNR gain vs pilot baseline |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pilot baseline (per-camera) | 10% | 205,012 | 13.1562 | 0.59473 | 80.18 | 0.89 | 67.86% | 0.5173 | — |
| Temporal Medium R=.95 | 10% | 205,012 | 14.3171 | 0.61890 | 55.40 | 0.85 | 95.00% | 0.9048 | +1.1609 dB |
| Temporal Strong R=.98 | 10% | 205,012 | 14.3375 | 0.61841 | 56.63 | 0.85 | 98.00% | 0.9608 | +1.1813 dB |
| Pilot baseline (per-camera) | 5% | 102,506 | 11.5862 | 0.50711 | 71.17 | 0.91 | 61.66% | 0.4498 | — |
| Temporal Medium R=.95 | 5% | 102,506 | 13.1013 | 0.55044 | 63.79 | 0.88 | 95.00% | 0.9048 | +1.5151 dB |
| Temporal Strong R=.98 | 5% | 102,506 | 13.1347 | 0.55076 | 65.10 | 0.88 | 98.00% | 0.9608 | +1.5485 dB |

“Mean selection overlap” here is adjacent selected-set overlap along the sampled path, not an image metric. Temporal selection time is expensive and dominates end-to-end time. Adjacent RGB MAE was not optical-flow compensated, so it does not prove reduced perceptual flicker.

## Consolidated temporal selection stability

The following table consolidates the full 219-camera simulation and the later full-scale validation. Stability-only simulation is shown for the unconstrained/Weak/Medium/Strong cases; the full-scale validation rechecked only Medium and Strong alongside baseline/optimized paths. All 219-camera values are training-camera transitions, with 218 valid adjacent transitions per sequence.

| Rule | R | Budget | Mean overlap | Mean Jaccard | Mean changed | Maximum changed | Minimum overlap | Evidence |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Unconstrained baseline | — | 50% | 98.154% | 0.96392 | 1.846% | 5.285% | 94.715% | 219-view temporal selection pilot |
| Unconstrained baseline | — | 25% | 96.383% | 0.93082 | 3.617% | 10.309% | 89.691% | Same |
| Unconstrained baseline | — | 10% | 91.665% | 0.84909 | 8.335% | 24.353% | 75.647% | Same |
| Unconstrained baseline | — | 5% | 89.945% | 0.82123 | 10.055% | 28.229% | 71.771% | Same |
| Medium | .95 | 50% | 98.157% | 0.96397 | 1.843% | 5.000% | 95.000% | Pilot and full-scale validation |
| Medium | .95 | 25% | 96.576% | 0.93409 | 3.424% | 5.000% | 95.000% | Pilot and full-scale validation |
| Medium | .95 | 10% | 95.047% | 0.90562 | 4.953% | 5.000% | 95.000% | Pilot and full-scale validation |
| Medium | .95 | 5% | 95.001% | 0.90478 | 4.999% | 5.000% | 95.000% | Pilot and full-scale validation |
| Strong | .98 | 50% | 98.375% | 0.96806 | 1.625% | 2.000% | 98.000% | Pilot and full-scale validation |
| Strong | .98 | 25% | 98.001% | 0.96081 | 1.999% | 2.000% | 98.000% | Same |
| Strong | .98 | 10% | 98.000% | 0.96079 | 2.000% | 2.000% | 98.000% | Same |
| Strong | .98 | 5% | 98.000% | 0.96079 | 2.000% | 2.000% | 98.000% | Same |

The 219-camera pilot also measured Weak R=.90. At 10% it achieved 92.362% mean overlap, 0.85905 Jaccard and 7.638% mean change (maximum change 10%, minimum overlap 90%); at 5% it achieved 91.417%, 0.84266 and 8.583% (maximum change 9.999%, minimum overlap 90.001%). The rule reduced low-budget churn, but it did not establish image quality until the separate 20-camera rendering pilot.

## Computational optimization results

The experiments below use different sample sizes and timing boundaries. The values are therefore presented with their own scopes. Speedups shown are those explicitly reported or arithmetic ratios of clearly paired values from the same report. “Exact” refers to score/ID agreement with that experiment’s reference, not mathematical equality in every possible execution environment.

| Optimization | Original → optimized timing | Speedup | Exactness / ranking evidence | Validation and limitations |
|---|---|---:|---|---|
| Partial Top-K (NumPy argpartition) | On 5 training cameras, 10% baseline rank/select 328.11→50.63 ms; 5% 328.06→35.16 ms. Total path 1,147.2→837.2 ms at 10%, 1,094.4→794.8 ms at 5%. | Rank 6.48× / 9.33×; full path 1.37× / 1.38× | Exact ordered selected IDs vs full stable sort for every tested camera/method/budget; deterministic boundary tie repair; temporal retention passed | Small 5-camera, 3-repeat profile. Shared reuse of one full sort across six configs narrows benefit: 1,202.4 ms full sort vs 1,126.6 ms six partial calls. |
| View-score percentile normalization (CUDA unique/count) | 5-camera isolated normalization: NumPy reference 247.41 ms→Torch CUDA unique 43.38 ms. Pipeline baseline 10%: 932.4→725.8 ms; 5%: 892.8→686.6 ms. | 5.70× normalizer; pipeline 1.28× / 1.30× | Bitwise-identical normalized scores; combined vectors, full rankings, and selections identical; tie and zero cases tested | CUDA transfer/synchronization are part of wall time; Torch CPU unique was slower than reference. The first runner attempt accessed test pixels, but its measurements were superseded; final run used training-only camera construction. |
| View-dependent score computation (batched output) | Five-camera scorer mean 438.79→389.25 ms; six-configuration pipeline mean 620.02→577.47 ms/camera | 1.127× scorer; 1.074× pipeline | Score vectors bitwise identical; all 360 selected-set records matched; no model/source changes | Five-camera profile. Covariance transform remained the largest stage. Pinned output did not consistently beat batched output. |
| Camera-space covariance (cached exact matrix) | Five-camera covariance stage 316.30→308.56 ms; full score time 368.90→358.50 ms; pipeline 484.02→469.91 ms | 1.025× stage; 1.029× scorer; 1.030× pipeline | Cached matrix and explicit BMM were bitwise exact and preserved ordered IDs. | Cache uses ~73.8 MB and ~7.8 ms setup. Faster transpose/symmetric reassociations changed float32 values and ordered ID arrays, although tested top-K sets matched; they were not adopted as exact. |
| Consolidated exact pipeline (A→E) | Five training cameras: 10% mean 1.6021→0.4581 s/camera; 5% 1.5157→0.4278 s/camera | 3.50× / 3.54× | Exact view scores, normalization, combined vectors, ranking IDs, selected IDs; temporal oracle verified outside this benchmark’s normal timing where applicable | Three repetitions on five cameras. Temporal F integrated timings were contaminated by an exact-selection oracle inside the timed interval; the reported E comparison is non-temporal. |
| Full-scale optimized exact pipeline | 219 train cameras: original 2.1474→optimized 0.5656 s/camera at 50%; 1.6013→0.4924 at 25%; 1.8596→0.4410 at 10%; 1.7420→0.4250 at 5% | 3.80×, 3.25×, 4.22×, 4.10× | Full 219-camera view-score hashes matched; exact K, unique/in-range IDs, deterministic replay and temporal oracles passed | Single full pass per method/budget; values include synchronized CPU wall time for selection through subset attribute access; no renderer/rasterizer time. |

The five-camera consolidated values and the 219-camera full-scale values are not a repeated direct comparison: the run scope, instrumentation, and pipeline versions differ. The full-scale result is the strongest scalability evidence. In the five-camera consolidated study, view-score/covariance work remained the largest steady-state stage; the full-scale results confirm that exact partial selection and CUDA normalization materially reduced the total path.

**Protected-file integrity by optimization study:** partial Top-K verified an unchanged 2,904-file protected manifest; normalization verified 3,043 files unchanged; score computation verified 3,069 files unchanged; covariance, consolidated pipeline, and full-scale reports each record passing protected-hash checks (the latter two cover 3,141 files / 10,341,093,723 bytes). Model tensors, checkpoint, sensitivity inputs, source files, and prior experiments were included in the respective manifests as documented by each report. These are per-experiment integrity scopes and should not be interpreted as one common manifest.

## Full-scale scalability validation

| Measure | Result |
|---|---|
| Camera path | All 219 filename-ordered training cameras, 979×546; 0 test camera objects and 0 test images opened |
| Model size | 2,050,123 Gaussians |
| Methods | 4: original reference, optimized exact, Temporal Medium R=.95, Temporal Strong R=.98 |
| Budgets | 4: 50%, 25%, 10%, 5% |
| Records | 3,504 method × budget × camera rows |
| Optimized exact speedup vs original | 3.25×–4.22×; budget-specific results in table above |
| Peak PyTorch VRAM | 1.045 GiB allocated; 1.422 GiB reserved |
| Peak process RAM | 3.161 GiB RSS |
| Correctness | Exact K, uniqueness, bounds, deterministic replay, finite scores, and view-score hash equivalence all passed; temporal oracle/retention passed across 218 transitions per sequence |
| Integrity | 3,141 protected files / 10,341,093,723 bytes before and after; all protected hashes unchanged |

This establishes that the selector path can complete the full training-camera sequence with the tested model and GPU. It does not establish 219-view rendering quality, full application FPS, test-set behavior of temporal selection, or multi-scene scalability.

## Key Research Findings

### Finding 1 — Sensitivity-based selection

The score is the mean across 219 training views of the absolute derivative of the existing RGB loss with respect to activated Gaussian opacity. The source report used `0.8 × mean L1 + 0.2 × (1 − SSIM)` and `torch.autograd.grad`, with no optimizer update. Sensitivity and opacity rankings had Spearman −0.067878, raw Pearson −0.020536, and log10 Pearson −0.113755 over positive sensitivity pairs. Their top-set overlap was 1.976% at 10% and 0.779% at 5%.

This demonstrates that the loss-gradient criterion carries ranking information not represented by opacity alone in this scene and objective. It does not establish that it measures true intrinsic Gaussian importance, that a zero score means globally irrelevant, or that sensitivity is consistently better. On the matched test benchmark it was worse than opacity at 75%, 50%, and 25%, and better at 10% and 5% quality, while its measured render-call FPS was lower than opacity at 10% and 5%.

### Finding 2 — View-dependent selection

The view score uses activated opacity times a projected-footprint/clipping proxy based on the Graphdeco camera transform and projected covariance approximation. The three-camera pilot showed low top-100 overlap across different views (0–3 shared IDs) and strongly camera-dependent rank correlations. The 32-test-view benchmark generated 32 distinct sub-100% selected sets per budget.

This demonstrates pose-dependent ranking behavior. The score is not exact rasterizer contribution: it does not account for occlusion/transmittance, SH color contrast, or target-image error; image clipping uses a square-support approximation around the projected Gaussian footprint. On the weight sweep, view-only selection was below sensitivity-only at all four budgets. Therefore camera dependence is established, but standalone quality superiority is not.

### Finding 3 — Combined sensitivity and view-dependent scoring

The combined score is a weighted combination of percentile-normalized global sensitivity and per-camera view score. In the 32-view sweep, alpha/beta = .75/.25 was strongest at 50% and 25%: it exceeded both sensitivity-only and view-only on both PSNR and SSIM at these budgets. At 10% and 5%, sensitivity-only gave the best PSNR; hybrid variants traded small SSIM changes against PSNR losses. The equal-weight result was mixed and did not dominate the other methods.

The evidence supports budget-aware weight selection as a research question, not a single optimal blend. View-score preparation and ranking add significant uncached cost; the equal-weight benchmark’s uncached 32-view end-to-end rates were approximately 0.88–0.92 FPS, while cached ranking-plus-render rates were 17.28–64.11 FPS depending on budget. These describe different assumptions and should remain separately reported.

### Finding 4 — Temporal consistency

The retention rule preserves at least R of the prior selected set while ranking retained and new candidates by the current camera. Across all 219 training transitions, R=.95 and .98 enforced the requested minimum and reduced low-budget selection changes to about 5% and 2%, respectively. In the separate 20-camera rendering pilot, both temporal methods improved PSNR over the corresponding per-camera hybrid pilot baseline by approximately 1.16–1.18 dB at 10% and 1.52–1.55 dB at 5%.

The 20-camera pilot’s Strong and Medium quality means were nearly tied; Strong was slightly higher in PSNR, while SSIM differed by budget and setting. Temporal selection’s end-to-end throughput remained 0.85–0.91 FPS in the rendering pilot, since score calculation and selection were costly. The 219-camera scale run validated selector runtime and retention but did not render 219 views. Thus temporal quality evidence remains a promising, limited training-path pilot.

### Finding 5 — Computational optimization

Exact partial Top-K, exact percentile normalization, batched score output, and exact cached covariance reuse collectively reduced measured selector time while preserving the relevant scores and IDs in their validation domains. The five-camera consolidated optimized non-temporal pipeline showed 3.50×/3.54× gains at 10%/5%; the larger full-scale validation showed 3.25×–4.22× speedups across 25%–5% (and 3.80× at 50%) over the original reference path.

These are implementation-level gains, distinct from algorithmic quality gains. The covariance reassociation variants were faster but changed floating-point values and ordered IDs; they were not adopted as exact optimizations. Temporal five-camera integrated timing from the consolidated study is specifically caveated because its correctness oracle was inside the timer; use the later full-scale timing for the cleaned temporal selector result.

### Finding 6 — Scalability

The full 219-camera validation supports that all four tested selector paths can run sequentially over the complete training trajectory with exact budget sizes, valid Gaussian IDs, deterministic replay, finite scores, and temporal retention. Peak selection memory was modest relative to the 6GB GPU capacity. Protected hashes remained unchanged.

This is evidence of operational scalability for this one model, scene, GPU, and selector configuration. It is not evidence of generalization to other scenes, high-resolution imagery, other GPUs, or end-to-end rendering performance.

## Negative and mixed findings

1. **Sensitivity-only is not uniformly better.** It lost to opacity Top-K at 75%, 50%, and 25% on both PSNR and SSIM in the matched 32-view benchmark; gains appeared at 10% and 5% only.
2. **View-only is weaker than sensitivity-only.** It had lower PSNR and SSIM at every weight-sweep budget. Camera-dependent ranking alone does not guarantee useful view contribution estimates.
3. **Hybrid scoring does not dominate all budgets.** The .75/.25 blend led at 50% and 25%, but sensitivity-only led PSNR at 10% and 5%. Equal weighting was not a universal winner.
4. **Temporal quality evidence is promising but small-sample.** The temporal rendering pilot used 20 training cameras; it did not validate the 219-camera sequence visually or use held-out test cameras.
5. **Temporal selection costs time.** In the 20-camera rendering pilot, approximately 1.09–1.15 seconds of per-camera selection work left end-to-end throughput near 0.85–0.91 FPS. Full-scale selection timing is improved but is not the same as rendered application throughput.
6. **Medium and Strong quality are close.** The temporal rendering pilot showed nearly comparable mean PSNR/SSIM for R=.95 and R=.98, despite different overlap constraints. Strong’s additional stability therefore does not imply a clear image-quality gain.
7. **Covariance algebraic reassociation is not exact in floating point.** The transposed and symmetric-formula alternatives changed float32 outputs and ordered Gaussian IDs. Identical tested sets in a small sample do not establish interchangeable ordering or rendered output.
8. **Throughput varies by protocol and system state.** Some hybrid timing standard deviations were large. FPS comparisons must retain their exact definition and run context.
9. **LPIPS is missing.** PSNR/SSIM alone do not fully measure perceptual quality; no LPIPS weights were downloaded.

These results matter because they prevent overstating the method: selection rankings can differ, improve at selected budgets, and become more stable, while still trading quality, compute, and budget-dependent behavior.

## Limitations

- **One scene:** All evaluated quality and selector evidence is from Tanks and Temples Truck. No multi-scene generalization experiment exists in the inventory.
- **Proxy view importance:** The view-dependent score is opacity-weighted projected footprint with approximate image clipping. It is not the rasterizer’s front-to-back composited per-Gaussian contribution and omits occlusion, transmittance, SH color effects, and target error.
- **Temporal rendering coverage:** The temporal rendering pilot used 20 sampled training cameras, not all 219 training views or the official 32 test views. The full 219-camera validation measured selection path and stability, not rendered quality.
- **Temporal frame metric:** Adjacent RGB MAE was not optical-flow compensated; it cannot establish perceptual flicker reduction. The test cameras are a holdout view set, not a verified video sequence.
- **LPIPS unavailable:** No local pretrained LPIPS/VGG weights were available; no package or weights were installed or downloaded.
- **Metric scope:** Most method-quality comparisons use 32 test views and PSNR/SSIM on saved PNGs. These do not capture all perceptual dimensions. Baseline training-loop values differ in camera sampling and image quantization.
- **Runtime comparability:** Profiling, five-camera optimization, 32-test-view rendering, 20-camera temporal rendering, and 219-camera selector validation measure distinct operations. GPU timing variability and one-pass full-scale validation limit statistical certainty.
- **Temporal inference semantics:** Temporal retention relies on a sequential camera path and a prior selection. It may not directly apply to arbitrary independent camera queries without defining a reset/order policy.
- **No broad deployment evidence:** GPU memory and runtime are reported for one RTX 3050 Laptop GPU, software stack, image resolution, and model size.
- **No claim of true sensitivity:** The full score is a local derivative magnitude for a chosen loss and training camera set, not leave-one-out ablation or a universal importance measure.

## Recommended final research claims

The strongest defensible position is:

> We study Gaussian subset selection for 3D Gaussian Splatting by combining a global opacity-gradient sensitivity ranking with a camera-dependent projected-footprint proxy and an explicit temporal retention constraint. On the Tanks and Temples Truck scene, the rankings differ substantially from opacity alone; their rendering-quality effects depend on retention budget and score weights. A 20-camera training-path pilot found higher PSNR for temporal selection than per-camera hybrid selection at 10% and 5%, alongside markedly higher adjacent-set overlap, while end-to-end throughput remained limited by score/selection cost. Separately, exact selection-pipeline optimizations preserved tested scores and selected IDs and achieved 3.25×–4.22× speedups over the original reference on the full 219-camera training path.

The paper should present this as a **budget- and path-dependent selection study with an exact optimized implementation**, not as proof that the method universally outperforms conventional 3DGS pruning. The algorithmic contribution (gradient/view scoring and temporal selection) must be separated from implementation optimizations (partial Top-K, exact CUDA normalization, batched transfers, and cached covariance).

## Suggested paper structure

1. **Introduction:** Motivation, selection budget, distinction from training-time pruning, and bounded contributions.
2. **Related work:** 3DGS rasterization and pruning/importance criteria; temporal consistency in dynamic viewpoint rendering.
3. **Method:** Global activated-opacity gradient score, camera-dependent projected-footprint proxy, normalization/weighting, deterministic Top-K, and temporal retention rule.
4. **Implementation and complexity:** Original renderer compatibility; exact partial Top-K and normalization; score transfer/covariance cache; separate algorithmic and systems costs.
5. **Experimental setup:** Truck scene, 30K model, 2,050,123 Gaussians, 219/32 split, 979×546, budgets, RTX 3050, metric and timing definitions.
6. **Global selection results:** Opacity vs sensitivity ranking/correlation and matched 32-test-view quality-speed results.
7. **View-dependent and hybrid results:** Camera dependence, proxy limitations, equal-weight benchmark, weight sweep and budget interactions.
8. **Temporal results:** 219-camera selection stability; separate 20-camera rendering pilot with clear pilot status and non-flow-compensated temporal metric caveat.
9. **Systems results:** Optimization ablations, exactness validation, and 219-camera scalability/memory.
10. **Limitations and discussion:** Single scene, no LPIPS, temporal camera subset, projected-footprint proxy, and runtime definitions.
11. **Conclusion:** Evidence-calibrated contribution and next validation needed for broader claims.

## Source reports used

### Core baseline, method, and quality reports

- `BASELINE_RENDERING_AND_EVALUATION.md`
- `FIXED_TOPK_BENCHMARK_REPORT.md`
- `experiments\sensitivity_full_219views\SENSITIVITY_FULL_219VIEW_REPORT.md`
- `experiments\sensitivity_ranking_analysis\SENSITIVITY_RANKING_ANALYSIS_REPORT.md`
- `experiments\sensitivity_topk_benchmark\SENSITIVITY_TOPK_BENCHMARK_REPORT.md`
- `VIEW_DEPENDENT_SCORING_FEASIBILITY_AUDIT.md`
- `experiments\view_dependent_scoring_pilot\VIEW_DEPENDENT_SCORING_PILOT_REPORT.md`
- `experiments\sensitivity_view_topk_benchmark\SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md`
- `experiments\sensitivity_view_weight_sweep\SENSITIVITY_VIEW_WEIGHT_SWEEP_REPORT.md`

### Temporal reports

- `TEMPORAL_CONSISTENCY_FEASIBILITY_AUDIT.md`
- `experiments\temporal_consistency_feasibility_audit\` (audit JSON and sequence/overlap CSVs)
- `experiments\temporal_selection_pilot\TEMPORAL_SELECTION_PILOT_REPORT.md`
- `experiments\temporal_rendering_pilot\TEMPORAL_RENDERING_PILOT_REPORT.md`

### Profiling, optimization, scale, and integrity reports

- `experiments\selection_pipeline_profiling\SELECTION_PIPELINE_PROFILING_REPORT.md`
- `experiments\selection_pipeline_profiling\OPTIMIZATION_FEASIBILITY_ANALYSIS.md`
- `experiments\partial_topk_optimization\PARTIAL_TOPK_OPTIMIZATION_REPORT.md`
- `experiments\view_score_normalization_optimization\VIEW_SCORE_NORMALIZATION_OPTIMIZATION_REPORT.md`
- `experiments\view_score_computation_optimization\VIEW_SCORE_COMPUTATION_OPTIMIZATION_REPORT.md`
- `experiments\camera_space_covariance_optimization\CAMERA_SPACE_COVARIANCE_OPTIMIZATION_REPORT.md`
- `experiments\consolidated_pipeline_benchmark\CONSOLIDATED_PIPELINE_BENCHMARK_REPORT.md`
- `experiments\full_scale_scalability_validation\FULL_SCALE_SCALABILITY_VALIDATION_REPORT.md`
- `experiments\full_scale_scalability_validation\CORRECTNESS_VALIDATION_REPORT.md`
- `experiments\full_scale_scalability_validation\MEMORY_SCALABILITY_REPORT.md`
- `experiments\full_scale_scalability_validation\INTEGRITY_REPORT.md`

Additional existing support artifacts reviewed include the corresponding `benchmark_summary.json`, `full_scale_summary.json`, `aggregate_metrics.csv`, `runtime_comparison.csv`, `temporal_metrics_aggregate.csv`, and optimization result CSV/JSON files referenced by these reports. Earlier feasibility, installation, dataset, and calibration reports were not used to assert new experimental performance results.

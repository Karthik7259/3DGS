# Research Paper Blueprint and Claim–Evidence Matrix

**Project:** Sensitivity-Guided, View-Dependent Gaussian Selection for Efficient 3D Gaussian Splatting  
**Workspace:** `D:\3DGS-Research`  
**Status:** Paper blueprint only; this is not the research paper

## Purpose and evidence rules

This blueprint translates the existing research consolidation and finalized methodology into a writing plan. It does not add results, citations, or experiments. All claims are scoped to the Tanks and Temples Truck scene, the recorded model and camera sets, and the exact metric/timing protocols described in the source reports.

The following distinctions should be maintained in the paper:

- **Measured results** are values reported in a source experiment.
- **Calculated comparisons** are simple arithmetic from reported values, such as a PSNR difference or a speedup ratio.
- **Interpretation** explains what those measurements suggest without asserting causality or generality beyond the setup.
- **Novelty** is not established by this project’s experiments. Related-work review is required before describing any component as novel relative to the literature.

The report files that anchor this blueprint are [MASTER_RESEARCH_RESULTS_CONSOLIDATION.md](MASTER_RESEARCH_RESULTS_CONSOLIDATION.md) and [FINAL_RESEARCH_METHODOLOGY.md](FINAL_RESEARCH_METHODOLOGY.md). The detailed reports listed in the claim-evidence matrix remain the authoritative source for methods, values, and limitations.

## 1. Central Research Questions

### Primary research question

**For a trained 3D Gaussian Splatting model, how do global loss-gradient sensitivity, camera-dependent projected-footprint scoring, and a temporal minimum-retention constraint affect fixed-budget Gaussian selection quality, selection stability, and computational cost on the Tanks and Temples Truck scene?**

This phrasing asks how the investigated methods behave. It does not presuppose that a method is more accurate, faster end-to-end, or more general than alternatives.

### Secondary research questions

1. **Sensitivity:** How different is the global mean absolute gradient with respect to activated opacity from activated-opacity ranking, and how does that difference relate to held-out rendering quality across Gaussian budgets?
2. **View dependence:** Does the implemented projected-footprint/opacity proxy change Gaussian rankings with camera pose, and what quality and computational trade-offs appear when it is used alone or combined with global sensitivity?
3. **Hybrid weighting:** How do sensitivity/view weights interact with retention budget, and is any tested weight setting consistently favorable across budgets and metrics?
4. **Temporal selection:** Does enforcing a minimum overlap with the previous selected set improve selection stability and pilot rendering quality along a deterministic training-camera path, and what selection overhead does it introduce?
5. **Computational efficiency and scale:** Can the implemented score, normalization, and fixed-budget selection pipeline be accelerated while preserving scores or selected IDs, and can it process all 219 training cameras within the tested RTX 3050 memory envelope?

## 2. Preliminary Research Gap Hypothesis — Literature Verification Required

### Preliminary research gap hypothesis — literature verification required

The experimental investigation addresses a practical selection problem: when only a fixed fraction of a trained Gaussian representation is passed to the rasterizer, a single global scalar such as opacity may not reflect the chosen image-loss response across training views or the geometry projected for a particular camera. In addition, independently recomputed camera-specific subsets may change substantially along an ordered camera path, while scoring and ranking millions of Gaussians can itself be costly.

The project therefore investigates a combination of (i) global activated-opacity gradient magnitudes, (ii) a camera-dependent opacity-weighted projected-footprint proxy, (iii) a weighted score and deterministic fixed-budget selection, and (iv) an explicit minimum-retention constraint for sequential cameras. The associated implementation studies ask whether the selection pipeline can be made exact and practical at the scale of 2,050,123 Gaussians and 219 training views.

This is a **problem framing derived from the project’s experiments**, not a claim that the literature has not addressed these ideas. Before making a novelty claim, a literature review must determine which prior work already studies gradient-based Gaussian importance, camera-aware or view-dependent selection, temporal set stabilization, and exact high-throughput Top-K in 3DGS or related point-based rendering.

## 3. Potential Contributions and Evidence Status

Use cautious contribution verbs such as *investigate*, *evaluate*, *implement*, and *measure*. Avoid saying *introduce the first* or *solve* until prior work and broader validation establish those claims.

### Algorithmic contributions

| Potential contribution | Evidence classification | What is supported | What remains unestablished |
|---|---|---|---|
| Global sensitivity ranking from mean absolute gradients with respect to activated opacity over 219 training cameras | **Moderately supported; requires literature validation** | A complete deterministic score vector was computed and compared with opacity ranking; sensitivity Top-K was evaluated on the matched 32-view test set | Novelty, universal importance, causal removal impact, multi-scene behavior |
| Camera-dependent opacity-weighted projected-footprint proxy based on Graphdeco camera/covariance projection | **Experimental observation; requires further validation** | The scorer produced different rankings for different cameras and was evaluated in view-only and combined selection | True rasterizer contribution, visibility/occlusion correctness, superiority, novelty |
| Weighted sensitivity/view-dependent score with deterministic fixed-budget ranking | **Moderately supported as an empirical investigation; requires further validation** | Five weight configurations were evaluated at four budgets on the same 32 test views; the preferred setting varied with budget | A globally optimal weighting, robust statistical advantage, generalization |
| Temporal minimum-retention selector using current-frame ranks to choose retained prior IDs and fill remaining slots | **Moderately supported; requires further validation** | Exact count and retention were validated over 219 training-camera transitions; image quality was tested on 20 sampled training views | Perceptual flicker reduction, test-path performance, arbitrary-camera query semantics, generality |

### Engineering and computational contributions

| Potential contribution | Evidence classification | What is supported | What remains unestablished |
|---|---|---|---|
| Deterministic exact partial Top-K with threshold tie repair | **Engineering contribution; strongly supported in tested conditions** | Ordered IDs matched full-sort reference for tested cameras, methods, budgets, and boundary-tie cases | Performance on other devices, score distributions, or implementations |
| Exact average-tie percentile normalization using sorted unique values/counts | **Engineering contribution; strongly supported in tested conditions** | Normalized vectors and downstream rankings/selections matched the reference bitwise in validation cases | Universal speed benefit across device/software configurations |
| Batched view-score output and cached activated opacity | **Engineering contribution; strongly supported in tested conditions** | Score/visibility vectors were bitwise identical in the five-camera profile; selected IDs matched | Runtime benefit beyond the tested model, chunking, and GPU |
| Reusable world-space covariance tensor | **Engineering contribution; moderately supported** | Cached matrix path preserved bitwise covariance, scores, and ordered IDs; isolated gain was modest | Worthwhile trade-off at other model sizes/devices; no camera-specific transformed covariance is cached |
| Full 219-camera selector scalability and correctness validation | **Engineering contribution / experimental observation; strongly supported for this setup** | Four methods × four budgets ×219 cameras completed with correctness and integrity checks | Full 219-camera rendering quality, real-time rendering, multi-scene scale |

These categories describe evidence strength within the project. They are not conclusions about literature novelty.

## 4. Claim–Evidence Matrix

Confidence refers to confidence that a narrow, setup-specific statement is supported by the cited experiment, not confidence in generality or novelty.

| Claim ID | Proposed claim | Evidence | Experiment / report | Result | Limitations | Confidence |
|---|---|---|---|---|---|---|
| C1 | The 219-view activated-opacity gradient ranking is substantially different from activated-opacity ranking in this Truck model. | Average-tie Spearman and Pearson correlations; matched-size Top-K overlap | `experiments\sensitivity_ranking_analysis\SENSITIVITY_RANKING_ANALYSIS_REPORT.md` | Spearman −0.067878; raw Pearson −0.020536; overlap 1.976% at 10% and 0.779% at 5% | One scene, one objective and camera set; rank difference does not indicate better rendering | **High**, narrowly scoped |
| C2 | Sensitivity-only Top-K has budget-dependent quality relative to opacity Top-K. | Same 32 test cameras, model, render path, PNG metrics, and budgets | `experiments\sensitivity_topk_benchmark\SENSITIVITY_TOPK_BENCHMARK_REPORT.md` | Sensitivity is below opacity at 75/50/25%; above it at 10/5%: +0.2281 and +2.1809 dB PSNR, with SSIM +0.08790 and +0.17831 at those two budgets | 32-camera test split from one scene; the 5%/10% sensitivity render FPS was lower than opacity in this run | **High**, for this test protocol |
| C3 | The implemented projected-footprint score is camera-dependent. | Three-camera raw-score/rank analysis and per-camera ranking manifests for 32 test views | `VIEW_DEPENDENT_SCORING_PILOT_REPORT.md`; `SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md` | Pilot top-100 shared IDs were 3, 0, 0 across camera pairs; every sub-100% budget had 32 distinct selected sets across 32 test views | Camera-dependent ranking is not evidence of better selection; score is a proxy | **High**, for implemented scorer and tested cameras |
| C4 | The view-dependent term estimates opacity-weighted projected footprint, not true composited rasterizer contribution. | Source-aligned scorer implementation and formula audit | `VIEW_DEPENDENT_SCORING_PILOT_REPORT.md`; `FINAL_RESEARCH_METHODOLOGY.md` | Uses camera-space covariance, Jacobian, low-pass variance, 3-sigma support/clipping, and opacity; omits compositing/transmittance, occlusion, SH contrast, target error | Approximate clipping and scorer visibility rules differ from full rasterizer contribution | **High** |
| C5 | View-only ranking was weaker than sensitivity-only on this weight-sweep test set. | Five weights × four budgets on the same 32 official test views | `experiments\sensitivity_view_weight_sweep\SENSITIVITY_VIEW_WEIGHT_SWEEP_REPORT.md` | View-only PSNR below sensitivity-only by 6.5106, 3.1843, 1.3590, and 0.9919 dB at 50/25/10/5% | Single scene and test split; does not rule out other view scores or settings | **High**, within this sweep |
| C6 | The best measured hybrid weight depended on budget and metric. | Same test views and cached per-camera view scores across five weights | Weight-sweep report | 0.75/0.25 led PSNR and SSIM at 50% and 25%; sensitivity-only led PSNR at 10% and 5%; 0.50/0.50 led SSIM at 5% | No universal alpha/beta; SSIM and PSNR can favor different settings; not an independently tuned validation set | **High**, descriptive |
| C7 | Sensitivity/view hybrid selection produced camera-specific selected subsets. | 32 camera ranking hashes and selected-set counts | `SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md` | At every sub-100% budget, 32 distinct subsets were selected across 32 test cameras | This only establishes per-camera variation; it does not establish correctness of proxy contribution or visual benefit | **High** |
| C8 | In a 20-camera training-path pilot, temporal Medium and Strong had higher mean PSNR than the per-camera hybrid baseline at 10% and 5%. | Pilot’s 20-camera mean PSNR; calculated differences from reported rows | `experiments\temporal_rendering_pilot\TEMPORAL_RENDERING_PILOT_REPORT.md` | Medium/Strong gains: +1.1609/+1.1813 dB at 10%; +1.5151/+1.5485 dB at 5% (calculated) | Training-only pilot, 20 sampled cameras, not the 32 test or full 219-view rendering set; no confidence interval or repeated camera-path sampling | **Moderate** |
| C9 | Temporal retention increased adjacent selected-set stability in the 219-camera simulation. | Overlap, Jaccard, changed %, min-overlap over 218 transitions | `experiments\temporal_selection_pilot\TEMPORAL_SELECTION_PILOT_REPORT.md` and full-scale report | At 10%/5%, Medium mean overlap 95.047%/95.001%; Strong 98.000%/98.000%; minimum overlaps met R=.95/.98 | Set stability is not perceptual temporal smoothness; camera path is sorted training sequence | **High**, for set stability |
| C10 | Temporal selection has meaningful selection overhead in the rendering pilot. | Separated selection, render, total time and FPS | Temporal rendering pilot | End-to-end throughput 0.85–0.91 FPS despite render-call FPS of 55.40–80.18 depending on condition | Pilot timing definition, hardware-specific; not a general deployment estimate | **High**, for the pilot measurements |
| C11 | Exact partial ranking, normalization, and batched score computation preserve outputs in the validated configurations while reducing selection cost. | Score/normalizer bitwise checks, selected-ID equality, timing comparisons | Partial Top-K, normalization, score-computation, consolidated reports | Five-camera end-to-end consolidated path: 3.50× at 10%, 3.54× at 5%; full-scale optimized exact: 3.25×–4.22× depending on budget | Different profiles and timer boundaries; speedup applies to selection pipeline, not rendering FPS | **High**, within validated cases |
| C12 | The optimized selection pipeline completed all 219 training cameras across four methods and four budgets. | 3,504 per-camera records; correctness, temporal oracle and hash checks | `experiments\full_scale_scalability_validation\FULL_SCALE_SCALABILITY_VALIDATION_REPORT.md` and `CORRECTNESS_VALIDATION_REPORT.md` | Exact K, unique/in-range IDs, finite scores, deterministic replay and temporal retention passed; 0 test camera objects / 0 test images opened | Single scene/model/GPU; one full pass per method/budget; no rendered 219-view quality evaluation | **High**, for run completion and validation scope |
| C13 | Selection memory remained within the tested RTX 3050 capacity for the full-scale selector run. | PyTorch peak allocator and process RSS telemetry | `MEMORY_SCALABILITY_REPORT.md` | 1.045 GiB allocated, 1.422 GiB reserved, 3.161 GiB process RSS | Does not include training or rasterizer rendering; observed under this process/runtime only | **High**, for selection-only run |
| C14 | At 100% budget, subset pathways reproduce the baseline render in the checked benchmarks. | Pixel equality of all 32 test PNGs | Fixed opacity, sensitivity and combined benchmark reports | Full selection output was pixel-identical to baseline on all 32 views | A correctness control; does not support a quality advantage at reduced budgets | **High** |

### Claims that should not be made

| Unsupported claim | Why unsupported by current evidence | Safer alternative |
|---|---|---|
| “Our method universally outperforms opacity pruning.” | Sensitivity-only loses at 75/50/25%; hybrid results depend on budget; one scene only | “Performance relative to opacity Top-K varied with budget; sensitivity improved the tested 10% and 5% quality metrics in this scene.” |
| “The view-dependent score measures true Gaussian contribution.” | It is a projected-footprint/opacity proxy without compositing, transmittance, occlusion, or image-error accounting | “The score estimates an opacity-weighted projected-footprint proxy.” |
| “Temporal selection eliminates flickering.” | No optical-flow compensation or perceptual temporal metric; camera motion confounds adjacent RGB MAE | “Temporal retention increases selected-set overlap; perceptual flicker was not established.” |
| “The method generalizes to all scenes.” | All experiments are on Tanks and Temples Truck | “The evidence is limited to one Truck model and scene.” |
| “The method achieves real-time rendering.” | Full-scale tests measure selector path; temporal pilot end-to-end FPS is below one; render-call FPS excludes selection | Report each measured render-call and end-to-end rate with protocol, and avoid a general real-time claim. |
| “The method is superior to state-of-the-art Gaussian pruning.” | No comparative evaluation against named state-of-the-art methods is present | Compare to named methods only after implementing or obtaining their results under matched settings and literature review. |
| “The hybrid has one optimal weighting.” | .75/.25 leads at some budgets, while sensitivity-only leads PSNR at others; metrics differ | State the budget- and metric-dependent sweep outcome. |
| “The full temporal method was validated for all 219 rendered views.” | Only selector stability/runtime were full 219; image quality used 20 train cameras | Explicitly separate the 219-camera selector validation from the 20-camera rendering pilot. |
| “The system has low memory in rendering/training.” | Full-scale memory report is selector-only; training/render memory is a different workload | Limit memory claim to the selection pipeline and identify PyTorch/RSS scope. |

## 5. Paper Narrative

The paper should follow a question-driven, evidence-calibrated narrative:

1. **Start with the selection problem.** A trained 3DGS scene can contain millions of primitives, and passing fewer primitives to the rasterizer is a direct way to study quality/runtime trade-offs. The paper’s question concerns inference-time fixed-budget selection, not retraining or changing the renderer.
2. **Establish a simple global baseline.** Activated-opacity Top-K provides a clear reference. Its matched test results show that lower primitive counts can increase render-call throughput but reduce quality, especially at aggressive budgets.
3. **Motivate another global signal without declaring it better.** Mean absolute loss gradients with respect to activated opacity can prioritize different Gaussians than opacity. The measured weak correlation and small low-budget overlap establish ranking difference; the test benchmark shows that quality consequences depend on budget.
4. **Introduce the camera-conditioned hypothesis carefully.** A global score cannot change with camera pose. The projected-footprint score is designed to vary with projected scale, opacity, support, and image intersection. It does vary by camera, but it remains a proxy. View-only results being weaker than sensitivity-only make this a useful negative result.
5. **Evaluate combination rather than assume complementarity.** Weight sweep shows that the two signals sometimes complement one another at 50% and 25%, while sensitivity-only gives best PSNR at 10% and 5%. This motivates budget-aware analysis and guards against presenting equal weighting as universally right.
6. **Treat temporal retention as a separate constraint.** Reusing part of the prior selected set directly targets set churn. Full 219-camera simulation validates the overlap constraint; the 20-camera rendering pilot offers preliminary image-quality evidence but is not a full test-set study.
7. **Address selector cost as its own systems problem.** Scoring and ranking millions of Gaussians can offset rasterizer savings. Exact partial Top-K, normalization and data-movement optimizations reduce selector latency, and the full 219-camera validation tests operational scale. These improvements are implementation contributions, not proof of image quality.
8. **Conclude with the full evidence boundary.** The study demonstrates budget-dependent quality, camera-dependent ranking, temporally constrained selection, and a faster exact selector path on one scene. It does not show universal pruning superiority, true composited importance, real-time end-to-end rendering, or generalization.

## 6. Detailed Paper Outline

### Title

**Recommended title:** *Sensitivity-Guided and View-Dependent Gaussian Selection with Temporal Retention: An Empirical Study on 3D Gaussian Splatting*

This title names the actual ingredients and signals the single-scene empirical scope. It avoids implying universal efficiency or superiority.

**Alternative titles:**

1. *Evaluating Sensitivity and Projected-Footprint Scores for Fixed-Budget Gaussian Selection*
2. *Global and Camera-Dependent Scoring for Gaussian Subset Selection in 3D Gaussian Splatting*
3. *Temporal Retention and Exact Selection Optimization for Budgeted 3D Gaussian Splatting*

### Abstract blueprint (not final prose)

| Abstract part | Include | Evidence / qualification |
|---|---|---|
| Problem | Selecting a fixed-size subset from a trained Gaussian scene can reduce rasterizer input, but score choice affects image quality and selection cost. | Frame as the studied problem, not a solved general problem. |
| Motivation | Opacity gives a global ranking; sensitivity and projected footprint represent different, potentially complementary information; sequential camera views may produce selection churn. | Ranking analysis shows scores differ; camera score is a proxy. |
| Method | Global mean absolute derivative of a mixed L1/SSIM loss with respect to activated opacity over 219 train views; per-camera opacity-weighted projected-footprint proxy; percentile normalization, weighted score, deterministic Top-K; optional R=.95/.98 temporal retention. | State implementation choices and that view score is not composited contribution. |
| Experimental setup | Graphdeco Truck 30K model, N=2,050,123, 979×546, 219 train/32 test, RTX 3050 Laptop 6GB; quality on 32 test cameras and temporal rendering pilot on 20 training cameras. | Keep camera sets explicit. |
| Main findings | Sensitivity differs from opacity and helps at selected low budgets; .75/.25 hybrid leads at 50/25 but not all budgets; temporal pilot quality and overlap; exact selector speedup full 219. | Use precise numbers only after manuscript authors verify final tables; identify 20-camera pilot and selector-only timings. |
| Limitations | One scene; proxy score; temporal rendering pilot only 20 training cameras; no LPIPS; no optical-flow compensation; selector FPS is not render FPS. | Do not imply test-set temporal quality or perceptual flicker reduction. |
| Conclusion | Evidence supports a budget-dependent selection study and exact implementation optimization, not universal superiority. | Scope conclusion to Truck and evaluated methods. |

### 1. Introduction

Subsection objectives:

1. **Large Gaussian representations and inference cost:** introduce the fixed-budget selection setting. Define the target as reducing the number of primitives submitted to the existing renderer, not changing model training.
2. **Limits of a single global ranking:** motivate asking whether activated opacity ranks all Gaussians adequately for a loss and whether a score should vary with view. Do not assert that existing methods ignore view or sensitivity until literature review.
3. **Research questions:** state the primary question and the five secondary questions above.
4. **Approach overview:** summarize global sensitivity, projected-footprint proxy, combination, temporal retention, and exact implementation optimization.
5. **Contributions:** include only the calibrated contribution list from Section 3. Clearly separate algorithmic investigation from engineering work.
6. **Scope statement:** one Truck scene, one trained model/GPU; 32-view test quality, 20-view temporal rendering pilot, 219-view selector validation.

### 2. Related Work

Write after literature research. Do not fabricate citations or claim a gap before comparing the relevant methods.

Proposed subsections and questions:

1. **3D Gaussian Splatting:** What is the original Gaussian representation, differentiable rasterizer, and training/inference pipeline?
2. **Gaussian pruning and selection:** Which methods prune by opacity, size, visibility, projected contribution, or learned importance? Are they training-time, inference-time, global, or camera-conditioned?
3. **Importance and sensitivity-based methods:** What gradient, perturbation, ablation, or loss-based importance measures have been used for 3DGS and adjacent representations? How do their definitions differ from the local activated-opacity derivative here?
4. **View-dependent rendering and visibility:** How do methods model projection, visibility, occlusion, transmittance, or view-dependent contribution? Compare these to the present footprint proxy without equating them.
5. **Temporal consistency in rendering:** What approaches stabilize content or selection across frames/camera paths? Distinguish set overlap constraints from perceptual temporal consistency.
6. **Efficient GPU selection:** Review exact partial selection, tie handling, GPU/CPU transfer strategies, and ranking costs at million-element scale.

### 3. Methodology

Use the finalized methodology document as the canonical technical source.

Suggested subsections:

1. Problem definition and Gaussian-row identity.
2. Trained Gaussian representation and activated opacity/covariance.
3. Global activated-opacity sensitivity score and loss.
4. Zero-anchored average-tie percentile normalization.
5. Projected-footprint/opacity view score, projected covariance, support clipping, and scorer visibility rule.
6. Combined score and tested alpha/beta settings.
7. Fixed-budget Top-K and deterministic ID tie-break.
8. Temporal minimum retention, fallback, and path ordering.
9. Subset attribute gathering and unchanged Graphdeco renderer.
10. Complexity and exact computational variants, separated from the base algorithm.

### 4. Experimental Setup

1. **Hardware/software:** Intel i5-13450HX, 16 GB RAM, RTX 3050 Laptop 6 GB; Python 3.11.18, PyTorch 2.11.0+cu128, CUDA 12.8; report driver if needed and cite SYSTEM_INFO.
2. **Dataset:** Tanks and Temples Truck, 251 JPGs at 979×546, COLMAP PINHOLE reconstruction; Graphdeco eval split of 219 train/32 test. State calibration/image-resolution mismatch and that it was preserved consistently.
3. **Baseline:** original Graphdeco model, iteration 30,000, SH degree 3, 2,050,123 Gaussians; cite baseline `cfg_args`, checkpoint/PLY validation, and training report.
4. **Baselines and scores:** activated opacity; global sensitivity from 219 training views; view-dependent proxy; five tested weight pairs; temporal settings R=.95 and .98 (and R=.90 for selection-only stability pilot).
5. **Budgets:** 100/75/50/25/10/5% where applicable, with (K=\lfloor pN\rfloor\); weight sweep 50/25/10/5%; temporal rendering 10/5%.
6. **Camera sets:** all results must name the split and number of cameras. Emphasize 32 official test-view quality benchmarks, 20-camera training-path temporal rendering pilot, and 219-camera training-only selector validation.
7. **Reproducibility and integrity:** deterministic camera ordering, tie-breaking, hashes and output validation per experiment report.

### 5. Results

Organize results so reader can distinguish image quality, temporal stability, and computational cost.

1. **Baseline and opacity selection:** baseline reference and opacity quality/throughput curve on the same 32 test views.
2. **Sensitivity-based selection:** sensitivity score distribution, opacity correlation/overlap, and matched 32-test-view sensitivity-vs-opacity comparison.
3. **View-dependent scoring:** show camera-dependent rankings and the score’s proxy definition; separate the three-camera scorer pilot from the 32-view rendered benchmark.
4. **Hybrid scoring:** report all five alpha/beta settings and all four budgets; present PSNR and SSIM together so budget-specific trade-offs are visible.
5. **Temporal selection:** first report 219-camera stability simulation; separately report 20-camera rendering pilot quality and throughput. Do not blend these into one camera-set result.
6. **Computational optimization:** report component and consolidated selection latency, exactness results, and caveats about the five-camera oracle-timing issue.
7. **Scalability:** report full 219-camera selection runtime/memory/correctness; explicitly say no images were rendered in that validation.

### 6. Discussion

Organize around these questions:

- **What worked?** Score rankings differ; sensitivity improves selected low-budget test quality relative to opacity; .75/.25 hybrid is favorable at 50/25; temporal constraint yields high set overlap; exact optimized selection is faster in tested paths.
- **What did not work consistently?** Sensitivity loses at higher tested budgets; view-only is weak relative to sensitivity; no hybrid dominates; temporal selection does not deliver high end-to-end pilot throughput.
- **Trade-offs:** image quality, retained count, render-call FPS, selection latency, temporal overlap, and memory are separate axes.
- **Why hybrid results are mixed:** normalized scores may provide partially complementary signals, but their relative usefulness is budget-dependent; the proxy does not model composited visibility or image error. Treat this as interpretation, not established causal explanation.
- **Temporal quality versus overhead:** temporal selection may reduce frame-to-frame subset churn and showed improved means in a 20-camera pilot, while selection cost dominated total time. Strong and Medium had similar quality, despite different constraints.
- **Practical implications:** separate cached camera rankings from uncached scoring; report selection-inclusive throughput; discuss sequential-path assumptions.
- **Implementation implications:** exact software optimizations improve selector latency but do not themselves improve image quality.

### 7. Limitations

Include, at minimum:

- Single scene/model and one GPU; no multi-scene generalization.
- View-dependent score is an opacity-weighted projected-footprint/clipping proxy, not exact rasterizer-composited contribution.
- Sensitivity is a local derivative w.r.t. activated opacity for a fixed loss and training-camera set, not leave-one-out removal sensitivity.
- Temporal rendering quality uses 20 sampled training cameras only; no full 219-view or official test-set temporal rendering study.
- Temporal adjacent RGB MAE is not optical-flow compensated; set overlap is not perceptual flicker.
- The official 32 test views are held-out views, not a verified sequential video.
- LPIPS unavailable; PSNR/SSIM incomplete perceptual metrics.
- Calibration/image-resolution mismatch is inherited and unmodified.
- Runtime protocols differ; distinguish render-call FPS, end-to-end FPS, and selector latency; note one-pass full-scale timings and the earlier five-camera temporal in-timer oracle caveat.
- Exactness claims are scoped to validated implementations, hardware, inputs, and tested budgets.

### 8. Conclusion

Legitimate conclusion: this is a controlled empirical investigation of global sensitivity, camera-dependent projected-footprint scoring, hybrid ranking, temporal retention, and exact selection optimization on one trained Truck model. The experiments demonstrate different rankings, budget-dependent image-quality trade-offs, stable temporal sets under explicit retention, promising but limited temporal rendering-pilot quality, and scalable exact selector execution over all 219 training cameras. They do not establish universal pruning superiority, true composited Gaussian contribution, real-time end-to-end rendering, reduced perceptual flicker, or multi-scene generalization.

## 7. Proposed Figures and Tables

| ID | Figure/Table | Content | Source data | Purpose | Priority |
|---|---|---|---|---|---|
| F1 | Overall methodology diagram | Model → sensitivity and view score → normalization/combination → Top-K → optional temporal rule → subset render | `FINAL_RESEARCH_METHODOLOGY.md`; scorer/selector implementation | Orient reader to pipeline and distinct branches | High |
| F2 | Global sensitivity scoring diagram | Per-view opacity leaf, renderer/loss, gradient, absolute CPU accumulation and average | `sensitivity_full_219views` report/CSV/JSON | Clarify differentiated variable and camera aggregation | High |
| F3 | View-score visualization | Same scene/camera(s), projected footprint/visibility overlay or score maps, with explicit proxy caveat | `view_dependent_scoring_pilot` arrays/JSON and existing visualizations if useful | Explain camera dependence and proxy construction | High |
| F4 | Hybrid scoring diagram | Normalized S and V branches with alpha/beta and deterministic tie rule | Weight sweep methodology and scorer | Explain combination without implying optimality | High |
| F5 | Temporal selection diagram | Previous set, current-score re-ranking, ceil(RK) mandatory retention, fill, fallback | `temporal_selection.py`; temporal reports | Explain exact temporal rule | High |
| F6 | Experimental pipeline | Camera splits, score computation, benchmark/render path, timing boundaries | Consolidation, per-experiment manifests | Make training/test/pilot scopes and timing boundaries visible | Medium |
| T1 | Quality comparison | Baseline, opacity, sensitivity, view/hybrid weights by budget with PSNR/SSIM, camera set and K | 32-test-view aggregate CSVs | Central quality evidence and mixed effects | High |
| T2 | Temporal comparison | 219-camera overlap/Jaccard/change plus separate 20-camera pilot PSNR/SSIM/FPS | Temporal selection and rendering aggregate files | Prevent conflation of stability and image quality | High |
| T3 | Optimization comparison | Original vs exact optimized stage/pipeline time; speedup, exactness, sample size | Optimization aggregate CSVs and full-scale reports | Quantify engineering contribution and scope | High |
| T4 | Scalability and memory | 219 cameras × 4 methods × 4 budgets, speedup, VRAM/RSS, validation, integrity | Full-scale summary, memory, correctness, integrity reports | Demonstrate full training-path operational validation | High |
| T5 | Claim scope and camera sets | Method, camera set, #views, train/test, timing/quality outputs | Experiment manifests and reports | Prevent invalid cross-experiment comparisons | Medium |

Do not create the figures as part of this blueprint. Before paper submission, regenerate any final figure directly from source CSV/JSON and verify labels, camera counts, and timing definitions.

## 8. Recommended Final Paper Position

**Recommended positioning statement:**

> This paper presents an empirical study of fixed-budget Gaussian selection for a trained 3DGS model, combining a global activated-opacity gradient score with a camera-dependent projected-footprint proxy and an optional temporal minimum-retention rule. On the Tanks and Temples Truck scene, the methods produce materially different rankings and budget-dependent quality trade-offs. Temporal retention improved selected-set stability across a 219-camera training path and showed higher mean PSNR than per-camera hybrid selection in a separate 20-camera training-path rendering pilot. Exact ranking, normalization, score-transfer, and covariance-reuse optimizations reduced selection latency, and the optimized selector completed the full 219-camera path with verified counts, IDs, retention, and memory use. The evidence is scene-specific and does not establish universal superiority over conventional pruning.

This position separates:

- **Algorithmic investigation:** sensitivity, camera-dependent proxy, hybrid score, temporal retention.
- **Engineering contribution:** exact Top-K and normalization, batched score output, covariance reuse, full-scale correctness/runtime validation.

Before claiming novelty, authors must verify whether each component or combination is already present in prior work. The empirical results alone cannot establish literature novelty.

## 9. Unsupported Claims to Avoid

Avoid these claims in the abstract, title, introduction, results, and conclusion unless new evidence is produced:

1. Universal superiority over opacity pruning or other Gaussian pruning methods.
2. True per-Gaussian rasterizer contribution, visual contribution, or exact visibility from the projected-footprint score.
3. Elimination or perceptual reduction of flickering.
4. Generalization to arbitrary scenes, camera paths, resolutions, GPUs, or model sizes.
5. Real-time end-to-end rendering based on render-call FPS that excludes selection.
6. State-of-the-art superiority without a matched comparison to named methods.
7. One globally optimal alpha/beta weighting.
8. Full 219-camera temporal rendering quality or test-set temporal validation.
9. A claim that higher selection overlap necessarily improves visual smoothness or quality.
10. A claim that the full-scale memory measurement includes training or rasterizer rendering.
11. A claim that faster floating-point reassociation variants are exact; they changed values and ordered IDs.
12. A claim that 100% pixel equality demonstrates an improvement; it is a correctness check.

## 10. Literature Questions Requiring External Research

No literature search was conducted for this blueprint. Before writing the related-work section or making novelty claims, investigate:

1. Which 3DGS pruning/selection methods use opacity, scale, screen-space size, visibility, accumulated contribution, gradient magnitude, or loss perturbation?
2. Has any prior work differentiated rendered loss with respect to **activated opacity** per Gaussian, aggregated across views, then used the result for inference-time fixed-budget Top-K?
3. How do prior importance methods define sensitivity: gradient magnitude, Hessian/Fisher approximation, parameter perturbation, leave-one-out rendering, or contribution under compositing?
4. Which methods compute camera-conditioned Gaussian subsets or view-dependent importance? Do they use projected covariance/area, rasterizer compositing, visibility, occlusion, or learned view scores?
5. Are there prior 3DGS approaches combining a global importance score with a camera-specific score, and which normalization/weighting strategies do they use?
6. Has temporal minimum set retention or hysteresis been applied to Gaussian selection? How does that differ from temporal consistency losses, culling stability, caching, or motion-aware methods?
7. What established temporal image-quality metrics compensate for camera motion using optical flow, pose, or reprojection, and how should this project’s pilot be positioned relative to them?
8. Which exact Top-K algorithms and deterministic tie-resolution approaches are standard for million-element GPU/CPU ranking workloads? What comparable systems research exists?
9. Are unique/count-based tied percentile normalizers, batched score transfers, or covariance caching established techniques in adjacent rendering or point-cloud workloads? If so, frame them as engineering choices rather than novel algorithms.
10. What named baselines should be implemented or compared under the same model, Gaussian budgets, renderer, camera set, metric, and timing boundary before making comparative claims?
11. What reproducibility norms apply to single-scene 3DGS pruning studies, especially test camera choice, per-view variability, random seeds, timing repetitions, and confidence intervals?
12. What citation and dataset-use requirements apply to Tanks and Temples and the Graphdeco implementation?

## Required Deliverables at the End of the Blueprint

### Recommended research question

For a trained 3DGS model, how do global loss-gradient sensitivity, camera-dependent projected-footprint scoring, and a temporal minimum-retention constraint affect fixed-budget Gaussian selection quality, stability, and computational cost on the Truck scene?

### Preliminary research gap hypothesis

The project investigates whether global opacity ranking alone captures the loss- and view-dependent behavior relevant to fixed-budget Gaussian selection, whether a projected-footprint proxy adds useful camera dependence, and whether temporal retention can stabilize sequential selections without making selection cost impractical. This is a **preliminary research gap hypothesis — literature verification required**, not a novelty claim.

### Final proposed contributions

1. Empirical comparison of activated-opacity and global activated-opacity-gradient rankings at matched Gaussian budgets.
2. Implementation and evaluation of an explicitly approximate camera-dependent opacity-weighted projected-footprint score and its weighted combinations with sensitivity.
3. A deterministic temporal minimum-retention selection rule evaluated for 219-camera set stability and in a separate 20-camera rendering pilot.
4. Exact implementation optimizations and a full 219-camera selector scalability/correctness/memory validation.

Contributions 1–3 are empirical algorithmic investigations whose novelty and broader effectiveness require literature review and further validation. Contribution 4 is principally an engineering contribution, demonstrated on this scene and system.

### Claim-evidence matrix

See Section 4, Claims C1–C14. Each entry identifies its report, measured result, limitation, and scoped confidence.

### Recommended title

*Sensitivity-Guided and View-Dependent Gaussian Selection with Temporal Retention: An Empirical Study on 3D Gaussian Splatting*

### Paper outline

See Section 6: Introduction, Related Work, Methodology, Experimental Setup, Results, Discussion, Limitations, Conclusion.

### Figure and table plan

See Section 7, F1–F6 and T1–T5. No figures were created.

### Unsupported claims to avoid

See Section 9. Key exclusions are universal superiority, true composited contribution, flicker elimination, multi-scene generalization, real-time end-to-end rendering, and unqualified state-of-the-art claims.

### Literature questions requiring external research

See Section 10. Novelty statements must wait for a review of sensitivity, view-dependent selection, temporal selection, pruning baselines, and exact ranking systems work.

## Source Documents Consulted

- `MASTER_RESEARCH_RESULTS_CONSOLIDATION.md`
- `FINAL_RESEARCH_METHODOLOGY.md`
- `experiments\sensitivity_ranking_analysis\SENSITIVITY_RANKING_ANALYSIS_REPORT.md`
- `experiments\sensitivity_topk_benchmark\SENSITIVITY_TOPK_BENCHMARK_REPORT.md`
- `experiments\view_dependent_scoring_pilot\VIEW_DEPENDENT_SCORING_PILOT_REPORT.md`
- `experiments\sensitivity_view_topk_benchmark\SENSITIVITY_VIEW_TOPK_BENCHMARK_REPORT.md`
- `experiments\sensitivity_view_weight_sweep\SENSITIVITY_VIEW_WEIGHT_SWEEP_REPORT.md`
- `experiments\temporal_selection_pilot\TEMPORAL_SELECTION_PILOT_REPORT.md`
- `experiments\temporal_rendering_pilot\TEMPORAL_RENDERING_PILOT_REPORT.md`
- `experiments\partial_topk_optimization\PARTIAL_TOPK_OPTIMIZATION_REPORT.md`
- `experiments\view_score_normalization_optimization\VIEW_SCORE_NORMALIZATION_OPTIMIZATION_REPORT.md`
- `experiments\view_score_computation_optimization\VIEW_SCORE_COMPUTATION_OPTIMIZATION_REPORT.md`
- `experiments\camera_space_covariance_optimization\CAMERA_SPACE_COVARIANCE_OPTIMIZATION_REPORT.md`
- `experiments\consolidated_pipeline_benchmark\CONSOLIDATED_PIPELINE_BENCHMARK_REPORT.md`
- `experiments\full_scale_scalability_validation\FULL_SCALE_SCALABILITY_VALIDATION_REPORT.md`
- `experiments\full_scale_scalability_validation\CORRECTNESS_VALIDATION_REPORT.md`
- `experiments\full_scale_scalability_validation\MEMORY_SCALABILITY_REPORT.md`
- `experiments\full_scale_scalability_validation\INTEGRITY_REPORT.md`

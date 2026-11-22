export const temporalMethods = ['baseline', 'temporal_medium', 'temporal_strong'] as const;
export type TemporalMethod = typeof temporalMethods[number];
export type TemporalBudget = 5 | 10;
export const temporalNames: Record<TemporalMethod, string> = {
  baseline: 'Independent', temporal_medium: 'Medium · R = 0.95', temporal_strong: 'Strong · R = 0.98',
};
export type FrameMetrics = {
  count: number; shared: number | null; overlap: number | null;
  psnr: number; ssim: number; renderFps: number;
};
export type PilotFrame = {
  image: string; loaderIndex: number;
  results: Record<TemporalMethod, Record<TemporalBudget, FrameMetrics>>;
};
export type TemporalPilot = { frames: PilotFrame[]; trainingSequence: string[] };

export function temporalAsset(kind: 'ids' | 'render', method: TemporalMethod, budget: TemporalBudget, frame: number) {
  return `/api/temporal/${kind}/${method}/${budget}/${frame}`;
}

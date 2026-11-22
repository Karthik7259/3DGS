export type BenchmarkMethod = 'opacity' | 'sensitivity' | 'hybrid';

export type BenchmarkPoint = {
  method: BenchmarkMethod;
  budget: number;
  count: number;
  psnr: number;
  ssim: number;
  fps: number;
};

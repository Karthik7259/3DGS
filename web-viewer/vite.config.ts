import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { temporalArchive } from './server/temporal.ts';
import type { TemporalBudget, TemporalMethod } from './src/temporalData';

const experiments = fileURLToPath(new URL('../experiments/', import.meta.url));
const ply = path.join(experiments, 'baseline_truck/point_cloud/iteration_30000/point_cloud.ply');
const cameras = path.join(experiments, 'baseline_truck/cameras.json');
const temporal = temporalArchive(experiments);
const gaussianCount = 2_050_123;
const budgets = new Set([5, 10, 25, 50, 75, 100]);
const benchmarkDirs = {
  opacity: 'fixed_topk_benchmark',
  sensitivity: 'sensitivity_topk_benchmark',
  hybrid: 'sensitivity_view_topk_benchmark',
} as const;
type Method = keyof typeof benchmarkDirs;
type CameraSelection = { image_name: string; ranking_path: string; test_view_index: number };

function isMethod(value: string): value is Method {
  return Object.hasOwn(benchmarkDirs, value);
}

function fail(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function send(req: IncomingMessage, res: ServerResponse, body: Buffer, type: string) {
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.byteLength, 'Cache-Control': 'private, max-age=3600' });
  res.end(req.method === 'HEAD' ? undefined : body);
}

// Accept a single byte range, including a suffix range. The same handler serves
// the installed PLY during local development and production preview.
async function serveFile(req: IncomingMessage, res: ServerResponse, file: string, type: string) {
  const { size } = await stat(file);
  const range = req.headers.range;
  let start = 0;
  let end = size - 1;
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
      if (match[1] && match[2]) end = Math.min(Number(match[2]), end);
    } else start = size;
    if (!Number.isSafeInteger(start) || start > end || start >= size) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return fail(res, 416, 'Invalid byte range.');
    }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  res.writeHead(range ? 206 : 200, {
    'Content-Type': type,
    'Content-Length': end - start + 1,
    'Cache-Control': file === ply ? 'no-store' : 'private, max-age=3600',
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, { start, end });
  res.on('close', () => stream.destroy());
  stream.on('error', (error) => res.destroy(error));
  stream.pipe(res);
}

async function references() {
  const file = path.join(experiments, benchmarkDirs.hybrid, 'selected_gaussian_ids.json');
  const data = JSON.parse(await readFile(file, 'utf8')) as { camera_selections: CameraSelection[] };
  const entries = data.camera_selections.sort((a, b) => a.test_view_index - b.test_view_index);
  if (entries.length !== 32 || entries.some((entry, index) => entry.test_view_index !== index)) {
    throw new Error('Saved camera indices do not match the 32-view benchmark.');
  }
  return entries;
}

const globalRanks = new Map<Method, Promise<Uint32Array>>();
function globalRanking(method: 'opacity' | 'sensitivity') {
  const cached = globalRanks.get(method);
  if (cached) return cached;
  const file = method === 'opacity' ? ply : path.join(experiments, benchmarkDirs.sensitivity, 'results/selected_gaussian_ids.json');
  const job = new Promise<Uint32Array>((resolve, reject) => {
    const worker = new Worker(new URL('./server/ranking-worker.mjs', import.meta.url), {
      workerData: { method, file, count: gaussianCount },
      execArgv: [],
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code) reject(new Error(`Ranking worker exited with code ${code}.`)); });
  });
  globalRanks.set(method, job);
  job.catch(() => globalRanks.delete(method));
  return job;
}

async function hybridRanking(entry: CameraSelection, count: number) {
  // Saved manifests use Windows paths even if the checkout is on another OS.
  const name = path.win32.basename(entry.ranking_path);
  const ranking = path.join(experiments, benchmarkDirs.hybrid, 'results/camera_rankings', name);
  const file = await open(ranking, 'r');
  try {
    const header = Buffer.alloc(512);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (!header.subarray(0, 6).equals(Buffer.from([0x93, 78, 85, 77, 80, 89])) || header[6] !== 1) {
      throw new Error('Unsupported benchmark NumPy ranking.');
    }
    const offset = 10 + header.readUInt16LE(8);
    const meta = header.toString('ascii', 10, offset);
    if (offset > bytesRead || !meta.includes("'descr': '<u4'") || !meta.includes(`'shape': (${gaussianCount},)`) ||
        !meta.includes("'fortran_order': False") || (await file.stat()).size !== offset + gaussianCount * 4) {
      throw new Error('Invalid benchmark Gaussian ID array.');
    }
    const ids = Buffer.allocUnsafe(count * 4);
    let received = 0;
    while (received < ids.length) {
      const read = await file.read(ids, received, ids.length - received, offset + received);
      if (!read.bytesRead) throw new Error('Truncated Gaussian ID array.');
      received += read.bytesRead;
    }
    return ids;
  } finally {
    await file.close();
  }
}

async function metricRow(method: Method, budget: number) {
  const csv = await readFile(path.join(experiments, benchmarkDirs[method], 'results/aggregate_metrics.csv'), 'utf8');
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const names = header.split(',');
  const rows = lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [names[i], Number(v)])));
  const row = rows.find(r => (r.percentage ?? r.budget_percent) === budget);
  if (!row) throw new Error('Missing saved benchmark metrics.');
  return { count: row.K, psnr: row.mean_PSNR_dB ?? row.PSNR_mean, ssim: row.mean_SSIM ?? row.SSIM_mean };
}

async function researchEndpoint(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.pathname;
  const render = /^\/benchmark-render\/(original|opacity|sensitivity|hybrid)\/(\d{1,3})\/(\d{5})\.png$/.exec(route);
  const api = ['/api/selection', '/api/selection-references', '/api/benchmark-comparison'];
  const pilotRoute = route === '/api/temporal' || route.startsWith('/api/temporal/');
  if (!render && !pilotRoute && route !== '/model/truck.ply' && route !== '/model/cameras.json' && !api.includes(route)) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return fail(res, 405, 'Method not allowed.');
  }
  if (route === '/model/truck.ply') return serveFile(req, res, ply, 'application/octet-stream');
  if (route === '/model/cameras.json') return serveFile(req, res, cameras, 'application/json; charset=utf-8');
  if (pilotRoute) {
    if (route === '/api/temporal') return send(req, res, Buffer.from(JSON.stringify(await temporal.manifest())), 'application/json');
    const match = /^\/api\/temporal\/(ids|render)\/(baseline|temporal_medium|temporal_strong)\/(5|10)\/(0|[1-9]|1\d)$/.exec(route);
    if (!match) return fail(res, 404, 'Unknown temporal sample.');
    const value = await temporal.asset(match[1] as 'ids' | 'render', match[2] as TemporalMethod, Number(match[3]) as TemporalBudget, Number(match[4]));
    if (typeof value === 'string') return serveFile(req, res, value, 'image/png');
    return send(req, res, value, 'application/octet-stream');
  }
  if (render) {
    const [, method, budget, frame] = render;
    if (!budgets.has(Number(budget)) || Number(frame) >= 32 || (method === 'original' && Number(budget) !== 100)) {
      return fail(res, 400, 'Invalid benchmark budget or camera.');
    }
    const dir = isMethod(method) ? path.join(benchmarkDirs[method], 'renders', budget) : 'baseline_truck/test/ours_30000/renders';
    return serveFile(req, res, path.join(experiments, dir, frame + '.png'), 'image/png');
  }
  if (route === '/api/selection-references') {
    return send(req, res, Buffer.from(JSON.stringify((await references()).map(c => c.image_name))), 'application/json');
  }
  const method = url.searchParams.get('method') ?? '';
  const budget = Number(url.searchParams.get('budget'));
  if (!isMethod(method) || !budgets.has(budget)) return fail(res, 400, 'Invalid selection method or budget.');
  if (route === '/api/benchmark-comparison') {
    const frame = Number(url.searchParams.get('frame'));
    if (!Number.isInteger(frame) || frame < 0 || frame >= 32) return fail(res, 400, 'Invalid test view.');
    const name = String(frame).padStart(5, '0') + '.png';
    const [base, selected] = await Promise.all([metricRow('opacity', 100), metricRow(method, budget)]);
    const result = {
      method, budget, gaussianCount: selected.count, testViews: 32, viewIndex: frame,
      original: { url: `/benchmark-render/original/100/${name}`, psnr: base.psnr, ssim: base.ssim },
      selected: { url: `/benchmark-render/${method}/${budget}/${name}`, psnr: selected.psnr, ssim: selected.ssim,
        deltaPsnr: selected.psnr - base.psnr, deltaSsim: selected.ssim - base.ssim },
    };
    return send(req, res, Buffer.from(JSON.stringify(result)), 'application/json');
  }
  const count = Math.floor(gaussianCount * budget / 100);
  let ids: Buffer;
  if (method === 'hybrid') {
    const reference = url.searchParams.get('reference');
    const entry = (await references()).find(c => c.image_name === reference);
    if (!entry) return fail(res, 400, 'Choose a saved benchmark reference view.');
    ids = await hybridRanking(entry, count);
  } else {
    const ranking = await globalRanking(method);
    ids = Buffer.from(ranking.buffer, ranking.byteOffset, count * 4);
  }
  res.setHeader('X-Gaussian-Count', count);
  return send(req, res, ids, 'application/octet-stream');
}

function researchData(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    researchEndpoint(req, res, next).catch((error: NodeJS.ErrnoException) => {
      if (res.destroyed) return;
      fail(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Research asset not found in this checkout.' : error.message);
    });
  };
  return {
    name: 'read-only-local-research-data',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [react(), researchData()],
  server: { strictPort: true, watch: { ignored: ['**/validation/**', '**/.browser-profile/**'] } },
});


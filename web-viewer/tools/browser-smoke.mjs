import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { freemem, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyTemporalPlayback } from './temporal-playback-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validationDir = path.join(root, 'validation');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;
const viewerUrl = process.env.TRUCK_VIEWER_URL ?? 'http://127.0.0.1:5173/';
const browser = spawn(chrome, [
  '--headless=new', '--enable-webgl', '--enable-gpu', '--force-high-performance-gpu', '--use-gl=angle', '--use-angle=d3d11',
  '--enable-logging=stderr', '--v=0', '--no-first-run', '--disable-extensions',
  '--disable-background-networking', `--user-data-dir=${path.join(validationDir, 'browser-profile')}`,
  `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
  '--window-size=1440,1000', '--hide-scrollbars', viewerUrl,
], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

let browserOutput = '';
browser.stderr.on('data', (chunk) => { browserOutput += chunk.toString(); });
browser.stdout.on('data', (chunk) => { browserOutput += chunk.toString(); });
const errors = [];
let ws;
let nextId = 0;
const pending = new Map();
let frame = null;
let gpuPeakMiB = 0;
const gpuSamples = [];

function pollGpu() {
  try {
    const line = execFileSync('nvidia-smi', ['--query-gpu=memory.used,memory.free,utilization.gpu', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 2500 }).trim();
    const [used, free, util] = line.split(',').map((v) => Number(v.trim()));
    if (Number.isFinite(used)) gpuPeakMiB = Math.max(gpuPeakMiB, used);
    gpuSamples.push({ usedMiB: used, freeMiB: free, utilizationPercent: util,
      systemFreeMiB: Math.round(freemem() / 2 ** 20), systemTotalMiB: Math.round(totalmem() / 2 ** 20), at: new Date().toISOString() });
  } catch (error) { gpuSamples.push({ error: String(error) }); }
}

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForTarget() {
  for (let i = 0; i < 100; i += 1) {
    if (browser.exitCode !== null) throw new Error(`Chrome exited early (${browser.exitCode}). ${browserOutput.slice(-2000)}`);
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === 'page' && item.url.startsWith(new URL(viewerUrl).origin));
      if (target) return target;
    } catch { /* DevTools is not ready yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

async function main() {
  await mkdir(validationDir, { recursive: true });
  const target = await waitForTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.method === 'Runtime.exceptionThrown') errors.push({ type: 'exception', detail: message.params.exceptionDetails?.text });
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push({ type: 'log', detail: message.params.entry.text });
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push({ type: 'console', detail: message.params.args?.map((arg) => arg.value ?? arg.description).join(' ') });
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      clearTimeout(task.timeout);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  const start = Date.now();
  let state = 'unknown';
  while (Date.now() - start < 300000) {
    pollGpu();
    const evaluated = await send('Runtime.evaluate', {
      expression: `({badge: document.querySelector('.badge')?.textContent?.trim() ?? 'missing', message: document.querySelector('.load-message')?.textContent ?? '', canvas: Boolean(document.querySelector('canvas')), canvasSize: (() => { const c=document.querySelector('canvas'); return c ? [c.width,c.height] : null })()})`,
      returnByValue: true,
    });
    frame = evaluated.result?.value ?? null;
    state = frame?.badge?.toUpperCase() ?? 'UNKNOWN';
    if (state === 'READY' || state === 'OFFLINE') break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const loadSeconds = (Date.now() - start) / 1000;
  assert.equal(state, 'READY', frame?.message);
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const details = await send('Runtime.evaluate', {
    expression: `({model: window.__viewerDebug ?? null, camera: (() => { const c=document.querySelector('canvas'); return c ? {width:c.width,height:c.height} : null })(), webgl: (() => { const c=document.querySelector('canvas'); const gl=c?.getContext('webgl2'); const ext=gl?.getExtension('WEBGL_debug_renderer_info'); return gl ? {renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)} : null })(), initialCamera: window.__viewerInitialCamera ?? null})`,
    returnByValue: true,
  });
  const cameraState = async () => (await send('Runtime.evaluate', { expression: 'window.__viewerCamera ?? null', returnByValue: true })).result?.value ?? null;
  const cameraBefore = await cameraState();
  const mouse = async (type, x, y, button = 'left', buttons = 1, deltaY) => send('Input.dispatchMouseEvent', { type, x, y, button, buttons, ...(deltaY === undefined ? {} : { deltaX: 0, deltaY }) });
  await mouse('mousePressed', 480, 330, 'left', 1);
  await mouse('mouseMoved', 590, 365, 'left', 1);
  await mouse('mouseReleased', 590, 365, 'left', 0);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const cameraAfterOrbit = await cameraState();
  await mouse('mouseWheel', 500, 330, 'none', 0, -240);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const cameraAfterZoom = await cameraState();
  await mouse('mousePressed', 500, 330, 'right', 2);
  await mouse('mouseMoved', 550, 355, 'right', 2);
  await mouse('mouseReleased', 550, 355, 'right', 0);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const cameraAfterPan = await cameraState();
  await send('Runtime.evaluate', { expression: "document.querySelector('.reset-button')?.click()", returnByValue: true });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const cameraAfterReset = await cameraState();
  const delta = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  assert.ok(delta(cameraBefore.position, cameraAfterOrbit.position) > 0.01, 'Orbit should move the camera');
  assert.ok(cameraAfterZoom.zoom > cameraAfterOrbit.zoom, 'Capture orbit wheel should zoom optically');
  assert.ok(delta(cameraAfterPan.target, cameraAfterZoom.target) > 0.01, 'Pan should move the target');
  assert.ok(delta(cameraBefore.position, cameraAfterReset.position) < 1e-4, `Reset position ${cameraAfterReset.position} should match ${cameraBefore.position}`);
  assert.ok(delta(cameraBefore.target, cameraAfterReset.target) < 1e-4, 'Reset should restore the starting target');
  const motion = (await send('Runtime.evaluate', {expression: "document.querySelector('.diagnostics strong')?.textContent", returnByValue: true})).result?.value;
  assert.equal(errors.length, 0, JSON.stringify(errors));

  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(validationDir, 'workspace-smoke.png'), Buffer.from(capture.data, 'base64'));
  const temporal = await verifyTemporalPlayback({ send, validationDir, viewerUrl, pollGpu, gpuSamples });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = {
    state,
    finalFrame: frame,
    details: details.result?.value ?? null,
    controls: { cameraBefore, cameraAfterOrbit, cameraAfterZoom, cameraAfterPan, cameraAfterReset },
    temporal,
    loadSeconds,
    lastCameraMotion: motion,
    elapsedSeconds: Math.round((Date.now() - start) / 1000),
    consoleErrors: errors,
    gpuPeakUsedMiB: gpuPeakMiB,
    gpuSamples,
    browserStderrTail: browserOutput.slice(-6000),
    screenshot: 'validation/workspace-smoke.png',
  };
  await writeFile(path.join(validationDir, 'workspace-smoke-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ state, loadSeconds, motion, gpuPeakMiB, temporal }, null, 2));
  ws.close();
  browser.kill();
  if (state !== 'READY') process.exitCode = 2;
}

main().catch(async (error) => {
  const result = { state: 'HARNESS_ERROR', message: String(error), consoleErrors: errors, browserStderrTail: browserOutput.slice(-6000) };
  await mkdir(validationDir, { recursive: true });
  await writeFile(path.join(validationDir, 'workspace-smoke-results.json'), JSON.stringify(result, null, 2));
  browser.kill();
  console.error(result.message);
  process.exitCode = 1;
});

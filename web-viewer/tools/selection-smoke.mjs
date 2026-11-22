import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validation = path.join(root, 'validation');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9224;
const browser = spawn(chrome, [
  '--headless=new', '--enable-webgl', '--enable-gpu', '--force-high-performance-gpu', '--use-gl=angle', '--use-angle=d3d11',
  '--no-first-run', '--disable-extensions', `--user-data-dir=${path.join(validation, 'selection-browser-profile')}`,
  `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
  '--window-size=1440,1000', process.env.TRUCK_VIEWER_URL ?? 'http://127.0.0.1:5173/',
], { windowsHide: true, stdio: 'ignore' });

let ws;
let nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function waitFor(predicate, argument, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await send('Runtime.evaluate', { expression: `(${predicate})(${JSON.stringify(argument) ?? ''})`, returnByValue: true });
    if (result.result?.value) return result.result.value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${predicate}`);
}

async function setSelect(id, value) {
  const expression = `(()=>{const e=document.getElementById(${JSON.stringify(id)});const s=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;s.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`;
  await send('Runtime.evaluate', { expression, returnByValue: true });
}

async function main() {
  await mkdir(validation, { recursive: true });
  let target;
  for (let retry = 0; retry < 80; retry++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = targets.find((item) => item.type === 'page');
      if (target) break;
    } catch { /* Chrome still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!target) throw new Error('Chrome DevTools endpoint did not start.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      clearTimeout(entry.timeout);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
  });
  await send('Runtime.enable');
  await waitFor(() => window.__viewerDebug?.gaussianCount === 2050123);
  const output = { original: await waitFor(() => window.__viewerSelectionDebug) };

  for (const technique of ['opacity', 'sensitivity', 'hybrid']) {
    await setSelect('technique-select', technique);
    await send('Runtime.evaluate', { expression: "Array.from(document.querySelectorAll('.budget-grid button')).find(b => b.textContent === '5%').click()" });
    const selection = await waitFor((method) => window.__viewerSelectionDebug?.technique === method
      && window.__viewerSelectionDebug?.budget === 5 ? window.__viewerSelectionDebug : null, technique);
    const panel = await send('Runtime.evaluate', {
      expression: `({ badge: document.querySelector('.selection-status')?.textContent ?? '', metrics: Array.from(document.querySelectorAll('.stat-row')).map(row=>row.innerText) })`,
      returnByValue: true,
    });
    output[technique] = { ...selection, panel: panel.result?.value };
  }

  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(validation, 'milestone2-selection-smoke.png'), Buffer.from(screenshot.data, 'base64'));
  await writeFile(path.join(validation, 'selection-smoke-results.json'), JSON.stringify(output, null, 2));
  ws.close();
  browser.kill();
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(String(error));
  ws?.close();
  browser.kill();
  process.exitCode = 1;
});

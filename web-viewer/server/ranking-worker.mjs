import { openSync, readSync, closeSync, readFileSync } from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';

// Ranking is computed once per method off the HTTP thread. Only the resulting
// Uint32Array survives the worker, and its backing store is transferred.
const { method, file, count } = workerData;

function opacityRanking() {
  const fd = openSync(file, 'r');
  try {
    const headerBuffer = Buffer.alloc(65536);
    const bytesRead = readSync(fd, headerBuffer, 0, headerBuffer.length, 0);
    const header = /^([\s\S]*?end_header\r?\n)/.exec(headerBuffer.toString('latin1', 0, bytesRead))?.[0];
    const properties = header?.split(/\r?\n/).filter(line => line.startsWith('property ')) ?? [];
    const stride = properties.length * 4;
    const opacityOffset = properties.indexOf('property float opacity') * 4;
    if (!header?.includes('format binary_little_endian 1.0') ||
        Number(header.match(/element vertex (\d+)/)?.[1]) !== count ||
        stride !== 248 || opacityOffset < 0 || !properties.every(line => line.startsWith('property float '))) {
      throw new Error('Unexpected Truck Gaussian PLY layout.');
    }
    const scores = new Float32Array(count);
    const ids = new Uint32Array(count);
    const batchSize = 32768;
    const buffer = Buffer.allocUnsafe(batchSize * stride);
    for (let start = 0; start < count; start += batchSize) {
      const records = Math.min(batchSize, count - start);
      const length = records * stride;
      const offset = header.length + start * stride;
      if (readSync(fd, buffer, 0, length, offset) !== length) throw new Error('Incomplete Truck PLY.');
      for (let row = 0; row < records; row++) {
        const logit = buffer.readFloatLE(row * stride + opacityOffset);
        scores[start + row] = 1 / (1 + Math.exp(-logit));
        ids[start + row] = start + row;
      }
    }
    return ids.sort((a, b) => scores[b] - scores[a] || a - b);
  } finally {
    closeSync(fd);
  }
}

function sensitivityRanking() {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest['100']?.length !== count) throw new Error('Incomplete saved sensitivity ranking.');
  return Uint32Array.from(manifest['100']);
}

const ranking = method === 'opacity' ? opacityRanking() : sensitivityRanking();
parentPort.postMessage(ranking, [ranking.buffer]);

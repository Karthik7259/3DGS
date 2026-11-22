import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Quaternion, Vector3 } from 'three';

// Run through the same page and WebGL context as the existing workspace smoke test.
export async function verifyTemporalPlayback({send, validationDir, viewerUrl, pollGpu, gpuSamples}) {
  const page = async (fn, arg) => {
    const response = await send('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + (JSON.stringify(arg) ?? '') + ')',
      returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result?.value;
  };
  const wait = async (fn, arg, ms = 45000) => {
    const start = Date.now();
    do {
      const result = await page(fn, arg);
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 80));
    } while (Date.now() - start < ms);
    throw new Error('Timed out waiting for ' + fn);
  };
  const click = text => page(label => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === label).click(), text);
  const control = label => page(name => document.querySelector('button[aria-label="' + name + '"]').click(), label);
  const setValue = (selector, value) => page(([selector, value]) => {
    const field = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
    field.dispatchEvent(new Event(field.matches('input') ? 'input' : 'change', {bubbles: true}));
  }, [selector, String(value)]);
  const screenshot = async name => {
    const capture = await send('Page.captureScreenshot', {format: 'jpeg', quality: 91});
    await writeFile(path.join(validationDir, name + '.jpg'), Buffer.from(capture.data, 'base64'));
  };
  const pilot = await fetch(new URL('/api/temporal', viewerUrl)).then(r => r.json());
  const cameras = await fetch(new URL('/model/cameras.json', viewerUrl)).then(r => r.json());
  const verifyPose = (camera, image) => {
    const source = cameras.find(c => c.img_name === image);
    const positionError = new Vector3().fromArray(camera.position).distanceTo(new Vector3(...source.position));
    assert.ok(positionError < 1e-6, 'Incorrect camera position for ' + image + ' (' + positionError + ')');
    const rotation = new Quaternion().fromArray(camera.quaternion);
    for (const [axis, sign] of [[0, 1], [1, -1], [2, -1]]) {
      const direction = new Vector3().setComponent(axis, sign).applyQuaternion(rotation);
      assert.ok(direction.distanceTo(new Vector3(...source.rotation.map(r => r[axis]))) < 1e-6, 'Incorrect camera basis for ' + image);
    }
  };
  const verifySelection = async (state, method, budget, frame) => {
    const url = '/api/temporal/ids/' + [method, budget, frame].join('/');
    assert.equal(state.url, url);
    assert.equal(state.selectedCount, pilot.frames[frame].results[method][budget].count);
    const buffer = await fetch(new URL(url, viewerUrl)).then(r => r.arrayBuffer());
    assert.deepEqual(state.firstGaussianIds, Array.from(new Uint32Array(buffer, 0, 5)));
  };
  const ready = (method, budget, frame) => wait(url => {
    const data = window.__viewerSelectionDebug;
    if (data?.url === url && document.querySelector('.live-tag') && !document.querySelector('.pilot-loading')) {
      return { selection:data, camera:window.__viewerCamera };
    }
  }, '/api/temporal/ids/' + [method,budget,frame].join('/'));
  const seek = frame => setValue('.timeline input', frame + 1);

  await setValue('#technique-select', 'opacity');
  await click('75%');
  await wait(() => window.__viewerSelectionDebug?.technique === 'opacity' && document.querySelector('.count')?.textContent === '1,537,592');
  await setValue('.orbit-mode', 'capture');
  await control('Reset camera to front three-quarter');
  await new Promise(resolve => setTimeout(resolve, 800));
  await screenshot('inspector-opacity-75');
  const rectangle = await page(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return {x:Math.round(r.x + r.width / 8), y:Math.round(r.y + r.height / 2), width:document.querySelector('canvas').clientWidth};
  });
  const anchor = await page(() => window.__viewerCamera);
  let lastPosition = new Vector3(...anchor.position);
  for (let quarter = 0; quarter < 4; quarter++) {
    const distance = Math.round((quarter + 1) * rectangle.width / 4) - Math.round(quarter * rectangle.width / 4);
    const drag = (type, dx, buttons) => send('Input.dispatchMouseEvent', {
      type, x:rectangle.x + dx, y:rectangle.y, button:'left', buttons,
    });
    await drag('mousePressed', 0, 1);
    for (let i = 1; i <= 8; i++) await drag('mouseMoved', Math.round(distance * i / 8), 1);
    await drag('mouseReleased', distance, 0);
    await new Promise(resolve => setTimeout(resolve, 350));
    const next = await page(() => window.__viewerCamera);
    const position = new Vector3(...next.position);
    assert.ok(position.distanceTo(lastPosition) > 1, 'Quarter turn moved around the truck');
    lastPosition = position;
    if (quarter === 1) await screenshot('capture-orbit-half-turn');
  }
  assert.ok(lastPosition.distanceTo(new Vector3(...anchor.position)) < 1e-6);
  assert.ok(new Quaternion(...anchor.quaternion).angleTo(new Quaternion(...(await page(() => window.__viewerCamera)).quaternion)) < 1e-6);
  await click('Model');
  assert.ok(await page(() => document.querySelector('#panel-model').innerText.includes('Degree 3')));
  await click('Selection');
  await page(() => { window.__testCanvas = document.querySelector('canvas'); window.__testModel = window.__viewerDebug; });
  const before = await page(() => window.__viewerCamera);
  await click('Temporal Analysis');
  const first = await ready('baseline',10,0);
  await verifySelection(first.selection, 'baseline',10,0);
  verifyPose(first.camera, pilot.frames[0].image);
  assert.ok(await page(() => document.querySelector('.pilot-metrics').innerText.includes('First frame')));
  await control('Next frame');
  verifyPose((await ready('baseline',10,1)).camera, pilot.frames[1].image);
  await control('Previous frame');
  await ready('baseline',10,0);
  await setValue('#temporal-method','temporal_medium');
  await click('5%');
  await seek(8);
  const medium = await ready('temporal_medium',5,8);
  await verifySelection(medium.selection,'temporal_medium',5,8);
  verifyPose(medium.camera, pilot.frames[8].image);
  await setValue('#temporal-method','temporal_strong');
  await click('10%');
  await ready('temporal_strong',10,8);
  await screenshot('temporal-live');
  const liveCapture = await page(() => {
    const rect = selector => {
      const {x,y,width,height} = document.querySelector(selector).getBoundingClientRect();
      return {x,y,width,height};
    };
    return {viewport:rect('canvas'), tag:rect('.live-tag'), pixelRatio:devicePixelRatio};
  });
  await control('Enter fullscreen');
  await wait(() => !!document.fullscreenElement?.querySelector('.timeline'));
  await control('Exit fullscreen');
  await control('Reset to first frame');
  await ready('temporal_strong',10,0);
  await setValue('.speed', 4);
  await click('Play');
  await wait(() => document.querySelector('.live-tag')?.textContent.includes('Between samples'));
  await click('Pause');
  const pausePose = await page(() => window.__viewerCamera);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(await page(() => window.__viewerCamera), pausePose);
  await click('Play');
  await wait(() => Number(document.querySelector('.timeline input').value) >= 2);
  await control('Reset to first frame');
  await ready('temporal_strong',10,0);
  await page(() => {
    const log = window.__temporalRun = {frames:{}, movingFrames:0, active:true};
    function record() {
      const label = document.querySelector('.live-tag')?.textContent;
      const frame = Number(document.querySelector('.timeline input').value) - 1;
      if (label?.includes('Between')) log.movingFrames++;
      else if (label?.includes('Live 3D') && !log.frames[frame]) {
        log.frames[frame] = {camera:window.__viewerCamera, selection:window.__viewerSelectionDebug};
      }
      if (log.active) requestAnimationFrame(record);
    }
    record();
  });
  pollGpu();
  const startSample = gpuSamples.length - 1;
  const timer = setInterval(pollGpu, 900);
  const began = Date.now();
  try {
    await click('Play');
    await wait(() => document.querySelector('.play-button').textContent.trim() === 'Play' && document.querySelector('.timeline input').value === '20', undefined, 180000);
  } finally { clearInterval(timer); pollGpu(); }
  const seconds = (Date.now() - began) / 1000;
  const run = await page(() => { window.__temporalRun.active = false; return window.__temporalRun; });
  assert.equal(Object.keys(run.frames).length, 20, 'Every measured sample was presented');
  assert.ok(run.movingFrames >= 19, 'Playback rendered between measured cameras');
  for (const [i, snapshot] of Object.entries(run.frames)) {
    verifyPose(snapshot.camera, pilot.frames[Number(i)].image);
    await verifySelection(snapshot.selection,'temporal_strong',10, Number(i));
  }
  const playbackMemory = gpuSamples.slice(startSample).map(s => s.usedMiB).filter(Number.isFinite);
  const systemFree = gpuSamples.slice(startSample).map(s => s.systemFreeMiB).filter(Number.isFinite);
  await seek(18);
  await ready('temporal_strong',10,18);
  await click('Loop'); await click('Play');
  await wait(() => document.querySelector('.timeline input').value === '1');
  await click('Pause'); await click('Loop');
  await click('Compare three');
  await seek(8);
  const cardsReady = (frame,budget) => wait(([i,b]) => {
    const images = Array.from(document.querySelectorAll('.triptych img'));
    return images.length === 3 && images.every(img => img.complete && img.naturalWidth === 979 && img.src.endsWith('/' + b + '/' + i));
  },[frame,budget]);
  await cardsReady(8,10);
  assert.deepEqual(await page(() => [...document.querySelectorAll('.triptych figure')].map(f => f.querySelector('dd').textContent)),
    ['baseline','temporal_medium','temporal_strong'].map(m => pilot.frames[8].results[m][10].psnr.toFixed(2) + ' dB'));
  await screenshot('temporal-comparison');
  await page(() => document.querySelector('.triptych').focus());
  await send('Input.dispatchKeyEvent', {type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  assert.ok(await page(() => parseFloat(document.querySelector('.triptych').style.getPropertyValue('--detail-x')) > 50));
  await click('5%'); await cardsReady(8,5);
  await click('Play'); await cardsReady(9,5); await click('Pause');
  await click('Live 3D');
  await ready('temporal_strong',5,9);
  await click('Benchmarks');
  await wait(() => document.querySelector('.view-title')?.textContent.includes('Benchmark'));
  await click('Workspace');
  await wait(() => window.__viewerSelectionDebug?.technique === 'opacity' && document.querySelector('.count')?.textContent === '1,537,592');
  assert.deepEqual(await page(() => window.__viewerCamera), before);
  const retained = await page(() => ({sameCanvas:window.__testCanvas === document.querySelector('canvas'),
    sameModel:window.__testModel === window.__viewerDebug, canvasCount:document.querySelectorAll('canvas').length}));
  assert.deepEqual(retained,{sameCanvas:true, sameModel:true, canvasCount:1});
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  await click('Temporal Analysis');
  await ready('temporal_strong',5,9);
  assert.ok(await page(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('temporal-mobile');
  await send('Emulation.clearDeviceMetricsOverride');
  return {verifiedLiveFrames:20, calibratedQuarterTurns:4, liveCapture, betweenSampleAnimationFrames:run.movingFrames, fourTimesPlaybackSeconds:seconds,
    temporalGpuSampleCount:playbackMemory.length, temporalGpuMinMiB:Math.min(...playbackMemory),
    temporalGpuPeakMiB:Math.max(...playbackMemory), minimumSystemFreeMiB:Math.min(...systemFree),
    systemTotalMiB:gpuSamples[startSample].systemTotalMiB,
    controls:'pause, resume, step, scrub, speed, reset, loop, fullscreen, mobile', ...retained};
}

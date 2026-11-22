import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { EventDispatcher, PerspectiveCamera, Vector3 } from 'three';
import { createCameraRig } from '../src/cameraRig.ts';
import { temporalArchive } from '../server/temporal.ts';
import { fileURLToPath } from 'node:url';

const experiments = new URL('../../experiments/', import.meta.url);
const records = JSON.parse(await readFile(new URL('baseline_truck/cameras.json', experiments), 'utf8'));
const pilot = await temporalArchive(fileURLToPath(experiments)).manifest();
const byName = new Map(records.map(r => [r.img_name, r]));
globalThis.cancelAnimationFrame ??= () => {};

function setup() {
  const camera = new PerspectiveCamera(48, records[0].width / records[0].height);
  const controls = Object.assign(new EventDispatcher(), {target: new Vector3(), saveState() {}});
  return {camera, rig:createCameraRig(camera, controls, records)};
}

test('The recorded path reaches all 219 original training transforms and calibrated focal lengths', () => {
  const {camera, rig} = setup();
  const visited = new Set();
  for (let i = 0; i < pilot.frames.length - 1; i++) {
    const lo = pilot.frames[i].loaderIndex, hi = pilot.frames[i+1].loaderIndex;
    for (let j = lo; j <= hi; j++) {
      rig.sample(pilot, i, (j - lo) / (hi - lo));
      const record = byName.get(pilot.trainingSequence[j]);
      assert.ok(camera.position.distanceTo(new Vector3(...record.position)) < 1e-8);
      for (const [axis, sign] of [[0,1], [1,-1], [2,-1]]) {
        const world = new Vector3().setComponent(axis, sign).applyQuaternion(camera.quaternion);
        assert.ok(world.distanceTo(new Vector3(...record.rotation.map(r => r[axis]))) < 1e-8);
      }
      assert.ok(Math.abs(camera.projectionMatrix.elements[0] - 2 * record.fx / record.width) < 1e-8);
      assert.ok(Math.abs(camera.projectionMatrix.elements[5] - 2 * record.fy / record.height) < 1e-8);
      visited.add(j);
      if (j === hi) continue;
      rig.sample(pilot, i, (j - lo + 0.5) / (hi - lo));
      const next = byName.get(pilot.trainingSequence[j+1]);
      const midpoint = new Vector3(...record.position).lerp(new Vector3(...next.position), 0.5);
      assert.ok(camera.position.distanceTo(midpoint) < 1e-8);
    }
  }
  assert.equal(visited.size, 219);
  rig.dispose();
});

test('A full capture orbit closes at the exact anchor and optical zoom stays on the captured path', t => {
  const {camera, rig} = setup();
  const anchor = camera.position.clone(), rotation = camera.quaternion.clone();
  const source = records.map(r => new Vector3(...r.position));
  let worstDistance = 0;
  for (let degree = 0; degree < 360; degree++) {
    rig.turn(Math.PI / 180);
    worstDistance = Math.max(worstDistance, Math.min(...source.map(origin => camera.position.distanceTo(origin))));
  }
  assert.ok(camera.position.distanceTo(anchor) < 1e-8);
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-6);
  assert.ok(worstDistance < 0.15 * rig.distance);
  const position = camera.position.clone();
  rig.zoom(0.8);
  assert.equal(camera.zoom,1.25);
  assert.ok(camera.position.equals(position));
  rig.sample(pilot,7,0.42);
  rig.leavePilot();
  assert.equal(camera.zoom,1.25);
  assert.ok(camera.position.equals(position));
  t.diagnostic('Maximum distance to a recorded camera during the 360-degree orbit: ' + worstDistance.toFixed(4) + ' scene units; median capture radius ' + rig.distance.toFixed(4));
  rig.dispose();
});

import type { TemporalPilot } from './temporalData';
import { MathUtils, Matrix3, PerspectiveCamera, Matrix4, Quaternion, Spherical, Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';

export type CameraRecord = {
  id: number;
  img_name: string;
  width: number;
  height: number;
  fx: number;
  fy: number;
  position: [number, number, number];
  rotation: [[number, number, number], [number, number, number], [number, number, number]];
};

// Frames index the held-out Graphdeco render set. Resolve poses by image name
// because cameras.json lists test images first, followed by training images.
export const CAMERA_PRESETS = [
  { id: 'overview', label: 'Front three-quarter', frame: 7, image: '000057.jpg' },
  { id: 'profile', label: 'Side profile', frame: 31, image: '000249.jpg' },
  { id: 'rear', label: 'Rear view', frame: 15, image: '000121.jpg' },
] as const;

export type CameraPreset = typeof CAMERA_PRESETS[number]['id'];
export type CameraMode = 'capture' | 'free';
export type CameraRig = {
  setMode: (mode: CameraMode) => void;
  turn: (radians: number) => void;
  zoom: (scale: number) => void;
  sample: (pilot: TemporalPilot, frame: number, fraction: number) => void;
  leavePilot: () => void;
  focus: Vector3;
  distance: number;
  imageName: (preset: CameraPreset) => string;
  go: (preset: CameraPreset) => void;
  stop: () => void;
  resize: () => void;
  dispose: () => void;
};

function axis(record: CameraRecord, column: number) {
  return new Vector3(...record.rotation.map(row => row[column])).normalize();
}

function median(values: number[]) {
  const ordered = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return (ordered[mid] + ordered[Math.floor((ordered.length - 1) / 2)]) / 2;
}

// Fit the common point nearest the capture rays. Reweight large perpendicular
// residuals so close-up/detail shots have limited leverage on the orbit depth.
function captureGeometry(records: CameraRecord[]) {
  const rays = records.map(record => {
    const normal = axis(record, 2);
    const origin = new Vector3(...record.position);
    return { normal, origin, weight: 1 };
  });
  const focus = new Vector3();
  const residual = new Vector3();
  for (let iteration = 0; iteration < 8; iteration++) {
    const system = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const rhs = new Vector3();
    for (const { normal, origin, weight } of rays) {
      // Orthogonal projector I - nnᵀ.
      const { x, y, z } = normal;
      const p = new Matrix3().set(
        1 - x*x, -x*y, -x*z,
        -y*x, 1 - y*y, -y*z,
        -z*x, -z*y, 1 - z*z,
      );
      p.multiplyScalar(weight);
      for (let i = 0; i < 9; i++) system.elements[i] += p.elements[i];
      rhs.add(residual.copy(origin).applyMatrix3(p));
    }
    if (Math.abs(system.determinant()) < 1e-10) throw new Error('Camera trajectories cannot resolve a Truck orbit target.');
    focus.copy(rhs).applyMatrix3(system.invert());
    const errors = rays.map(({ normal, origin }) => residual.subVectors(focus, origin).cross(normal).length());
    const cutoff = Math.max(median(errors), 1e-6);
    rays.forEach((ray, i) => { ray.weight = Math.min(1, cutoff / Math.max(errors[i], 1e-6)); });
  }
  const distance = median(rays.map(({ origin }) => origin.distanceTo(focus)));
  const up = new Vector3();
  for (const record of records) up.sub(axis(record, 1));
  return { focus, distance, up: up.normalize() };
}

type Pose = {
  record: CameraRecord;
  position: Vector3;
  orientation: Quaternion;
};

function readPose(record: CameraRecord): Pose {
  // OpenCV camera-to-world columns are right, down and forward.
  const rotation = new Matrix4().makeBasis(axis(record, 0), axis(record, 1).negate(), axis(record, 2).negate());
  return { record, position: new Vector3(...record.position), orientation: new Quaternion().setFromRotationMatrix(rotation) };
}

export function createCameraRig(camera: PerspectiveCamera, controls: OrbitControls, records: CameraRecord[]): CameraRig {
  const { focus, distance, up } = captureGeometry(records);
  const poses = records.map(readPose);
  const byName = new Map(poses.map(p => [p.record.img_name, p]));
  function named(name: string) {
    const pose = byName.get(name);
    if (!pose) throw new Error('Missing calibrated Truck camera ' + name);
    return pose;
  }
  const presetPose = (id: CameraPreset) => named(CAMERA_PRESETS.find(p => p.id === id)!.image);
  let lens = presetPose('overview').record;
  let mode: CameraMode = 'capture';
  let angle = 0;
  let animation = 0;
  const stop = () => { cancelAnimationFrame(animation); animation = 0; };
  const resize = () => {
    const fit = Math.max(1, lens.width / (lens.height * camera.aspect));
    camera.fov = MathUtils.radToDeg(2 * Math.atan(fit * lens.height / (2 * lens.fy)));
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[0] *= lens.fx / lens.fy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  };
  controls.minDistance = distance * 0.08;
  controls.maxDistance = distance * 5;
  controls.minPolarAngle = 0.025;
  controls.maxPolarAngle = Math.PI - 0.025;
  camera.near = distance / 2000;
  camera.far = distance * 64;
  const forward = new Vector3();
  const right = new Vector3();
  const offset = new Vector3();
  const sync = () => {
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.up.copy(up).projectOnPlane(right).normalize();
    const depth = Math.max(controls.minDistance, offset.subVectors(focus, camera.position).dot(forward));
    controls.target.copy(camera.position).addScaledVector(forward, depth);
    camera.updateMatrixWorld();
    controls.dispatchEvent({ type: 'change', target: controls });
  };
  const place = (a: Pose, b: Pose = a, t = 0) => {
    camera.position.lerpVectors(a.position, b.position, t);
    camera.quaternion.slerpQuaternions(a.orientation, b.orientation, t);
    // All Truck cameras use the same calibrated intrinsics.
    if (lens !== a.record) { lens = a.record; resize(); }
    sync();
  };

  // Pick a calibrated view in each occupied bearing sector at a similar subject
  // distance to the anchor. This handles the multiple overlapping Truck capture laps.
  const tau = 2 * Math.PI;
  function captureRing(anchor: Pose) {
    const x = anchor.position.clone().sub(focus).projectOnPlane(up).normalize();
    const z = new Vector3().crossVectors(up, x);
    const anchorRadius = anchor.position.distanceTo(focus);
    const sectors = 36;
    const best = new Map<number, { angle: number; pose: Pose; cost: number }>();
    for (const pose of poses) {
      const delta = pose.position.clone().sub(focus);
      const yaw = MathUtils.euclideanModulo(Math.atan2(delta.dot(z), delta.dot(x)), tau);
      const sector = Math.round(yaw / tau * sectors) % sectors;
      if (!sector) continue;
      const centerError = Math.abs(yaw - sector * tau / sectors);
      const radiusError = Math.abs(delta.length() - anchorRadius) / anchorRadius;
      const cost = centerError + radiusError;
      if (cost < (best.get(sector)?.cost ?? Infinity)) best.set(sector, { angle: yaw, pose, cost });
    }
    return [{ angle: 0, pose: anchor }, ...Array.from(best.values()).sort((a,b) => a.angle - b.angle), { angle: tau, pose: anchor }];
  }
  let ring = captureRing(presetPose('overview'));
  const turn = (delta: number) => {
    stop();
    angle = MathUtils.euclideanModulo(angle + delta, tau);
    const end = ring.findIndex(p => p.angle > angle);
    const a = ring[end - 1], b = ring[end];
    place(a.pose, b.pose, (angle - a.angle) / (b.angle - a.angle));
  };
  function setMode(next: CameraMode) {
    if (next === mode) return;
    stop();
    mode = next;
    if (next === 'capture') {
      const nearest = poses.reduce((best, pose) => pose.position.distanceToSquared(camera.position) < best.position.distanceToSquared(camera.position) ? pose : best);
      ring = captureRing(nearest);
      angle = 0; camera.zoom = 1;
      place(nearest); resize();
    } else {
      // Translate optical zoom to an equivalent orbit distance on the subject plane.
      const d = MathUtils.clamp(controls.getDistance() / camera.zoom, controls.minDistance, controls.maxDistance);
      camera.position.sub(controls.target).setLength(d).add(controls.target);
      camera.zoom = 1; resize(); controls.update();
    }
  }
  function zoom(scale: number) {
    stop();
    if (mode === 'capture') {
      camera.zoom = MathUtils.clamp(camera.zoom / scale, 0.65, 2.5);
      resize(); controls.dispatchEvent({type:'change', target:controls});
    } else {
      const next = MathUtils.clamp(controls.getDistance() * scale, controls.minDistance, controls.maxDistance);
      camera.position.sub(controls.target).setLength(next).add(controls.target);
      controls.update();
    }
  }

  // Sampling the measured training trajectory and restoring the workspace are
  // independent of selecting Gaussians. Scrubbing does not run a selector.
  function snapshot() {
    return { position:camera.position.clone(), rotation:camera.quaternion.clone(), up:camera.up.clone(),
      target:controls.target.clone(), zoom:camera.zoom, lens };
  }
  let saved: ReturnType<typeof snapshot> | undefined;
  function sample(pilot: TemporalPilot, frame: number, fraction: number) {
    if (!saved) { stop(); saved = snapshot(); camera.zoom = 1; resize(); }
    const from = pilot.frames[frame].loaderIndex;
    const to = pilot.frames[Math.min(frame + 1, pilot.frames.length - 1)].loaderIndex;
    const index = MathUtils.lerp(from, to, MathUtils.clamp(fraction, 0, 1));
    const lo = Math.floor(index), hi = Math.ceil(index);
    place(named(pilot.trainingSequence[lo]), named(pilot.trainingSequence[hi]), index - lo);
  }
  function leavePilot() {
    if (!saved) return;
    camera.position.copy(saved.position); camera.quaternion.copy(saved.rotation); camera.up.copy(saved.up);
    controls.target.copy(saved.target); camera.zoom = saved.zoom; lens = saved.lens;
    saved = undefined; resize(); camera.updateMatrixWorld(); controls.dispatchEvent({type:'change', target:controls});
  }
  const go = (id: CameraPreset) => {
    stop();
    const destination = presetPose(id);
    const original = snapshot();
    // Flush residual damping before installing a new calibrated pose.
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
    const align = new Quaternion().setFromUnitVectors(up, new Vector3(0,1,0));
    const invert = align.clone().invert();
    const start = new Spherical().setFromVector3(original.position.clone().sub(focus).applyQuaternion(align));
    const end = new Spherical().setFromVector3(destination.position.clone().sub(focus).applyQuaternion(align));
    const arc = MathUtils.euclideanModulo(end.theta - start.theta + Math.PI, tau) - Math.PI;
    const sphere = new Spherical();
    const began = performance.now();
    const finish = () => { angle = 0; ring = captureRing(destination); camera.zoom = 1; place(destination); resize(); animation = 0; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    const tick = (now: number) => {
      const f = Math.min(1, (now - began) / 550);
      if (f >= 1) { finish(); return; }
      const t = f * f * (3 - 2 * f);
      sphere.set(MathUtils.lerp(start.radius, end.radius, t), MathUtils.lerp(start.phi, end.phi, t), start.theta + arc * t);
      camera.position.setFromSpherical(sphere).applyQuaternion(invert).add(focus);
      camera.quaternion.slerpQuaternions(original.rotation, destination.orientation, t);
      camera.zoom = MathUtils.lerp(original.zoom, 1, t); resize(); sync();
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  };
  resize(); place(presetPose('overview')); controls.saveState();
  controls.addEventListener('start', stop);
  return {
    focus, distance, go, stop, resize, turn, zoom, setMode, sample, leavePilot,
    imageName: id => presetPose(id).record.img_name,
    dispose() { stop(); controls.removeEventListener('start', stop); },
  };
}

import { Component, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE, TOUCH, PerspectiveCamera } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { createCameraRig, type CameraMode, type CameraPreset, type CameraRecord } from './cameraRig';
import { bindCaptureInput } from './captureInput';
import type { TemporalPilot } from './temporalData';
import { TruckScene, type DisplaySelection, type SelectionStatus, type Technique } from './TruckScene';

export type CameraActions = {
  go: (id: CameraPreset) => void; zoom: (factor: number) => void;
  sample: (pilot: TemporalPilot, frame: number, fraction: number) => void; leavePilot: () => void;
};
export type Diagnostics = { adapter?: string; motionFps?: number };
type Props = {
  technique: Technique; budget: number; hybridReference: string; enabled: boolean; pan: boolean;
  cameraMode: CameraMode; temporal: boolean; temporalUrl?: string; temporalBudget?: number; onFreePan: () => void;
  actions: RefObject<CameraActions | null>;
  onProgress: (bytes: number, total?: number) => void;
  onReady: (stats: { gaussianCount: number; shDegree: number }) => void;
  onError: (error: Error) => void;
  onSelection: (status: SelectionStatus, count: number, detail?: string, displayed?: DisplaySelection) => void;
  onCameraReady: () => void; onCameraMove: () => void;
  onDiagnostics: (data: Diagnostics) => void;
};

class RendererBoundary extends Component<{children: ReactNode; onError: Props['onError']}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Scene(props: Props) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<Controls>(null);
  const rigRef = useRef<ReturnType<typeof createCameraRig> | null>(null);
  const motion = useRef({ dirty: false, frames: 0, first: 0, last: 0 });
  const { actions, onError, onCameraReady, onCameraMove, onDiagnostics } = props;
  const mode = useRef(props.cameraMode);
  mode.current = props.cameraMode;
  useFrame(() => {
    const sample = motion.current;
    if (!sample.dirty) return;
    sample.dirty = false;
    sample.last = performance.now();
    if (!sample.frames) sample.first = sample.last;
    sample.frames++;
  });
  useEffect(() => {
    const abort = new AbortController();
    const control = controls.current!;
    const context = gl.getContext();
    const info = context.getExtension('WEBGL_debug_renderer_info');
    const adapter: string = context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER);
    onDiagnostics({ adapter });
    Object.defineProperty(window, '__viewerCamera', {
      configurable: true,
      get: () => ({position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        target: control.target.toArray(), zoom: (camera as PerspectiveCamera).zoom}),
    });
    let endMotion: ReturnType<typeof setTimeout>;
    const record = () => {
      motion.current.dirty = true;
      clearTimeout(endMotion);
      endMotion = setTimeout(() => {
        const { frames, first, last } = motion.current;
        if (frames >= 3 && last > first) onDiagnostics({motionFps: (frames - 1) * 1000 / (last - first)});
        motion.current.frames = 0;
      }, 450);
      invalidate();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      onError(new Error('The browser lost its WebGL context. Retry to reopen the model.'));
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    control.addEventListener('change', record);
    control.addEventListener('start', onCameraMove);
    fetch('/model/cameras.json', { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('Camera calibration could not be loaded.');
      const cameras: CameraRecord[] = await response.json();
      if (abort.signal.aborted) return;
      const rig = createCameraRig(camera as PerspectiveCamera, control, cameras);
      rigRef.current = rig;
      rig.setMode(mode.current);
      actions.current = {
        go: id => { rig.go(id); invalidate(); },
        zoom: scale => { rig.zoom(scale); onCameraMove(); invalidate(); },
        sample: (pilot, frame, t) => { rig.sample(pilot, frame, t); invalidate(); },
        leavePilot: () => { rig.leavePilot(); invalidate(); },
      };
      record();
      Object.assign(window, { __viewerInitialCamera: {position: camera.position.toArray(), target: control.target.toArray()} });
      onCameraReady();
    }).catch((error: Error) => { if (!abort.signal.aborted) onError(error); });
    return () => {
      clearTimeout(endMotion);
      Reflect.deleteProperty(window, '__viewerCamera');
      abort.abort(); rigRef.current?.dispose(); rigRef.current = null; actions.current = null;
      gl.domElement.removeEventListener('webglcontextlost', lost);
      control.removeEventListener('change', record);
      control.removeEventListener('start', onCameraMove);
    };
  }, [actions, camera, gl, invalidate, onCameraMove, onCameraReady, onDiagnostics, onError]);
  useEffect(() => { rigRef.current?.resize(); invalidate(); }, [size.width, size.height, invalidate]);
  useEffect(() => {
    if (props.temporal) return;
    rigRef.current?.setMode(props.cameraMode);
    invalidate();
  }, [props.cameraMode, props.temporal, invalidate]);
  useEffect(() => {
    if (!props.enabled || props.temporal || props.cameraMode !== 'capture') return;
    return bindCaptureInput(gl.domElement,
      delta => { rigRef.current?.turn(delta); onCameraMove(); },
      scale => { rigRef.current?.zoom(scale); onCameraMove(); },
      () => {
        rigRef.current?.setMode('free');
        if (controls.current) controls.current.enabled = true;
        props.onFreePan();
      });
  }, [gl, props.enabled, props.temporal, props.cameraMode, props.onFreePan, onCameraMove]);
  return <>
    <OrbitControls ref={controls} makeDefault enabled={props.enabled && !props.temporal && props.cameraMode === 'free'} enableDamping dampingFactor={0.14}
      rotateSpeed={0.65} panSpeed={0.85} zoomSpeed={0.9}
      mouseButtons={{LEFT: props.pan ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN}}
      touches={{ONE: props.pan ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN}} />
    <TruckScene {...props} />
  </>;
}

export default function LiveViewport(props: Props) {
  return <RendererBoundary onError={props.onError}>
    <Canvas camera={{fov: 48, near: 0.01, far: 250}} dpr={[1, 1.5]} flat frameloop={props.enabled ? 'demand' : 'never'}
      gl={{antialias: false, alpha: false, powerPreference: 'high-performance'}}
      onCreated={({gl}) => gl.setClearColor(0x000000, 1)}>
      <Scene {...props} />
    </Canvas>
  </RendererBoundary>;
}

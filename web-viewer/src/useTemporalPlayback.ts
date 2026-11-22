import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraActions } from './LiveViewport';
import { temporalAsset, type TemporalBudget, type TemporalMethod, type TemporalPilot } from './temporalData';

export function useTemporalPlayback(active: boolean, actions: RefObject<CameraActions | null>,
  cameraReady: boolean, displayedUrl: string | undefined, selectionError: boolean) {
  const [pilot, setPilot] = useState<TemporalPilot | null>(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<TemporalMethod>('baseline');
  const [budget, setBudget] = useState<TemporalBudget>(10);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [compare, setCompare] = useState(false);
  const [decoded, setDecoded] = useState('');
  const progress = useRef(0);
  const [inTransit, setInTransit] = useState(false);
  const url = temporalAsset('ids', method, budget, frame);
  const imageKey = budget + '/' + frame;
  const showing = compare && decoded ? decoded.split('/').map(Number) : [budget, frame];
  const presentedBudget = showing[0] as TemporalBudget;
  const presentedFrame = showing[1];
  const last = (pilot?.frames.length ?? 1) - 1;
  const prepared = !!pilot && (compare ? decoded === imageKey : cameraReady && displayedUrl === url);
  useEffect(() => {
    if (!active || pilot) return;
    const abort = new AbortController();
    setError('');
    fetch('/api/temporal', {signal:abort.signal}).then(async response => {
      if (!response.ok) throw new Error(await response.text());
      const data: TemporalPilot = await response.json();
      if (!abort.signal.aborted) setPilot(data);
    }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [active, pilot]);
  const rewindInterval = useCallback(() => {
    progress.current = 0;
    setInTransit(false);
  }, []);
  useEffect(() => {
    if (!active) { setPlaying(false); rewindInterval(); actions.current?.leavePilot(); }
  }, [active, actions, rewindInterval]);
  useEffect(() => {
    rewindInterval();
    if (active && pilot && cameraReady && !compare) actions.current?.sample(pilot, frame, 0);
  }, [active, actions, cameraReady, pilot, compare, frame, method, budget, rewindInterval]);
  useEffect(() => {
    if (active && !compare && selectionError) setPlaying(false);
  }, [active, compare, selectionError]);
  useEffect(() => {
    if (!active || !playing || !prepared || !pilot) return;
    let animation = 0;
    let previous: number | undefined;
    function tick(now: number) {
      // A hidden tab or a delayed read never skips an experimental sample.
      const delta = previous === undefined ? 0 : Math.min(100, now - previous);
      previous = now;
      progress.current = Math.min(1, progress.current + delta * speed / 1800);
      if (progress.current >= 1) {
        if (frame < last || loop) {
          rewindInterval();
          setFrame(frame === last ? 0 : frame + 1);
        } else { setPlaying(false); rewindInterval(); }
        return;
      }
      if (!compare && frame < last && progress.current > 0.25) {
        const t = (progress.current - 0.25) / 0.75;
        actions.current?.sample(pilot!, frame, t * t * (3 - 2 * t));
        setInTransit(true);
      }
      animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [active, playing, prepared, pilot, actions, frame, last, loop, speed, compare, rewindInterval]);
  const seek = (next: number) => {
    setPlaying(false);
    rewindInterval();
    setFrame(next);
    if (pilot && !compare && cameraReady) actions.current?.sample(pilot, next, 0);
  };
  const togglePlay = () => {
    if (!playing && frame === last) seek(0);
    setPlaying(!playing);
  };
  return { pilot, error, method, budget, frame, last, playing, loop, speed, compare, url, prepared, inTransit,
    imageKey, decoded, presentedBudget, presentedFrame, setDecoded, setMethod, setBudget, setLoop, setSpeed, setCompare, seek, togglePlay };
}

export type Playback = ReturnType<typeof useTemporalPlayback>;

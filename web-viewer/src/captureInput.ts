/** One horizontal sweep spans the whole calibrated orbit. Optical zoom keeps the
 * camera on the measured path. The free-mode control owns pan and vertical orbit. */
export function bindCaptureInput(canvas: HTMLCanvasElement, turn: (angle: number) => void,
  zoom: (factor: number) => void, freePan: () => void) {
  const points = new Map<number, {x: number; y: number}>();
  const span = () => {
    const [a,b] = points.values();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const down = (e: PointerEvent) => {
    if (e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey))) { freePan(); return; }
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    points.set(e.pointerId, {x:e.clientX, y:e.clientY});
  };
  const move = (e: PointerEvent) => {
    const previous = points.get(e.pointerId);
    if (!previous) return;
    const lastSpan = span();
    points.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (points.size === 2) {
      const nextSpan = span();
      if (lastSpan > 1 && nextSpan > 1) zoom(lastSpan / nextSpan);
    } else if (points.size === 1 && e.clientX !== previous.x) {
      turn(-(e.clientX - previous.x) * 2 * Math.PI / Math.max(1, canvas.clientWidth));
    }
  };
  const release = (e: PointerEvent) => { points.delete(e.pointerId); };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1);
    zoom(Math.exp(Math.max(-400, Math.min(400, pixels)) * 0.001));
  };
  // Run before OrbitControls so a right-button press can enter free pan immediately.
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', wheel, {passive:false});
  return () => {
    canvas.removeEventListener('pointerdown', down, true);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('lostpointercapture', release);
    canvas.removeEventListener('pointerup', release);
    canvas.removeEventListener('pointercancel', release);
    canvas.removeEventListener('wheel', wheel);
    for (const id of points.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    points.clear();
  };
}

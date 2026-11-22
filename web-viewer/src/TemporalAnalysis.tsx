import { useEffect, useRef, useState } from 'react';
import type { Playback } from './useTemporalPlayback';
import { temporalAsset, temporalMethods, temporalNames, type TemporalBudget } from './temporalData';
import { Icon } from './Icon';

export function TemporalTimeline({p}: {p: Playback}) {
  const frame = p.pilot?.frames[p.frame];
  return <section className="camera-section timeline" aria-label="Camera trajectory playback">
    <div className="section-heading"><h2><Icon name="path"/>Camera trajectory</h2>
      <span>Frame {p.frame + 1} / {p.pilot?.frames.length ?? '—'}</span></div>
    <label className="timeline-track">
      <span className="sr-only">Timeline frame</span>
      <input type="range" min={1} max={p.last + 1} step={1} value={p.frame + 1} disabled={!frame}
        aria-valuetext={`Frame ${p.frame + 1}, ${frame?.image ?? ''}`} onChange={e => p.seek(Number(e.target.value) - 1)}/>
    </label>
    <div className="transport">
      <button className="play-button" disabled={!frame} onClick={p.togglePlay}>
        <Icon name={p.playing ? 'pause' : 'play'} size={15}/>{p.playing ? 'Pause' : 'Play'}
      </button>
      <button className="tool" title="Reset to first frame" aria-label="Reset to first frame" onClick={() => p.seek(0)}><Icon name="reset" size={16}/></button>
      <button className="tool" title="Previous frame" aria-label="Previous frame" disabled={!p.frame} onClick={() => p.seek(p.frame - 1)}><Icon name="prev" size={15}/></button>
      <button className="tool" title="Next frame" aria-label="Next frame" disabled={p.frame >= p.last} onClick={() => p.seek(p.frame + 1)}><Icon name="next" size={15}/></button>
      <span className="frame-name">{frame?.image}</span>
      <select className="speed" aria-label="Playback speed" value={p.speed} onChange={e => p.setSpeed(Number(e.target.value))}>
        {[0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}×</option>)}
      </select>
      <button className={'loop-button' + (p.loop ? ' on' : '')} aria-pressed={p.loop} onClick={() => p.setLoop(!p.loop)}>
        <Icon name="loop" size={15}/>Loop
      </button>
    </div>
  </section>;
}

export function TemporalComparison({p}: {p: Playback}) {
  const {budget, frame: index, imageKey, setDecoded, playing, last, loop, presentedFrame, presentedBudget} = p;
  const frame = p.pilot?.frames[presentedFrame];
  const groups = useRef(new Map<string, Promise<HTMLImageElement[]>>());
  const grid = useRef<HTMLDivElement>(null);
  const detail = useRef({x:50, y:50});
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => () => setDecoded(''), [setDecoded]);
  useEffect(() => {
    let active = true;
    setError('');
    const cache = groups.current;
    function load(b: TemporalBudget, i: number) {
      const key = b + '/' + i;
      const existing = cache.get(key);
      if (existing) return existing;
      const group = Promise.all(temporalMethods.map(async method => {
        const image = new Image();
        image.src = temporalAsset('render', method, b, i);
        await image.decode();
        return image;
      }));
      cache.set(key, group);
      group.catch(() => { if (cache.get(key) === group) cache.delete(key); });
      return group;
    }
    const next = index < last ? index + 1 : loop ? 0 : null;
    const nextKey = playing && next !== null ? budget + '/' + next : null;
    for (const key of cache.keys()) if (key !== imageKey && key !== nextKey) cache.delete(key);
    load(budget, index).then(() => {
      if (!active) return;
      setDecoded(imageKey);
      if (playing && next !== null) load(budget, next).catch(() => {});
    }).catch(() => { if (active) setError('The synchronized render group could not be loaded.'); });
    return () => { active = false; };
  }, [index, budget, imageKey, setDecoded, attempt, playing, last, loop]);
  if (!frame || !p.decoded || error) return <div className="frame-wait" role="status">{error || p.error || 'Loading three matched renders…'}
    {error && <button className="loop-button" onClick={() => retry(n => n + 1)}>Retry comparison</button>}</div>;
  const moveDetail = (x: number, y: number) => {
    const crop = grid.current?.querySelector<HTMLElement>('.detail-crop');
    if (!crop) return;
    const bounded = (v: number) => Math.max(0, Math.min(100, v));
    detail.current = {x:bounded(x), y:bounded(y)};
    const position = (point: number, source: number, size: number) =>
      bounded((point * source - 50 * size) / Math.max(1, source - size)) + '%';
    grid.current?.style.setProperty('--detail-x', position(detail.current.x,979,crop.clientWidth));
    grid.current?.style.setProperty('--detail-y', position(detail.current.y,546,crop.clientHeight));
  };
  return <div className="temporal-comparison">
    <div className="comparison-heading"><div><div className="section-label">Saved Graphdeco renders</div><h2>Selection consistency</h2></div>
      <span>{frame.image} · {presentedBudget}%</span></div>
    <div className="triptych" role="group" tabIndex={0} ref={grid}
      aria-label="Three synchronized renders. Use the arrow keys to move the native-resolution detail crops."
      onKeyDown={e => {
        if (e.target !== grid.current || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const {x,y} = detail.current;
        moveDetail(x + (e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0),
          y + (e.key === 'ArrowDown' ? 5 : e.key === 'ArrowUp' ? -5 : 0));
      }}>{temporalMethods.map(method => {
      const row = frame.results[method][presentedBudget];
      const src = temporalAsset('render', method, presentedBudget, presentedFrame);
      return <figure className={p.method === method ? 'inspected' : ''} key={method}>
        <figcaption><button type="button" aria-pressed={p.method === method} onClick={() => p.setMethod(method)}>
          {temporalNames[method]}{p.method === method && <Icon name="check" size={14}/>}</button></figcaption>
        <img src={src} alt={`${temporalNames[method]} at ${presentedBudget}%, ${frame.image}`}
          onPointerMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            moveDetail(100 * (e.clientX - rect.left) / rect.width, 100 * (e.clientY - rect.top) / rect.height);
          }}/>
        <div className="detail-crop" role="img" aria-label={`Native-resolution detail from ${temporalNames[method]}`}
          style={{backgroundImage:`url(${src})`}}><span>1:1 detail</span></div>
        <dl><div><dt>PSNR</dt><dd>{row.psnr.toFixed(2)} dB</dd></div>
          <div><dt>SSIM</dt><dd>{row.ssim.toFixed(4)}</dd></div>
          <div><dt>Prior overlap</dt><dd>{row.overlap === null ? '—' : row.overlap.toFixed(2) + '%'}</dd></div>
        </dl>
      </figure>;
    })}</div>
  </div>;
}

export function TemporalMetrics({p}: {p: Playback}) {
  const frame = p.pilot?.frames[p.presentedFrame];
  if (!frame) return null;
  const m = frame.results[p.method][p.presentedBudget];
  const format = (n: number) => n.toLocaleString('en-US');
  return <section className="pilot-metrics">
    <div className="metric-caption"><h3>Measured frame {p.presentedFrame + 1}</h3><span>{frame.image}</span></div>
    <div className="metric-pair">
      <div><span>PSNR</span><strong>{m.psnr.toFixed(2)} <small>dB</small></strong></div>
      <div><span>SSIM</span><strong>{m.ssim.toFixed(4)}</strong></div>
    </div>
    <dl className="numeric-rows">
      <div><dt>Overlap with previous</dt><dd>{m.overlap === null ? 'First frame' : m.overlap.toFixed(2) + '%'}</dd></div>
      <div><dt>New Gaussian IDs</dt><dd>{m.shared === null ? '—' : format(m.count - m.shared)}</dd></div>
      <div><dt>Pilot render-call FPS</dt><dd>{m.renderFps.toFixed(1)}</dd></div>
    </dl>
    <div className="overlap-trace" role="img" aria-label="Previous-frame overlap across the 20 samples">
      {p.pilot!.frames.map((f,i) => <i key={f.image} className={i === p.presentedFrame ? 'current' : ''}>
        <b style={{height:(f.results[p.method][p.presentedBudget].overlap ?? 0) + '%'}}/>
      </i>)}
    </div>
    <span className="trace-caption">Selection overlap along the path</span>
  </section>;
}

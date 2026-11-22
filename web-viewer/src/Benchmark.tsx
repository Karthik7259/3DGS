import { useState, useEffect, useRef } from 'react';
import type { Technique } from './TruckScene';
import { Icon } from './Icon';
import type { BenchmarkMethod, BenchmarkPoint } from './benchmarkData';

type Result = {
  method: string; budget: number; gaussianCount: number; testViews: number; viewIndex: number;
  original: {url: string; psnr: number; ssim: number};
  selected: {url: string; psnr: number; ssim: number; deltaPsnr: number; deltaSsim: number};
};

export function Benchmark({ technique, name, budget, references, frame, setFrame, onMeasured }: {
  technique: Technique; name: string; budget: number; references: string[]; frame: number; setFrame: (frame: number) => void;
  onMeasured: (result: Result) => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setError(''); setResult(null);
    fetch(`/api/benchmark-comparison?method=${technique}&budget=${budget}&frame=${frame}`, {signal: abort.signal})
      .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        const record: Result = await response.json();
        if (!abort.signal.aborted) { setResult(record); onMeasured(record); }
      }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [technique, budget, frame, onMeasured]);
  const current = result?.method === technique && result.budget === budget && result.viewIndex === frame ? result : null;
  return <section className="benchmark">
    <div className="benchmark-head"><div><div className="section-label">Graphdeco renders</div><h2>Same-camera comparison</h2></div>
      <label>Test camera<select value={frame} disabled={!references.length} onChange={e => setFrame(Number(e.target.value))}>
        {references.map((r,i) => <option key={r} value={i}>{r}</option>)}
      </select></label></div>
    {current ? <>
      <div className="comparison-pair">{[
        {name:'Baseline · Original model', image:current.original, retention:100},
        {name, image:current.selected, retention:budget},
      ].map(({name, image, retention}, i) => <figure key={i}>
        <img src={image.url} alt={`${name}, camera ${references[frame] ?? frame}`} />
        <figcaption><span><i className={'series-key ' + (i === 0 ? 'baseline' : technique)}/>{name}</span><b>{retention}%</b></figcaption>
      </figure>)}</div>
      <div className="benchmark-results"><div className="section-label">Means across {current.testViews} test cameras</div>
        <table><thead><tr><th>Metric</th><th>Original</th><th>Selected</th><th>Difference</th></tr></thead><tbody>
          {(['psnr','ssim'] as const).map(key => {
            const digits = key === 'psnr' ? 2 : 4;
            const delta = key === 'psnr' ? current.selected.deltaPsnr : current.selected.deltaSsim;
            return <tr key={key}><th>{key === 'psnr' ? 'PSNR (dB)' : 'SSIM'}</th><td>{current.original[key].toFixed(digits)}</td><td>{current.selected[key].toFixed(digits)}</td><td>{delta >= 0 ? '+' : ''}{delta.toFixed(digits)}</td></tr>;
          })}</tbody></table></div>
    </> : <p role="status" className="comparison-message"><Icon name="info" />{error || 'Loading saved comparison…'}</p>}
  </section>;
}

const seriesNames = {opacity: 'Opacity', sensitivity: 'Global sensitivity', hybrid: 'Hybrid'};
const methods = Object.keys(seriesNames) as BenchmarkMethod[];
const metrics = {psnr: 'PSNR (dB)', ssim: 'SSIM', fps: 'Render-call FPS', tradeoff: 'PSNR vs FPS'};
type Metric = keyof typeof metrics;

function SweepChart({points, metric, budget, technique}: {
  points: BenchmarkPoint[]; metric: Metric; budget: number; technique: Technique;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, entry.contentRect.width)));
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);
  const tradeoff = metric === 'tradeoff';
  const field = tradeoff ? 'psnr' : metric;
  const peakFps = Math.ceil(Math.max(...points.map(p => p.fps)) / 20) * 20;
  const top = field === 'ssim' ? 1 : field === 'fps' ? peakFps : Math.ceil(Math.max(...points.map(p => p.psnr)) / 10) * 10;
  const xMax = tradeoff ? peakFps : 100;
  const x = (value: number) => 42 + (width - 64) * value / xMax;
  const y = (value: number) => 144 - 129 * value / top;
  const xy = (p: BenchmarkPoint) => [x(tradeoff ? p.fps : p.budget), y(p[field])];
  const base = points.find(p => p.method === 'opacity' && p.budget === 100)!;
  const [bx, by] = xy(base);
  const yDivisions = field === 'psnr' ? 3 : 4;
  return <div className="sweep-plot" ref={box}>
    <span className="axis-unit">{metrics[field]}</span>
    <svg width="100%" height="175" viewBox={`0 0 ${width} 175`} role="img"
      aria-label={`${metrics[field]} by ${tradeoff ? 'render-call FPS' : 'retention budget'} for the baseline and three selection methods. Exact selected-budget values follow.`}>
      {Array.from({length:yDivisions + 1}, (_, i) => {
        const value = top * i / yDivisions;
        return <g key={i}><line className="grid-line" x1={x(0)} x2={x(xMax)} y1={y(value)} y2={y(value)}/>
          <text x={x(0)-9} y={y(value)+4} textAnchor="end">{Number(value.toFixed(2))}</text></g>;
      })}
      {[0,1,2,3,4].map(i => <text key={i} x={x(i*xMax/4)} y="166" textAnchor="middle">{i*xMax/4}{tradeoff ? '' : '%'}</text>)}
      {!tradeoff && <line className="budget-guide" x1={x(budget)} x2={x(budget)} y1={y(top)} y2={y(0)}/>}
      {methods.map(method => {
        const rows = points.filter(p => p.method === method);
        return <g key={method} className={'series ' + method}>
          {!tradeoff && <polyline points={rows.map(p => xy(p).join(',')).join(' ')} fill="none"/>}
          {rows.map(p => {
            const [cx,cy] = xy(p);
            const selected = p.budget === budget && method === technique;
            const r = selected ? 5 : 3;
            return <g key={p.budget} transform={`translate(${cx} ${cy})`} className={'sample-point' + (selected ? ' chosen' : '')}>
              <title>{seriesNames[method]} · {p.budget}% · {p.psnr.toFixed(2)} dB · SSIM {p.ssim.toFixed(4)} · {p.fps.toFixed(2)} FPS</title>
              {method === 'hybrid' ? <rect x={-r} y={-r} width={2*r} height={2*r}/>
                : method === 'sensitivity' ? <path d={`M0,${-r-1} L${r+1},${r} H${-r-1} Z`}/>
                : <circle r={r}/>}
            </g>;
          })}
        </g>;
      })}
      <path className="baseline-point" d={`M${bx},${by-7}l7,7 -7,7 -7,-7z`}><title>Baseline · 100% · {base[field].toFixed(field === 'ssim' ? 4 : 2)}</title></path>
    </svg>
    <span className="axis-caption">{tradeoff ? 'Render-call FPS' : 'Gaussian retention (%)'}</span>
  </div>;
}

export function BenchmarkTrends({technique, budget}: {technique: Technique; budget: number}) {
  const [points, setPoints] = useState<BenchmarkPoint[]>([]);
  const [metric, setMetric] = useState<Metric>('psnr');
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/benchmark-series', {signal:abort.signal}).then(async response => {
      if (!response.ok) throw new Error(await response.text());
      const rows: BenchmarkPoint[] = await response.json();
      if (!abort.signal.aborted) setPoints(rows);
    }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, []);
  const baseline = points.find(p => p.method === 'opacity' && p.budget === 100);
  return <section className="benchmark-trends">
    <header className="trends-heading"><div><p className="section-label">Aggregate measurements</p><h2>Quality and throughput</h2></div>
      <select aria-label="Chart metric" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
        {(Object.keys(metrics) as Metric[]).map(key => <option key={key} value={key}>{metrics[key]}</option>)}
      </select></header>
    {baseline ? <>
      <div className="chart-legend">{['baseline', ...methods].map(m => <span key={m}><i className={'series-key ' + m}/>{m === 'baseline' ? 'Baseline' : seriesNames[m as BenchmarkMethod]}</span>)}</div>
      <SweepChart points={points} metric={metric} budget={budget} technique={technique}/>
      <div className="sweep-table-wrap" tabIndex={0} role="region" aria-label="Measurements at the selected retention budget"><table className="sweep-table">
        <caption>Recorded measurements at {budget}% retention</caption>
        <thead><tr><th>Method</th><th>Retained</th><th>Gaussians</th><th>PSNR (dB)</th><th>SSIM</th><th>Render FPS</th></tr></thead>
        <tbody>{[baseline, ...points.filter(p => p.budget === budget)].map((p,i) => <tr key={i} className={i > 0 && p.method === technique ? 'selected-result' : ''}>
          <th scope="row"><i className={'series-key ' + (i === 0 ? 'baseline' : p.method)}/>{i === 0 ? 'Baseline' : seriesNames[p.method]}</th>
          <td>{p.budget}%</td><td>{p.count.toLocaleString('en-US')}</td><td>{p.psnr.toFixed(2)}</td><td>{p.ssim.toFixed(4)}</td><td>{p.fps.toFixed(2)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="chart-note">Quality is averaged across 32 test cameras. FPS measures timed Graphdeco render calls. The 100% opacity run supplies the original-model reference.</p>
    </> : <p role="status" className="comparison-message">{error || 'Loading archived measurements…'}</p>}
  </section>;
}

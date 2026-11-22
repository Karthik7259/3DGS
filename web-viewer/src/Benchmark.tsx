import { useState, useEffect } from 'react';
import type { Technique } from './TruckScene';
import { Icon } from './Icon';

type Result = {
  method: string; budget: number; gaussianCount: number; testViews: number; viewIndex: number;
  original: {url: string; psnr: number; ssim: number};
  selected: {url: string; psnr: number; ssim: number; deltaPsnr: number; deltaSsim: number};
};

export function Benchmark({ technique, name, budget, references, frame, setFrame }: {
  technique: Technique; name: string; budget: number; references: string[]; frame: number; setFrame: (frame: number) => void;
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
        if (!abort.signal.aborted) setResult(record);
      }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [technique, budget, frame]);
  const current = result?.method === technique && result.budget === budget && result.viewIndex === frame ? result : null;
  return <section className="benchmark">
    <div className="benchmark-head"><div><div className="section-label">Graphdeco renders</div><h2>Same-camera comparison</h2></div>
      <label>Test camera<select value={frame} disabled={!references.length} onChange={e => setFrame(Number(e.target.value))}>
        {references.map((r,i) => <option key={r} value={i}>{r}</option>)}
      </select></label></div>
    {current ? <>
      <div className="comparison-pair">{[
        {name:'Original model', image:current.original, retention:100},
        {name, image:current.selected, retention:budget},
      ].map(({name, image, retention}, i) => <figure key={i}>
        <img src={image.url} alt={`${name}, camera ${references[frame] ?? frame}`} />
        <figcaption><span>{name}</span><b>{retention}%</b></figcaption>
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

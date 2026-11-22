import { SweepChart, type useBenchmarkSeries } from './Benchmark';
import { Icon } from './Icon';
import type { Technique } from './TruckScene';

type Props = {
  series: ReturnType<typeof useBenchmarkSeries>; technique: Technique; budget: number;
  count: number | null; fps?: number; name: string;
};

export function StudioMetrics({series, technique, budget, count, fps, name}: Props) {
  const row = series.points.find(p => p.method === (technique === 'original' ? 'opacity' : technique) && p.budget === budget);
  const source = technique === 'original' ? 'Baseline' : name;
  const cards = [
    {label:'PSNR', icon:'path', value:row?.psnr.toFixed(4), unit:'dB', detail:source},
    {label:'SSIM', icon:'layers', value:row?.ssim.toFixed(5), detail:source},
    {label:'Motion FPS', icon:'orbit', value:fps?.toFixed(1), detail:fps ? 'Last camera motion' : 'Move camera to sample'},
    {label:'Gaussians', icon:'cube', value:count?.toLocaleString('en-US'), detail:count === null ? 'Loading scene' : budget + '% retained'},
  ] as const;
  return <section className="studio-metrics" aria-label="Scene measurements">
    {cards.map(card => <div className="metric-tile" key={card.label}><h2><Icon name={card.icon}/>{card.label}</h2>
      <strong>{card.value ?? '—'}{'unit' in card && <small> {card.unit}</small>}</strong><span>{card.detail}</span></div>)}
    <div className="studio-chart"><h2>Quality vs. retention</h2>
      {series.points.length ? <><SweepChart compact points={series.points} metric="psnr" budget={budget} technique={technique}/>
        <div className="mini-legend">{['baseline','opacity','sensitivity','hybrid'].map(m => <span key={m}><i className={'series-key '+m}/>{m}</span>)}</div></>
        : <p role="status">{series.error || 'Loading measurements…'}</p>}
    </div>
  </section>;
}

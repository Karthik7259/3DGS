import { useRef, useState, type ReactNode } from 'react';
import type { Diagnostics } from './LiveViewport';
import { Icon } from './Icon';

export function BudgetPicker({values, value, disabled, onChange}: {
  values: readonly number[]; value: number; disabled?: boolean; onChange: (n: number) => void;
}) {
  return <fieldset className="budget-field"><legend>Retention budget</legend>
    <div className={'budget-grid' + (values.length === 2 ? ' compact' : '')}>
      {values.map(v => <button key={v} disabled={disabled} aria-pressed={v === value} onClick={() => onChange(v)}>
        {v}%
      </button>)}
    </div>
  </fieldset>;
}

type Props = {
  count: number | null; total: number; status: string; degree: number;
  saved: boolean; diagnostics: Diagnostics; children: ReactNode; onCompare?: () => void;
};
export function Inspector({count, total, status, degree, saved, diagnostics, children, onCompare}: Props) {
  const [tab, setTab] = useState<'settings' | 'model'>('settings');
  const tabs = useRef<HTMLDivElement>(null);
  const percent = count === null ? null : Math.round(count * 100 / total);
  return <aside id="inspector" className="inspector">
    <header className="inspector-title"><span className="inspector-icon"><Icon name="sliders"/></span>
      <h2>Scene inspector</h2><span className={'badge' + (['Offline','Loading','Updating'].includes(status) ? ' warn' : '')}>{status}</span>
    </header>
    <div className="inspector-tabs" ref={tabs} role="tablist" aria-label="Scene inspector" onKeyDown={e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 'settings' : e.key === 'End' ? 'model' : tab === 'model' ? 'settings' : 'model';
      setTab(next); tabs.current?.querySelector<HTMLButtonElement>('#tab-' + next)?.focus();
    }}>
      {(['settings','model'] as const).map(key => <button key={key} id={'tab-' + key} role="tab" aria-selected={tab === key}
        aria-controls={'panel-' + key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}>
        <Icon name={key === 'settings' ? 'sliders' : 'layers'} size={15}/>{key === 'settings' ? 'Selection' : 'Model'}
      </button>)}
    </div>
    <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={tab !== 'settings'}>
      {children}
      <section className="retention-summary">
        <h3>Selected Gaussians</h3>
        <strong className="count">{count === null ? '—' : count.toLocaleString('en-US')}</strong>
        <div className="count-meter" aria-hidden="true"><i style={{width:(percent ?? 0) + '%'}}/></div>
        <div className="count-scale"><span>of {total.toLocaleString('en-US')}</span><b>{percent === null ? '—' : percent + '%'}</b></div>
      </section>
    </div>
    <div id="panel-model" role="tabpanel" aria-labelledby="tab-model" hidden={tab !== 'model'}>
      <div className="model-heading"><img src="/cameras/side.webp" alt=""/><div><strong>Truck</strong><small>Tanks &amp; Temples</small></div></div>
      <dl className="numeric-rows model-rows">
        <div className="stat-row"><dt>Total Gaussians</dt><dd>{total.toLocaleString('en-US')}</dd></div>
        <div className="stat-row"><dt>Spherical harmonics</dt><dd>Degree {degree}</dd></div>
        <div className="stat-row"><dt>Training iteration</dt><dd>30,000</dd></div>
        <div className="stat-row"><dt>Model format</dt><dd>Graphdeco PLY</dd></div>
      </dl>
    </div>
    <section className="renderer-section" aria-label="Renderer"><div className="engine"><div className="engine-icon"><Icon name="chip" size={20}/></div>
        <div><strong>{saved ? 'Graphdeco' : 'Spark renderer'}</strong><small>{saved ? 'Archived CUDA renders' : 'WebGL 2'} · SH {degree}</small></div></div>
        {!saved && diagnostics.adapter && <details className="diagnostics">
          <summary>Render diagnostics</summary><p>{diagnostics.adapter}</p>
          <p>Last camera motion <strong>{diagnostics.motionFps ? diagnostics.motionFps.toFixed(1) + ' fps' : '—'}</strong></p>
        </details>}
    </section>
    {onCompare && <div className="compare-action"><button onClick={onCompare}><Icon name="compare" size={16}/>Compare benchmarks</button></div>}
  </aside>;
}

import { useRef, useState, type ReactNode } from 'react';
import type { Diagnostics } from './LiveViewport';
import { Icon } from './Icon';

export function BudgetPicker({values, value, disabled, onChange}: {
  values: readonly number[]; value: number; disabled?: boolean; onChange: (n: number) => void;
}) {
  return <fieldset className="budget-field"><legend>Retention budget</legend>
    <div className={'budget-grid' + (values.length === 2 ? ' compact' : '')}>
      {values.map(v => <button key={v} disabled={disabled} aria-pressed={v === value} onClick={() => onChange(v)}>
        <i aria-hidden="true"><b style={{height:v + '%'}}/></i><span>{v}%</span>
      </button>)}
    </div>
  </fieldset>;
}

type Props = {
  count: number | null; total: number; status: string; degree: number;
  saved: boolean; diagnostics: Diagnostics; children: ReactNode;
};
export function Inspector({count, total, status, degree, saved, diagnostics, children}: Props) {
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
      <div className="retention-summary">
        <div className="summary-numbers"><span>Selected Gaussians</span><strong className="count">{count === null ? '—' : count.toLocaleString('en-US')}</strong>
          <small>of {total.toLocaleString('en-US')} total</small></div>
        <div className="retention-ring" aria-label={percent === null ? 'Loading selection' : percent + '% retained'}
          style={{background:`conic-gradient(var(--accent) 0 ${percent ?? 0}%, #3c3c3c ${percent ?? 0}% 100%)`}}>
          <b>{percent === null ? '—' : percent + '%'}</b>
        </div>
      </div>
    </div>
    <div id="panel-model" role="tabpanel" aria-labelledby="tab-model" hidden={tab !== 'model'}>
      <div className="model-heading"><img src="/cameras/side.webp" alt=""/><div><strong>Truck</strong><small>Tanks &amp; Temples</small></div></div>
      <dl className="numeric-rows model-rows">
        <div className="stat-row"><dt>Total Gaussians</dt><dd>{total.toLocaleString('en-US')}</dd></div>
        <div className="stat-row"><dt>Spherical harmonics</dt><dd>Degree {degree}</dd></div>
        <div className="stat-row"><dt>Training iteration</dt><dd>30,000</dd></div>
        <div className="stat-row"><dt>Model format</dt><dd>Graphdeco PLY</dd></div>
      </dl>
      <section className="renderer-section"><div className="engine"><div className="engine-icon"><Icon name="chip" size={21}/></div>
        <div><strong>{saved ? 'Graphdeco' : 'Spark'}</strong><small>{saved ? 'Saved CUDA renders' : 'WebGL 2'}</small></div></div>
        {!saved && diagnostics.adapter && <details className="diagnostics">
          <summary>Render diagnostics</summary><p>{diagnostics.adapter}</p>
          <p>Last camera motion <strong>{diagnostics.motionFps ? diagnostics.motionFps.toFixed(1) + ' fps' : '—'}</strong></p>
        </details>}
      </section>
    </div>
  </aside>;
}

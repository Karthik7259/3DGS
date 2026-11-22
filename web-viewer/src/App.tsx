import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { CAMERA_PRESETS, type CameraPreset, type CameraMode } from './cameraRig';
import type { DisplaySelection, SelectionStatus, Technique } from './TruckScene';
import type { CameraActions, Diagnostics } from './LiveViewport';
import { useTemporalPlayback } from './useTemporalPlayback';
import { TemporalTimeline, TemporalComparison, TemporalMetrics } from './TemporalAnalysis';
import { temporalMethods, temporalNames, type TemporalMethod, type TemporalBudget } from './temporalData';
import { Inspector, BudgetPicker } from './Inspector';
import { Benchmark, BenchmarkTrends, useBenchmarkSeries } from './Benchmark';
import { StudioMetrics } from './StudioMetrics';
import { Icon, Mark } from './Icon';

const LiveViewport = lazy(() => import('./LiveViewport'));
const TOTAL = 2_050_123;
const budgets = [5, 10, 25, 50, 75, 100];
const names: Record<Technique, string> = {
  original: 'Original model', opacity: 'Opacity Top-K', sensitivity: 'Global sensitivity', hybrid: 'Hybrid selection',
};
const descriptions: Record<Technique, string> = {
  original: 'The original reconstruction uses the full retention budget.',
  opacity: 'Ranked by the learned opacity of each Gaussian.',
  sensitivity: 'Ranked by sensitivity across the training views.',
  hybrid: 'Combines sensitivity with the saved ranking for one test camera.',
};
const poseNames = {overview: 'Front', profile: 'Side', rear: 'Rear'};
type Stats = {gaussianCount: number; shDegree: number};
type Run = {technique: Technique; budget: number};
const viewLinks = {workspace:'#workspace', benchmark:'#benchmarks', temporal:'#temporal-analysis', results:'#results'} as const;
type Page = keyof typeof viewLinks;
function currentView(): Page {
  return (Object.keys(viewLinks) as Page[]).find(p => viewLinks[p] === window.location.hash) ?? 'workspace';
}

const toolCaptions: Partial<Record<Parameters<typeof Icon>[0]['name'], string>> = {orbit:'Orbit', hand:'Pan', minus:'Out', plus:'In', focus:'Reset'};

function Tool({icon, label, action, active, disabled, className = ''}: {
  icon: Parameters<typeof Icon>[0]['name']; label: string; action: () => void; active?: boolean; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={'tool ' + className + (active ? ' active' : '')} title={label} aria-label={label}
    aria-pressed={active} disabled={disabled} onClick={action}><Icon name={icon}/>{toolCaptions[icon] && <small>{toolCaptions[icon]}</small>}</button>;
}

export default function App() {
  const series = useBenchmarkSeries();
  const about = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<Page>(currentView);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => {
    const change = () => setPage(currentView());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const navigate = (next: Page) => { window.location.hash = viewLinks[next]; setPage(next); };
  const compare = page === 'benchmark' || page === 'results';
  const temporal = page === 'temporal';
  const [cameraMode, setCameraMode] = useState<CameraMode>('capture');
  const onFreePan = useCallback(() => setCameraMode('free'), []);
  const [panel, setPanel] = useState(() => !window.matchMedia('(max-width: 900px)').matches);
  const [live, setLive] = useState<Run>({technique: 'original', budget: 100});
  const [benchmark, setBenchmark] = useState<Run>({technique: 'opacity', budget: 10});
  const [measured, setMeasured] = useState<{method: string; budget: number; gaussianCount: number} | null>(null);
  const [reference, setReference] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [refError, setRefError] = useState('');
  const [frame, setFrame] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({});
  const onDiagnostics = useCallback((next: Diagnostics) => setDiagnostics(previous => ({...previous, ...next})), []);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [selection, setSelection] = useState<{status: SelectionStatus; count: number; detail?: string; displayed?: DisplaySelection}>({status:'ready', count:TOTAL});
  const [preset, setPreset] = useState<CameraPreset | null>('overview');
  const [pan, setPan] = useState(false);
  const [full, setFull] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const actions = useRef<CameraActions | null>(null);
  const playback = useTemporalPlayback(temporal, actions, cameraReady, selection.displayed?.url, selection.status === 'error');
  const archive = compare || (temporal && playback.compare);
  const sample = playback.pilot?.frames[playback.presentedFrame];
  const ready = Boolean(stats && cameraReady && !error);
  const {technique, budget} = compare ? benchmark : live;
  const changeRun = compare ? setBenchmark : setLive;
  const visibleBudget = technique === 'original' ? 100 : budget;
  const pickMethod = (next: Technique) => changeRun({technique:next, budget:next === 'original' ? 100 : budget === 100 ? 10 : budget});
  const benchmarkCount = page === 'results' ? series.points.find(p => p.method === technique && p.budget === visibleBudget)?.count ?? null : measured?.method === technique && measured.budget === visibleBudget ? measured.gaussianCount : null;
  const activePose = CAMERA_PRESETS.find(p => p.id === preset);
  const onCameraReady = useCallback(() => setCameraReady(true), []);
  const onCameraMove = useCallback(() => setPreset(null), []);
  const onReady = useCallback((result: Stats) => setStats(result), []);
  const onError = useCallback((err: Error) => setError(err.message || 'WebGL 2 could not initialize.'), []);
  const onProgress = useCallback((loaded: number, total?: number) => {
    if (total) setProgress(Math.min(100, Math.round(loaded * 100 / total)));
  }, []);
  const onSelection = useCallback((status: SelectionStatus, count: number, detail?: string, displayed?: DisplaySelection) =>
    setSelection({status, count, detail, displayed}), []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/selection-references', {signal:controller.signal}).then(async r => {
      if (!r.ok) throw new Error('Saved camera references are unavailable.');
      const list: string[] = await r.json();
      if (!list.length) throw new Error('The saved camera list is empty.');
      setReferences(list); setReference(list.includes(CAMERA_PRESETS[0].image) ? CAMERA_PRESETS[0].image : list[0]);
    }).catch((e: Error) => { if (!controller.signal.aborted) setRefError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const update = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const choosePose = (id: CameraPreset) => { actions.current?.go(id); setPreset(id); };
  const fullscreen = async () => {
    try {
      setFullscreenError('');
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch { setFullscreenError('Fullscreen is unavailable in this browser window.'); }
  };
  const retry = () => {
    setError(''); setProgress(0); setCameraReady(false); setStats(null); setDiagnostics({}); setPreset('overview');
    setSelection({status:'ready',count:TOTAL}); setGeneration(id => id + 1);
  };
  const openComparison = () => {
    if (!compare && live.technique !== 'original') {
      setBenchmark(live);
      const matching = references.indexOf(live.technique === 'hybrid' ? reference : activePose?.image ?? '');
      if (matching >= 0) setFrame(matching);
    }
    navigate('benchmark');
  };
  const shown = selection.displayed;
  const shownName = shown && shown.technique !== 'temporal' ? names[shown.technique] : names.original;
  const adapter = diagnostics.adapter?.match(/(?:GeForce |Radeon |Intel\(R\) )([^,(]+?)(?: Laptop GPU| Direct3D| \(0x|,|$)/i)?.[1] ?? (diagnostics.adapter ? 'WebGL 2' : 'GPU');
  return <div className="app-shell studio">
    <header className="topbar">
      <div className="brand"><Mark/><div><strong>SPLAT LAB</strong><span className="brand-descriptor">Spatial Computing Research Studio</span></div></div>
      <div className="research-title">Sensitivity-Guided, View-Dependent Gaussian Selection<small>for Efficient 3D Gaussian Splatting</small></div>
      <div className="hardware" title={diagnostics.adapter}><Icon name="chip" size={16}/>{adapter}<span>{diagnostics.motionFps ? diagnostics.motionFps.toFixed(1) + ' FPS' : 'WebGL 2'}</span></div>
    </header>
    <aside className="studio-rail"><nav aria-label="Workspace views">
      <button aria-label="Workspace" className={page === 'workspace' ? 'current' : ''} aria-current={page === 'workspace' ? 'page' : undefined} onClick={() => navigate('workspace')}><Icon name="cube"/><span>Viewer</span></button>
      <button className="inspector-toggle" aria-expanded={panel} aria-controls="inspector" onClick={() => setPanel(v => !v)}><Icon name="sliders"/><span>Scene inspector</span></button>
      <button className={page === 'benchmark' ? 'current' : ''} aria-current={page === 'benchmark' ? 'page' : undefined} onClick={openComparison}><Icon name="compare"/><span>Benchmarks</span></button>
      <button className={temporal ? 'current' : ''} aria-current={temporal ? 'page' : undefined} onClick={() => navigate('temporal')}><Icon name="path"/><span>Temporal Analysis</span></button>
      <button className={page === 'results' ? 'current' : ''} aria-current={page === 'results' ? 'page' : undefined} onClick={() => navigate('results')}><Icon name="layers"/><span>Results</span></button>
      <button onClick={() => about.current?.showModal()}><Icon name="info"/><span>About</span></button>
    </nav><img className="rail-wave" src="/studio-wave.svg" alt=""/></aside>
    <dialog ref={about} className="studio-dialog" aria-labelledby="about-title"><h2 id="about-title">About Splat Lab</h2><p>Explore the Tanks &amp; Temples Truck reconstruction and compare opacity, global sensitivity, and camera-dependent hybrid selection across six retention budgets.</p><p>Benchmark quality is averaged across 32 held-out cameras. Browser motion FPS is measured locally.</p><form method="dialog"><button>Close</button></form></dialog>
    <main className="main">
      <div className={'workspace' + (panel ? '' : ' collapsed')}>
        <div className="scene-column">
          <div className={'view-shell ' + (temporal ? 'temporal-stage' : compare ? 'benchmark-stage' : 'live-stage')} hidden={page === 'results'} ref={stage}>
            <div className="view-head">
              <div className="view-title"><Icon name={temporal ? 'path' : compare ? 'compare' : 'cube'} size={32}/>
                <div><h1>{temporal ? 'Training trajectory' : compare ? 'Benchmark comparison' : 'Truck Reconstruction'}</h1><small>Tanks &amp; Temples · 3D Gaussian Splatting</small></div></div>
              <div className="head-right">
                {temporal ? <div className="mode-switch" role="group" aria-label="Temporal view">
                  <button aria-pressed={!playback.compare} onClick={() => playback.setCompare(false)}>Live 3D</button>
                  <button aria-pressed={playback.compare} onClick={() => playback.setCompare(true)}>Compare three</button></div>
                : compare ? 'Saved renders' : <select className="orbit-mode" aria-label="Orbit mode" value={cameraMode}
                  onChange={e => { setCameraMode(e.target.value as CameraMode); setPan(false); setPreset(null); }}>
                  <option value="capture">Capture orbit</option><option value="free">Free orbit</option></select>}
                <span className="vline"/><Tool icon={full ? 'shrink' : 'expand'} label={full ? 'Exit fullscreen' : 'Enter fullscreen'} action={fullscreen}/>
              </div></div>
            <div className={'viewport' + (pan ? ' pan' : '')}>
              <div className="canvas-wrap" style={{visibility: archive ? 'hidden' : 'visible'}}>
                {!error && <Suspense fallback={null}><LiveViewport key={generation} actions={actions} enabled={!archive} pan={pan} temporal={temporal} cameraMode={cameraMode} onFreePan={onFreePan}
                  temporalUrl={temporal && playback.pilot ? playback.url : undefined} temporalBudget={playback.budget}
                  technique={live.technique} budget={live.budget} hybridReference={reference}
                  onReady={onReady} onProgress={onProgress} onError={onError} onSelection={onSelection}
                  onCameraReady={onCameraReady} onCameraMove={onCameraMove} onDiagnostics={onDiagnostics}/></Suspense>}
              </div>
              {temporal ? (playback.compare ? <TemporalComparison p={playback}/> : <>
                {playback.prepared && <div className="live-tag"><i/>{playback.inTransit ? 'Between samples' : 'Live 3D'} · Frame {playback.frame + 1}</div>}
                {(!playback.prepared || error || playback.error || selection.status === 'error') && <div className={'pilot-loading' + (ready && !error && !playback.error && selection.status !== 'error' ? ' pending-selection' : '')} role="status">
                  <span>{error || playback.error || (selection.status === 'error' && selection.detail) || (!ready ? 'Preparing Truck model…' : 'Loading measured selection…')}</span>
                  {error && <button onClick={retry}>Retry live view</button>}
                </div>}
              </>) : page === 'results' ? null : compare ? <Benchmark technique={technique} name={names[technique]} budget={visibleBudget} references={references} frame={frame} setFrame={setFrame} onMeasured={setMeasured}/> : <>
                {!ready && <div className="reference-preview"><img src="/benchmark-render/original/100/00007.png" alt="Saved front three-quarter render of the Truck reconstruction"/><span className="preview-tag">Saved reference</span></div>}
                {ready && <div className="scene-readout"><div className="live-tag"><i/>Live render</div>
                  <span>{selection.displayed && selection.displayed.technique !== 'temporal' ? names[selection.displayed.technique] : 'Original model'}</span>
                </div>}
                {!ready ? <div className={'load-card' + (error ? ' error' : '')} role="status">
                  <div className="load-line"><strong>{error ? 'Live viewport unavailable' : progress >= 100 ? 'Preparing Gaussians' : 'Loading reconstruction'}</strong>
                    {!error && <b>{progress}%</b>}</div>
                  {error ? <><p className="load-message">{error}</p><button onClick={retry}>Retry live view</button></> : <div className="progress-track" role="progressbar" aria-label="Reconstruction download" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{width:progress + '%'}}/></div>}
                </div> : <div className="viewport-tools" role="group" aria-label="Viewport navigation">
                  <Tool icon="orbit" label="Orbit tool" active={!pan} action={() => setPan(false)}/>
                  <Tool icon="hand" label="Pan tool" active={pan} action={() => { setCameraMode('free'); setPan(true); }}/><span/>
                  <Tool icon="minus" label="Zoom out" action={() => actions.current?.zoom(1.18)}/>
                  <Tool icon="plus" label="Zoom in" action={() => actions.current?.zoom(1/1.18)}/><span/>
                  <Tool icon="focus" label="Reset camera to front three-quarter" className="reset-button" action={() => choosePose('overview')}/>
                </div>}
                {ready && <div className="pose-dock" role="group" aria-label="Calibrated camera views">{CAMERA_PRESETS.map(p =>
                  <button key={p.id} className={'camera-card' + (preset === p.id ? ' selected' : '')} aria-pressed={preset === p.id}
                    title={p.label} onClick={() => choosePose(p.id)}><Icon name="camera" size={16}/>{poseNames[p.id]}</button>)}</div>}
              </>}
            </div>
            {fullscreenError && <div role="alert" className="selection-status">{fullscreenError}</div>}
            <div className="view-foot"><span><Icon name={archive || temporal ? 'camera' : 'mouse'} size={15}/>
              {temporal ? playback.compare ? 'Matched saved renders' : playback.inTransit ? 'Holding the measured selection between cameras' : 'Measured training camera'
                : compare ? 'Matched test camera' : pan ? 'Drag to pan' : cameraMode === 'capture' ? 'Drag horizontally to orbit' : 'Drag to orbit'}</span>
              <span className="guide-extra">{temporal ? sample?.image : compare ? references[frame] : 'Scroll to zoom'}{!temporal && !compare && <><i/>Right-drag to pan</>}</span>
              <span className="pose-indicator">{archive ? 'Graphdeco' : temporal ? temporalNames[playback.method] : activePose?.label ?? (cameraMode === 'capture' ? 'Capture orbit' : 'Free orbit')}</span>
            </div>
            {temporal && <TemporalTimeline p={playback}/>}
          </div>
          {compare && <BenchmarkTrends technique={technique} budget={visibleBudget} series={series}/>}
        </div>
        {panel && <Inspector
          count={temporal ? sample?.results[playback.method][playback.presentedBudget].count ?? null : compare ? benchmarkCount : ready ? selection.count : null}
          total={stats?.gaussianCount ?? TOTAL} degree={stats?.shDegree ?? 3} diagnostics={diagnostics} saved={archive}
          onCompare={page === 'workspace' ? openComparison : undefined}
          status={archive ? 'Archive' : error || selection.status === 'error' ? 'Offline' : !ready ? 'Loading' : selection.status === 'loading' ? 'Updating' : 'Ready'}>
          {temporal ? <>
            <section className="settings-fields">
              <label htmlFor="temporal-method">Temporal consistency</label>
              <select id="temporal-method" value={playback.method} onChange={e => playback.setMethod(e.target.value as TemporalMethod)}>
                {temporalMethods.map(m => <option key={m} value={m}>{temporalNames[m]}</option>)}
              </select>
              <p className="hint">{playback.method === 'baseline' ? 'Independent Top-K at each sampled camera.'
                : `Retain at least ${playback.method === 'temporal_medium' ? 95 : 98}% of the preceding sample’s Gaussian IDs.`}</p>
              <BudgetPicker values={[5,10]} value={playback.budget} onChange={b => playback.setBudget(b as TemporalBudget)}/>
            </section>
            <TemporalMetrics p={playback}/>
          </> : <section className="settings-fields">
            <label htmlFor="technique-select">Selection method</label>
            <select id="technique-select" value={technique} onChange={e => pickMethod(e.target.value as Technique)}>
              {(Object.keys(names) as Technique[]).filter(k => !compare || k !== 'original').map(k => <option value={k} key={k}>{names[k]}</option>)}
            </select>
            <p className="hint">{descriptions[technique]}</p>
            <BudgetPicker values={budgets} value={visibleBudget} disabled={technique === 'original'} onChange={b => changeRun({technique, budget:b})}/>
            {technique === 'hybrid' && !compare && <><label htmlFor="reference-select">Ranking camera</label>
              <select id="reference-select" value={reference} disabled={!references.length} onChange={e => setReference(e.target.value)}>
                {references.map(r => <option key={r}>{r}</option>)}</select><p className="hint">This ranking stays fixed while you orbit.</p></>}
            {refError && <p role="alert" className="selection-status">{refError}</p>}
            {!compare && selection.status !== 'ready' && <p role="status" className="selection-status">{selection.detail || 'Applying selection…'}
              {selection.displayed && selection.displayed.technique !== 'temporal' && <> Showing {names[selection.displayed.technique]} at {selection.displayed.budget}%.</>}</p>}
          </section>}
        </Inspector>}
      </div>
      {page === 'workspace' && <StudioMetrics series={series} technique={shown?.technique === 'temporal' ? 'original' : shown?.technique ?? 'original'} budget={shown?.budget ?? 100} count={ready ? selection.count : null} fps={ready ? diagnostics.motionFps : undefined} name={shownName}/>}
    </main>
    <footer className="app-footer"><span><Icon name="layers" size={14}/>3D Gaussian Splatting</span><span>Sensitivity-guided, view-dependent Gaussian selection</span></footer>
  </div>;
}

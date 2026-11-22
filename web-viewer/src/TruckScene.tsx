import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ExtSplats, SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { RankedSplats } from './RankedSplats';

export type Technique = 'original' | 'opacity' | 'sensitivity' | 'hybrid';
export type SelectionStatus = 'ready' | 'loading' | 'error';
export type ModelStats = { gaussianCount: number; shDegree: number };
export type DisplaySelection = { technique: Technique | 'temporal'; budget: number; reference?: string; url?: string };

type Props = {
  temporalUrl?: string;
  temporalBudget?: number;
  technique: Technique;
  budget: number;
  hybridReference: string;
  enabled: boolean;
  onProgress: (loaded: number, total?: number) => void;
  onReady: (stats: ModelStats) => void;
  onError: (error: Error) => void;
  onSelection: (status: SelectionStatus, count: number, detail?: string, displayed?: DisplaySelection) => void;
};

type Model = { source: ExtSplats; mesh: SplatMesh };
type ActiveSubset = { mesh: SplatMesh; selection: DisplaySelection; count: number };
const original: DisplaySelection = { technique: 'original', budget: 100 };
const meshOptions = { enableLod: false, raycastable: false, editable: false };

export function TruckScene({ temporalUrl, temporalBudget, technique, budget: workspaceBudget, hybridReference, enabled, onProgress, onReady, onError, onSelection }: Props) {
  const { gl, scene, invalidate } = useThree();
  const budget = temporalUrl ? temporalBudget! : workspaceBudget;
  const [model, setModel] = useState<Model | null>(null);
  const renderer = useRef<SparkRenderer | null>(null);
  const pendingDisplay = useRef<{ mesh: SplatMesh; ready: () => void } | null>(null);
  const pendingReady = useRef<ModelStats | null>(null);
  const active = useRef<ActiveSubset | null>(null);
  const callbacks = useRef({ onProgress, onReady, onError, onSelection });
  useEffect(() => { callbacks.current = { onProgress, onReady, onError, onSelection }; },
    [onProgress, onReady, onError, onSelection]);

  useFrame(() => {
    const pending = pendingDisplay.current;
    if (pending && renderer.current?.display.mapping.some(entry => entry.node === pending.mesh)) {
      pendingDisplay.current = null;
      pending.ready();
    }
    // A resolved PLY decode can precede the first GPU depth sort by several
    // frames. Keep the labeled reference visible until Spark can draw splats.
    if (pendingReady.current && renderer.current?.activeSplats) {
      const stats = pendingReady.current;
      pendingReady.current = null;
      Object.assign(window, { __viewerDebug: stats });
      callbacks.current.onReady(stats);
    }
  });

  useEffect(() => {
    let disposed = false;
    let mesh: SplatMesh | undefined;
    let lastReported = -Infinity;
    const spark = new SparkRenderer({
      renderer: gl, onDirty: invalidate, enableLod: false, sortRadial: false,
      // Match the unfiltered Graphdeco training rasterizer's three-sigma
      // footprint and +0.3 diagonal pixel covariance without alpha compensation.
      accumExtSplats: true, maxStdDev: 3, preBlurAmount: 0.3, blurAmount: 0,
    });
    renderer.current = spark;
    scene.add(spark);
    const source = new ExtSplats({
      url: '/model/truck.ply',
      onProgress(event) {
        const now = performance.now();
        if (disposed || (now - lastReported < 100 && event.loaded !== event.total)) return;
        lastReported = now;
        callbacks.current.onProgress(event.loaded, event.lengthComputable ? event.total : undefined);
      },
    });
    source.initialized.then(() => {
      if (disposed) { source.dispose(); return; }
      const stats = { gaussianCount: source.getNumSplats(), shDegree: source.getNumSh() };
      if (stats.gaussianCount !== 2_050_123 || stats.shDegree !== 3) {
        throw new Error('The decoded Truck model does not match the count and degree-3 SH of the benchmark.');
      }
      mesh = new SplatMesh({ ...meshOptions, splats: source });
      mesh.userData.originalGaussianIds = null; // Identity mapping for the full model.
      scene.add(mesh);
      setModel({ source, mesh });
      pendingReady.current = stats;
      invalidate();
    }).catch((error: unknown) => {
      if (!disposed) callbacks.current.onError(error instanceof Error ? error : new Error(String(error)));
    });

    return () => {
      disposed = true;
      renderer.current = null;
      pendingReady.current = null;
      pendingDisplay.current = null;
      const subset = active.current;
      if (subset) {
        scene.remove(subset.mesh);
        subset.mesh.dispose();
        active.current = null;
      }
      // SplatMesh owns its source. A decoding worker can finish after unmount;
      // in that case the completion handler above releases its result.
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      else if (source.isInitialized) source.dispose();
      scene.remove(spark);
      spark.dispose();
    };
  }, [gl, scene, invalidate]);

  const reference = !temporalUrl && technique === 'hybrid' && budget < 100 ? hybridReference : undefined;
  useEffect(() => {
    if (!model || !enabled) return;
    const { source, mesh } = model;
    const total = source.getNumSplats();
    const controller = new AbortController();
    const previous = active.current;
    const report = (status: SelectionStatus, detail?: string) => {
      const shown = active.current;
      const selection = shown?.selection ?? original;
      const count = shown?.count ?? total;
      callbacks.current.onSelection(status, count, detail, selection);
      Object.assign(window, { __viewerSelectionDebug: {
        ...selection, selectedCount: count, shDegree: source.getNumSh(),
        firstGaussianIds: shown ? Array.from((shown.mesh.splats as RankedSplats).originalIds.subarray(0, 5)) : [0, 1, 2, 3, 4],
      } });
    };
    const replace = (next: ActiveSubset | null) => {
      const nextMesh = next?.mesh ?? mesh;
      if (nextMesh.parent !== scene) scene.add(nextMesh);
      if (previous) { scene.remove(previous.mesh); previous.mesh.dispose(); }
      if (next) scene.remove(mesh);
      active.current = next;
      pendingDisplay.current = { mesh: nextMesh, ready: () => report('ready') };
      invalidate();
    };
    if (!temporalUrl && (technique === 'original' || budget === 100)) {
      replace(null);
      return;
    }
    const requested: DisplaySelection = {technique: temporalUrl ? 'temporal' : technique, budget, reference, url: temporalUrl};
    if (previous && previous.selection.technique === requested.technique && previous.selection.budget === budget
      && previous.selection.reference === reference && previous.selection.url === temporalUrl) {
      pendingDisplay.current = { mesh: previous.mesh, ready: () => report('ready') };
      invalidate();
      return;
    }

    report('loading', 'Loading ranked Gaussian IDs…');
    const query = new URLSearchParams({ method: technique, budget: String(budget), reference: reference ?? '' });
    const load = async () => {
      const response = await fetch(temporalUrl ?? `/api/selection?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error(await response.text());
      const buffer = await response.arrayBuffer();
      const count = Math.floor(total * budget / 100);
      if (buffer.byteLength !== count * 4) throw new Error('The ranking length does not match the selected budget.');
      if (controller.signal.aborted) return;
      const ranked = new RankedSplats(source, new Uint32Array(buffer));
      const subsetMesh = new SplatMesh({ ...meshOptions, splats: ranked });
      subsetMesh.userData.originalGaussianIds = ranked.originalIds;
      replace({ mesh: subsetMesh, selection: requested, count });
    };
    load().catch((error: unknown) => {
      if (!controller.signal.aborted) report('error', error instanceof Error ? error.message : String(error));
    });
    return () => { controller.abort(); pendingDisplay.current = null; };
  }, [model, enabled, technique, budget, reference, temporalUrl, invalidate, scene]);

  return null;
}

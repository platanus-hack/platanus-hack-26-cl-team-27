'use client';

import { useEffect, useRef, useState } from 'react';

import {
  getViewerModels,
  getViewerToken,
  type ViewerModel,
} from '@/lib/aps-api';
import {
  createCaseScene,
  planScene,
  selectCaseModels,
  type AxisMap,
  type CaseFlowState,
  type CaseScene,
} from '@/lib/aps-viewer-flow';

export interface CaseModelViewProps {
  readonly flow: CaseFlowState | null;
  readonly models?: readonly ViewerModel[];
  readonly externalIds?: Readonly<Record<string, string>>;
  readonly axes?: AxisMap;
  readonly className?: string;
  readonly hideWhenMissing?: boolean;
}

type Phase = 'loading-list' | 'missing' | 'loading-viewer' | 'ready' | 'error';

export const MISSING_MODELS_TEXT =
  'Modelos del caso no cargados: se muestra el plano 2D';

export function CaseModelView({
  flow,
  models,
  externalIds,
  axes,
  className,
  hideWhenMissing = false,
}: CaseModelViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<CaseScene | null>(null);
  const [found, setFound] = useState<readonly ViewerModel[] | null>(
    models ? selectCaseModels(models) : null,
  );
  const [phase, setPhase] = useState<Phase>(
    models ? 'loading-viewer' : 'loading-list',
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (models) {
      setFound(selectCaseModels(models));
      return;
    }
    const abort = new AbortController();
    getViewerModels(abort.signal).then(
      ({ models: all }) => setFound(selectCaseModels(all)),
      () => setFound([]),
    );
    return () => abort.abort();
  }, [models]);

  const urns = found?.map((model) => model.urn).join(',') ?? '';

  useEffect(() => {
    if (found === null) return;
    const element = container.current;
    if (found.length === 0 || !element) {
      setPhase('missing');
      return;
    }
    let cancelled = false;
    setPhase('loading-viewer');
    setProblem(null);
    createCaseScene(
      element,
      found,
      getViewerToken,
      { externalIds, axes },
      () => cancelled,
    ).then(
      (created) => {
        if (!created) return;
        if (cancelled) {
          created.dispose();
          return;
        }
        scene.current = created;
        setReady(true);
        setPhase('ready');
      },
      (error: unknown) => {
        if (cancelled) return;
        setProblem(error instanceof Error ? error.message : String(error));
        setPhase('error');
      },
    );
    return () => {
      cancelled = true;
      setReady(false);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [urns]);

  useEffect(() => {
    if (!ready) return;
    scene.current?.apply(planScene(flow)).catch(() => undefined);
  }, [ready, flow]);

  const unavailable = phase === 'missing' || phase === 'error';
  const silent = hideWhenMissing && (unavailable || phase === 'loading-list');

  return (
    <div className={silent ? 'hidden' : className}>
      {phase === 'missing' && (
        <p role="status" className="text-sm text-ink-2">
          {MISSING_MODELS_TEXT}
        </p>
      )}
      {phase === 'error' && (
        <p role="alert" className="text-sm text-critical-text">
          No se pudo abrir el visor 3D: se muestra el plano 2D. {problem}
        </p>
      )}
      {phase === 'loading-viewer' && (
        <p role="status" className="text-sm text-ink-2">
          Cargando los modelos del caso…
        </p>
      )}
      <div
        ref={container}
        className={
          unavailable
            ? 'hidden'
            : 'relative h-[50vh] min-h-72 w-full overflow-hidden rounded-xl border border-hairline'
        }
      />
    </div>
  );
}

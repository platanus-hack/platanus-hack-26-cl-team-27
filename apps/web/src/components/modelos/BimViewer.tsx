'use client';

import { useEffect, useRef, useState } from 'react';

import {
  DISCIPLINE_LABELS,
  getViewerToken,
  type Discipline,
  type ViewerModel,
} from '@/lib/aps-api';
import {
  createViewerControls,
  initializeViewer,
  loadDocument,
  pick3dView,
  primaryDiscipline,
  selectionFromEvent,
  type ElementRef,
  type ViewerControls,
  type ViewerModelHandle,
} from '@/lib/aps-viewer';

export interface BimViewerProps {
  readonly models: readonly ViewerModel[];
  readonly onReady?: (controls: ViewerControls) => void;
  readonly onSelectionChange?: (elements: ElementRef[]) => void;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

type LoadProblem = {
  readonly discipline: Discipline;
  readonly message: string;
};

export function BimViewer({
  models,
  onReady,
  onSelectionChange,
}: BimViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const controls = useRef<ViewerControls | null>(null);
  const callbacks = useRef({ onReady, onSelectionChange });
  callbacks.current = { onReady, onSelectionChange };
  const wanted = useRef<Set<Discipline>>(new Set());
  const [states, setStates] = useState<Partial<Record<Discipline, LoadState>>>(
    {},
  );
  const [visible, setVisible] = useState<ReadonlySet<Discipline>>(new Set());
  const [problems, setProblems] = useState<LoadProblem[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = container.current;
    const primary = primaryDiscipline(models.map((m) => m.discipline));
    if (!element || !primary) return;
    let cancelled = false;
    let finish: (() => void) | null = null;
    wanted.current = new Set([primary]);
    setVisible(new Set([primary]));
    setStates({ [primary]: 'loading' });

    const run = async () => {
      const viewing = await initializeViewer(() =>
        getViewerToken().catch((error: unknown) => {
          setFatal('No pudimos pedir el token del visor a la API.');
          throw error;
        }),
      );
      if (cancelled) return;
      const viewer = new viewing.GuiViewer3D(element);
      if (viewer.start() > 0) throw new Error('Tu navegador no soporta WebGL.');
      finish = () => viewer.finish();

      const handles = new Map<Discipline, ViewerModelHandle>();
      const pending = new Map<Discipline, Promise<void>>();
      let globalOffset: { x: number; y: number; z: number } | undefined;

      const loadModel = async (model: ViewerModel) => {
        const doc = await loadDocument(viewing, model.urn);
        if (cancelled) return;
        const view = pick3dView(
          doc.getRoot().search({ type: 'geometry', role: '3d' }),
        );
        if (!view) throw new Error('el modelo no trae una vista 3D');
        const handle = await viewer.loadDocumentNode(doc, view, {
          keepCurrentModels: true,
          applyRefPoint: true,
          ...(globalOffset ? { globalOffset } : {}),
        });
        if (cancelled) return;
        globalOffset ??= handle.getData().globalOffset;
        handles.set(model.discipline, handle);
        if (!wanted.current.has(model.discipline)) viewer.hideModel(handle);
      };

      const ensureLoaded = (discipline: Discipline): Promise<void> => {
        const existing = pending.get(discipline);
        if (existing) return existing;
        const model = models.find((m) => m.discipline === discipline);
        if (!model) {
          return Promise.reject(new Error(`No hay modelo de ${discipline}`));
        }
        setStates((current) => ({ ...current, [discipline]: 'loading' }));
        const before =
          discipline === primary ? Promise.resolve() : ensureLoaded(primary);
        const promise = before
          .then(() => loadModel(model))
          .then(
            () => {
              if (!cancelled) {
                setStates((current) => ({
                  ...current,
                  [discipline]: 'loaded',
                }));
              }
            },
            (error: unknown) => {
              pending.delete(discipline);
              if (cancelled) return;
              setStates((current) => ({ ...current, [discipline]: 'error' }));
              setProblems((current) => [
                ...current.filter((p) => p.discipline !== discipline),
                {
                  discipline,
                  message:
                    error instanceof Error ? error.message : String(error),
                },
              ]);
              throw error;
            },
          );
        pending.set(discipline, promise);
        return promise;
      };

      const showDiscipline = (discipline: Discipline): Promise<void> => {
        wanted.current = new Set([...wanted.current, discipline]);
        setVisible(new Set(wanted.current));
        const promise = ensureLoaded(discipline);
        const handle = handles.get(discipline);
        if (handle) viewer.showModel(handle, true);
        return promise;
      };

      controls.current = createViewerControls(viewer, handles, showDiscipline);
      setReady(true);
      viewer.addEventListener(
        viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
        (event) =>
          callbacks.current.onSelectionChange?.(
            selectionFromEvent(event, handles),
          ),
      );
      await ensureLoaded(primary).catch(() => undefined);
      if (cancelled) return;
      callbacks.current.onReady?.(controls.current);
    };

    run().catch((error: unknown) => {
      if (!cancelled) {
        setFatal(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      cancelled = true;
      controls.current = null;
      setReady(false);
      finish?.();
      setStates({});
      setProblems([]);
      setVisible(new Set());
    };
  }, [models]);

  const toggle = (discipline: Discipline) => {
    const show = !visible.has(discipline);
    const next = new Set(visible);
    if (show) next.add(discipline);
    else next.delete(discipline);
    wanted.current = next;
    setVisible(next);
    const current = controls.current;
    if (!current) return;
    if (states[discipline] === 'loaded') {
      current.setDisciplineVisible(discipline, show);
    } else if (show) {
      setProblems((list) => list.filter((p) => p.discipline !== discipline));
      current.ensureLoaded(discipline).catch(() => undefined);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Disciplinas</legend>
        {models.map(({ discipline, file }) => {
          const state = states[discipline] ?? 'idle';
          return (
            <label
              key={file}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={visible.has(discipline)}
                disabled={!ready}
                onChange={() => toggle(discipline)}
              />
              {DISCIPLINE_LABELS[discipline]}
              {state === 'loading' && (
                <span className="text-ink-2">(cargando…)</span>
              )}
            </label>
          );
        })}
      </fieldset>
      {fatal && (
        <p role="alert" className="text-sm text-critical-text">
          {fatal}
        </p>
      )}
      {problems.map(({ discipline, message }) => (
        <p key={discipline} role="alert" className="text-sm text-critical-text">
          {DISCIPLINE_LABELS[discipline]}: {message}
        </p>
      ))}
      <div
        ref={container}
        className="relative h-[70vh] min-h-96 w-full overflow-hidden rounded-xl border border-hairline"
      />
    </div>
  );
}

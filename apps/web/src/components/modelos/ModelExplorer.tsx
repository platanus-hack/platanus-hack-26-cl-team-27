'use client';

import { Card, PageHeader } from '@team27/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Empty, Loading, LoadError } from '@/components/common/LoadState';
import {
  DISCIPLINE_LABELS,
  getViewerModels,
  type ViewerModel,
} from '@/lib/aps-api';
import type {
  ElementProperties,
  ElementRef,
  ViewerControls,
} from '@/lib/aps-viewer';
import { describeError } from '@/lib/http';

import { BimViewer } from './BimViewer';

export function ModelExplorer() {
  const [models, setModels] = useState<ViewerModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controls = useRef<ViewerControls | null>(null);
  const [selected, setSelected] = useState<
    (ElementProperties & { discipline: ElementRef['discipline'] }) | null
  >(null);

  useEffect(() => {
    const abort = new AbortController();
    getViewerModels(abort.signal).then(
      ({ models: found }) => setModels(found),
      (reason: unknown) => setError(describeError(reason)),
    );
    return () => abort.abort();
  }, []);

  const onReady = useCallback((ready: ViewerControls) => {
    controls.current = ready;
  }, []);

  const onSelectionChange = useCallback((elements: ElementRef[]) => {
    const first = elements[0];
    if (!first || !controls.current) {
      setSelected(null);
      return;
    }
    controls.current.getProperties(first).then(
      (properties) =>
        setSelected({ ...properties, discipline: first.discipline }),
      () => setSelected(null),
    );
  }, []);

  return (
    <>
      <PageHeader
        title="Modelos"
        description="Todas las disciplinas del proyecto en una sola escena."
      />
      {!models && !error && <Loading />}
      {error && <LoadError message={error} />}
      {models?.length === 0 && (
        <Empty>Todavía no hay modelos traducidos. Corre pnpm aps:models.</Empty>
      )}
      {models && models.length > 0 && (
        <div className="flex flex-col gap-4">
          <BimViewer
            models={models}
            onReady={onReady}
            onSelectionChange={onSelectionChange}
          />
          {selected && (
            <Card
              title={selected.name ?? `Elemento ${selected.dbId}`}
              description={`${DISCIPLINE_LABELS[selected.discipline]} · ${selected.externalId ?? ''}`}
            >
              <dl className="grid max-h-80 grid-cols-[auto_1fr] gap-x-4 gap-y-1 overflow-auto text-sm">
                {selected.properties.map((property, index) => (
                  <div key={index} className="contents">
                    <dt className="text-ink-2">{property.displayName}</dt>
                    <dd className="text-ink">
                      {String(property.displayValue ?? '')}
                      {property.units ? ` ${property.units}` : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

'use client';

import { Card, PageHeader } from '@team27/ui';
import { useState } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { useLive } from '@/hooks/use-live';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { getSpaces } from '@/lib/spaces-api';

import { DocumentList } from './DocumentList';
import { SpaceTabs } from './SpaceTabs';

export function SpaceExplorer() {
  const { data, error, loading } = useLive({
    load: getSpaces,
    intervalMs: DEFAULT_INTERVAL_MS,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const spaces = data?.spaces ?? [];
  const active = spaces.find((space) => space.id === chosen) ?? spaces[0];

  return (
    <>
      <PageHeader
        title="Espacios"
        description="Dónde vive hoy la información de la obra."
      />
      {loading && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && active && (
        <div className="flex flex-col gap-4">
          <SpaceTabs
            spaces={spaces}
            activeId={active.id}
            onChange={setChosen}
          />
          <Card title={active.name} description={`Dueño: ${active.ownerName}`}>
            <DocumentList documents={active.documents} />
          </Card>
          <p className="text-sm text-ink-2">
            Nadie migró nada: mostramos el puntero, no el archivo.
          </p>
        </div>
      )}
    </>
  );
}

import { Card, PageHeader, StatusBadge } from '@team27/ui';

import { getApiStatus } from '@/lib/api';

export default async function HomePage() {
  const status = await getApiStatus();
  const database = {
    ok: { tone: 'good', label: 'Responde' },
    error: { tone: 'serious', label: 'No responde' },
    unknown: { tone: 'neutral', label: 'Sin dato' },
  } as const;
  return (
    <>
      <PageHeader
        title="Panel"
        description="La información del negocio, en un solo lugar."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Sin datos todavía" className="md:col-span-2">
          <p className="text-sm text-ink-2">
            Este panel se llena con lo que construyamos durante la hackatón.
          </p>
        </Card>
        <Card title="Estado">
          <ul className="flex flex-col gap-2 text-sm text-ink">
            <li className="flex items-center justify-between gap-4">
              API
              <StatusBadge
                tone={status.api === 'ok' ? 'good' : 'serious'}
                label={status.api === 'ok' ? 'Responde' : 'No responde'}
              />
            </li>
            <li className="flex items-center justify-between gap-4">
              Base de datos
              <StatusBadge
                tone={database[status.database].tone}
                label={database[status.database].label}
              />
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}

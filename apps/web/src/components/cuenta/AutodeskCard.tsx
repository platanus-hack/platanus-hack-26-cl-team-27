'use client';

import { Button, Card, Notice, StatusBadge } from '@team27/ui';
import { useState } from 'react';

import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  authorizeAutodesk,
  connectionSummary,
  disconnectAutodesk,
  getAutodeskConnection,
} from '@/lib/autodesk-api';
import { describeError } from '@/lib/http';

export function AutodeskCard({
  organizationId,
  canManage,
}: {
  readonly organizationId: string;
  readonly canManage: boolean;
}) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = useResource(
    (signal) => getAutodeskConnection(organizationId, signal),
    `${organizationId}:${version}`,
  );

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await authorizeAutodesk(organizationId);
      window.location.assign(url);
    } catch (reason) {
      setError(describeError(reason));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectAutodesk(organizationId);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setBusy(false);
    }
  };

  const connection = state.data?.connection ?? null;
  return (
    <Card
      title="Autodesk Construction Cloud"
      description="Conecta la cuenta de Autodesk de la organización una vez para leer sus proyectos."
    >
      {state.error && <LoadError message={state.error} />}
      {!state.data && !state.error && <Loading />}
      {state.data && !state.data.configured && (
        <Notice>
          La conexión con Autodesk no está configurada en este ambiente.
        </Notice>
      )}
      {state.data?.configured && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusBadge
            tone={
              connection?.status === 'active'
                ? 'good'
                : connection
                  ? 'serious'
                  : 'neutral'
            }
            label={connectionSummary(connection)}
          />
          {canManage && (
            <div className="flex gap-2">
              {connection?.status !== 'active' && (
                <Button disabled={busy} onClick={() => void connect()}>
                  {connection
                    ? 'Volver a conectar'
                    : 'Conectar cuenta de Autodesk'}
                </Button>
              )}
              {connection && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  Desconectar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </Card>
  );
}

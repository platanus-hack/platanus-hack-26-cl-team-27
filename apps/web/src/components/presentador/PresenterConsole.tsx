'use client';

import { Button, Notice } from '@team27/ui';
import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';

import { ProposalDrawer } from '@/components/cambios/ProposalDrawer';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Icon } from '@/components/common/Icon';
import { buttonLink } from '@/components/common/link-styles';
import { LiveBadge } from '@/components/common/LiveBadge';
import {
  Loading,
  LoadError,
  WaitingForLake,
} from '@/components/common/LoadState';
import { SectionHeader } from '@/components/common/SectionHeader';
import { usePresenterKey } from '@/hooks/use-presenter-key';
import { useLive } from '@/hooks/use-live';
import { attentionItems } from '@/lib/attention';
import { ApiError, describeError } from '@/lib/http';
import { getInbox, type InboxDiscrepancy } from '@/lib/inbox-api';
import {
  actionsFor,
  getProposals,
  reopenProposal,
  withdrawProposal,
  type ProposalView,
} from '@/lib/proposals-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import {
  getRoom,
  releaseSeat,
  resetRoom,
  type CastMember,
} from '@/lib/room-api';
import { dismissDiscrepancy } from '@/lib/votes-api';

import { AttentionList } from './AttentionList';
import { KeyGate } from './KeyGate';
import { ProposalTable } from './ProposalTable';
import { SeatList } from './SeatList';

const REJECTED = 'La clave no es correcta.';

type Confirm =
  | { readonly kind: 'withdraw'; readonly proposal: ProposalView }
  | { readonly kind: 'dismiss'; readonly discrepancy: InboxDiscrepancy }
  | { readonly kind: 'reset' };

function Panel({ children }: { readonly children: ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface px-5 py-4">
      {children}
    </section>
  );
}

export function PresenterConsole() {
  const { ready, key, save, forget } = usePresenterKey();
  const [rejected, setRejected] = useState<string | null>(null);
  const [openChange, setOpenChange] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const room = await getRoom(signal);
        const presenter = room.cast.find((member) => member.presenter);
        const [proposals, inbox] = await Promise.all([
          getProposals(undefined, signal),
          presenter && !room.lake.empty
            ? getInbox(presenter.id, { presenterKey: key }, signal)
            : Promise.resolve(null),
        ]);
        return {
          room,
          proposals: proposals.proposals,
          inbox: inbox?.items ?? [],
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          forget();
          setRejected(REJECTED);
        }
        throw error;
      }
    },
    [key, forget],
  );

  const { data, error, loading, status, events, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: key ?? '',
    enabled: ready && key !== null,
  });

  const close = useCallback(() => setOpenChange(null), []);

  if (!ready) return <Loading />;
  if (!key)
    return (
      <KeyGate
        message={rejected}
        onSubmit={(value) => {
          setRejected(null);
          save(value);
        }}
      />
    );

  const auth = { presenterKey: key };

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      setConfirm(null);
      reload();
    } catch (failure) {
      setActionError(describeError(failure));
    } finally {
      setBusyId(null);
    }
  };

  const reopen = (proposal: ProposalView) =>
    void run(proposal.id, () => reopenProposal(proposal.id, auth));
  const release = (member: CastMember) =>
    void run(member.id, () => releaseSeat(member.id, auth));
  const open = (proposal: ProposalView) => setOpenChange(proposal.changeId);

  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.kind === 'withdraw')
      void run(confirm.proposal.id, () =>
        withdrawProposal(confirm.proposal.id, auth),
      );
    if (confirm.kind === 'dismiss')
      void run(confirm.discrepancy.id, () =>
        dismissDiscrepancy(confirm.discrepancy.id, auth),
      );
    if (confirm.kind === 'reset') void run('reset', () => resetRoom(auth));
  };

  const attention = data ? attentionItems(data.inbox, data.proposals) : [];
  const drawerProposal =
    data?.proposals.find((p) => p.changeId === openChange) ?? null;
  const drawerActions = drawerProposal
    ? actionsFor(drawerProposal.status)
    : null;
  const occupied = data?.room.cast.filter((m) => m.occupied).length ?? 0;
  const seats = data?.room.cast.filter((m) => !m.presenter).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Sala de Fernanda
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Resuelve lo que está trabado y supervisa la coordinación de la obra.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge status={status} />
          <Link
            href="/sala"
            target="_blank"
            className={buttonLink('secondary')}
          >
            Abrir la sala
            <Icon name="external" />
          </Link>
        </div>
      </header>

      {actionError && !confirm && <Notice tone="error">{actionError}</Notice>}
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            {data.room.lake.empty ? (
              <WaitingForLake />
            ) : (
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title="Requieren atención"
                  count={attention.length}
                  tone="critical"
                />
                <AttentionList
                  items={attention}
                  busyId={busyId}
                  onReopen={reopen}
                  onOpen={open}
                  onDismiss={(discrepancy) =>
                    setConfirm({ kind: 'dismiss', discrepancy })
                  }
                />
              </section>
            )}
            <section className="flex flex-col gap-3">
              <SectionHeader title="Propuestas" />
              <ProposalTable
                proposals={data.proposals}
                busyId={busyId}
                onOpen={open}
                onReopen={reopen}
                onWithdraw={(proposal) =>
                  setConfirm({ kind: 'withdraw', proposal })
                }
              />
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 self-start">
            <Panel>
              <SectionHeader
                title="Asientos"
                as="h2"
                className="mb-3"
                action={
                  <span className="text-xs text-ink-2">
                    {occupied} de {seats} con persona
                  </span>
                }
              />
              <SeatList
                cast={data.room.cast}
                busyId={busyId}
                onRelease={release}
              />
            </Panel>
            <Panel>
              <SectionHeader title="Administración" as="h2" className="mb-2" />
              <p className="text-sm text-ink-2">
                Los documentos llegan por el ETL (
                <code className="text-ink">pnpm etl</code>). Reiniciar vuelve la
                sala al comienzo.
              </p>
              <Button
                variant="danger"
                className="mt-3 w-full"
                onClick={() => {
                  setActionError(null);
                  setConfirm({ kind: 'reset' });
                }}
              >
                <Icon name="refresh" />
                Reiniciar la sala
              </Button>
            </Panel>
          </aside>
        </div>
      )}

      {openChange && (
        <ProposalDrawer
          changeId={openChange}
          refreshKey={events[0]?.seq ?? 0}
          onClose={close}
          respond={false}
          footer={
            drawerProposal &&
            drawerActions &&
            (drawerActions.reopen || drawerActions.withdraw) ? (
              <div className="flex flex-wrap justify-end gap-2">
                {drawerActions.withdraw && (
                  <Button
                    variant="danger"
                    disabled={busyId !== null}
                    onClick={() =>
                      setConfirm({ kind: 'withdraw', proposal: drawerProposal })
                    }
                  >
                    Retirar
                  </Button>
                )}
                {drawerActions.reopen && (
                  <Button
                    disabled={busyId !== null}
                    onClick={() => reopen(drawerProposal)}
                  >
                    Reabrir con la observación
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      )}

      {confirm?.kind === 'reset' && (
        <ConfirmDialog
          title="¿Reiniciar la sala?"
          confirmLabel="Sí, reiniciar"
          busyLabel="Reiniciando…"
          busy={busyId === 'reset'}
          error={actionError}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        >
          Se borra todo lo ocurrido: propuestas, votos, discrepancias y
          desfases. Los celulares sueltan su asiento y vuelven al inicio.
          Después corre <code className="text-ink">pnpm etl</code> para la carga
          inicial.
        </ConfirmDialog>
      )}
      {confirm?.kind === 'withdraw' && (
        <ConfirmDialog
          title="¿Retirar la propuesta?"
          confirmLabel="Sí, retirar"
          busyLabel="Retirando…"
          busy={busyId === confirm.proposal.id}
          error={actionError}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        >
          {confirm.proposal.title}. Lo vigente no cambia y la propuesta pasa al
          historial. Para volver a proponerla hace falta una revisión nueva.
        </ConfirmDialog>
      )}
      {confirm?.kind === 'dismiss' && (
        <ConfirmDialog
          title="¿Descartar la discrepancia?"
          confirmLabel="Sí, descartar"
          busyLabel="Descartando…"
          busy={busyId === confirm.discrepancy.id}
          error={actionError}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        >
          {confirm.discrepancy.sourceTitle} dice algo distinto de lo vigente
          sobre {confirm.discrepancy.subjectName.toLowerCase()}. Si la
          descartas, deja de contar como pendiente y lo vigente sigue igual.
        </ConfirmDialog>
      )}
    </div>
  );
}

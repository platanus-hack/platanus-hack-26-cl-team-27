'use client';

import { Button } from '@team27/ui';
import { useState } from 'react';

import { ActionMenu, type MenuAction } from '@/components/common/ActionMenu';
import { RelativeTime } from '@/components/common/RelativeTime';
import { ProposalStatusChip } from '@/components/common/status';
import { Tabs } from '@/components/common/Tabs';
import {
  actionsFor,
  changeOf,
  isActive,
  lastActivity,
  splitProposals,
  type ProposalView,
} from '@/lib/proposals-api';

type View = 'active' | 'history';

export function ProposalTable({
  proposals,
  busyId,
  onOpen,
  onReopen,
  onWithdraw,
}: {
  readonly proposals: readonly ProposalView[];
  readonly busyId: string | null;
  readonly onOpen: (proposal: ProposalView) => void;
  readonly onReopen: (proposal: ProposalView) => void;
  readonly onWithdraw: (proposal: ProposalView) => void;
}) {
  const [view, setView] = useState<View>('active');
  const { active, history } = splitProposals(proposals);
  const rows = view === 'active' ? active : history;

  const menuFor = (proposal: ProposalView): MenuAction[] => {
    const allowed = actionsFor(proposal.status);
    const busy = busyId === proposal.id;
    return [
      ...(allowed.reopen
        ? [
            {
              label: 'Reabrir con la observación',
              onSelect: () => onReopen(proposal),
              disabled: busy,
            },
          ]
        : []),
      ...(allowed.withdraw
        ? [
            {
              label: 'Retirar la propuesta',
              onSelect: () => onWithdraw(proposal),
              danger: true,
              disabled: busy,
            },
          ]
        : []),
    ];
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <Tabs
        label="Propuestas"
        className="px-3"
        active={view}
        onChange={setView}
        tabs={[
          { id: 'active', label: 'Activas', count: active.length },
          { id: 'history', label: 'Historial', count: history.length },
        ]}
      />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-2">
          {view === 'active'
            ? 'No hay propuestas activas. Aparecen cuando un documento con autoridad cambia algo.'
            : 'Todavía no hay propuestas fusionadas, retiradas ni reemplazadas.'}
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-ink-2">
              <th scope="col" className="px-5 py-2 font-medium">
                Propuesta
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Estado
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-medium md:table-cell"
              >
                Pendientes
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-medium md:table-cell"
              >
                Última actividad
              </th>
              <th scope="col" className="px-5 py-2 text-right font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((proposal) => (
              <tr
                key={proposal.id}
                className="border-b border-hairline last:border-0"
              >
                <td className="px-5 py-3 align-top">
                  <p className="text-sm font-medium text-ink">
                    {proposal.elementName}
                  </p>
                  <p className="text-sm tabular-nums text-ink-2">
                    {changeOf(proposal)}
                  </p>
                  <p className="text-xs text-ink-2 md:hidden">
                    {isActive(proposal.status) &&
                      `${proposal.progress.missing.length} pendientes · `}
                    <RelativeTime at={lastActivity(proposal)} />
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <ProposalStatusChip status={proposal.status} />
                </td>
                <td className="hidden px-3 py-3 align-top text-sm tabular-nums text-ink md:table-cell">
                  {isActive(proposal.status)
                    ? proposal.progress.missing.length
                    : '—'}
                </td>
                <td className="hidden px-3 py-3 align-top text-sm text-ink-2 md:table-cell">
                  <RelativeTime at={lastActivity(proposal)} />
                </td>
                <td className="px-5 py-2.5 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpen(proposal)}
                    >
                      Ver detalle
                    </Button>
                    <ActionMenu actions={menuFor(proposal)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

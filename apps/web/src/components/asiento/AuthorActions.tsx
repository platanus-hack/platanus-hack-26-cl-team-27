'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { ProposalStatusChip } from '@/components/common/status';
import { joinNames } from '@/lib/format';
import { describeError, type Auth } from '@/lib/http';
import {
  actionsFor,
  changeOf,
  disputersOf,
  reopenProposal,
  withdrawProposal,
  type ProposalView,
} from '@/lib/proposals-api';

export function AuthorActions({
  proposals,
  auth,
  onDone,
}: {
  readonly proposals: readonly ProposalView[];
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setConfirming(null);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline bg-surface">
      {proposals.map((proposal) => {
        const allowed = actionsFor(proposal.status);
        return (
          <article key={proposal.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">
                {proposal.elementName} · {changeOf(proposal)}
              </h3>
              <ProposalStatusChip status={proposal.status} />
            </div>
            {proposal.progress.missing.length > 0 && (
              <p className="text-sm text-ink-2">
                Falta {joinNames(proposal.progress.missing)}
              </p>
            )}
            {disputersOf(proposal).map((reviewer) => (
              <p key={reviewer.stakeholderId} className="text-sm text-ink">
                {reviewer.name}: «{reviewer.note ?? 'sin nota'}»
              </p>
            ))}
            {confirming === proposal.id ? (
              <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
                <p className="text-sm text-ink">
                  ¿Retirar la propuesta? Lo vigente no cambia.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(proposal.id, () =>
                        withdrawProposal(proposal.id, auth),
                      )
                    }
                  >
                    Sí, retirar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="h-11"
                  disabled={busy !== null || !allowed.reopen}
                  onClick={() =>
                    void run(proposal.id, () =>
                      reopenProposal(proposal.id, auth),
                    )
                  }
                >
                  Reabrir con la observación
                </Button>
                <Button
                  variant="danger"
                  className="h-11"
                  disabled={busy !== null || !allowed.withdraw}
                  onClick={() => setConfirming(proposal.id)}
                >
                  Retirar
                </Button>
              </div>
            )}
          </article>
        );
      })}
      {error && (
        <div className="p-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}

'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { describeError, type Auth } from '@/lib/http';
import {
  reopenProposal,
  STATUS_LABEL,
  withdrawProposal,
  type ProposalView,
} from '@/lib/proposals-api';
import { joinNames } from '@/lib/format';

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
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  if (proposals.length === 0)
    return <p className="text-sm text-ink-2">No hay propuestas abiertas.</p>;

  return (
    <div className="flex flex-col gap-3">
      {proposals.map((proposal) => {
        const disputers = proposal.reviewers.filter(
          (r) => r.decision === 'dispute',
        );
        return (
          <article
            key={proposal.id}
            className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3"
          >
            <h3 className="text-base font-semibold text-ink">
              {proposal.title}
            </h3>
            <p className="text-sm text-ink-2">
              {STATUS_LABEL[proposal.status]}
              {proposal.progress.missing.length > 0 &&
                ` · Falta ${joinNames(proposal.progress.missing)}`}
            </p>
            {disputers.map((reviewer) => (
              <p key={reviewer.stakeholderId} className="text-sm text-ink">
                {reviewer.name}: «{reviewer.note ?? 'Sin nota'}»
              </p>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-11"
                disabled={busy !== null || proposal.status !== 'disputed'}
                onClick={() =>
                  void run(`reopen-${proposal.id}`, () =>
                    reopenProposal(proposal.id, auth),
                  )
                }
              >
                Reabrir con la observación
              </Button>
              <Button
                variant="danger"
                className="h-11"
                disabled={busy !== null}
                onClick={() =>
                  void run(`withdraw-${proposal.id}`, () =>
                    withdrawProposal(proposal.id, auth),
                  )
                }
              >
                Retirar
              </Button>
            </div>
          </article>
        );
      })}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

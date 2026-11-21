'use client';

import { Button, Card, Field, Input, Notice } from '@team27/ui';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { StatusChip } from '@/components/common/StatusChip';
import { formatHourMinute } from '@/lib/case-view';
import {
  acceptProposal,
  postPresence,
  rejectProposal,
  type FlowProposal,
  type FlowState,
  type Viewing,
} from '@/lib/flow-api';
import { describeError, type Auth } from '@/lib/http';

import { CasePlan } from './CasePlan';

function ProposalCard({
  proposal,
  auth,
  onChanged,
}: {
  readonly proposal: FlowProposal;
  readonly auth: Auth;
  readonly onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const { texts } = proposal;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">{texts.title}</h2>
        <p className="text-base text-ink-2">{texts.why}</p>
        <div className="rounded-lg border border-good/40 bg-good/10 px-4 py-3">
          <p className="text-base font-medium text-ink">{texts.proposal}</p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {proposal.checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2 text-sm">
              <Icon
                name={check.ok ? 'check' : 'alert'}
                className={
                  check.ok ? 'mt-0.5 text-good' : 'mt-0.5 text-critical'
                }
              />
              <span className="text-ink">{check.label}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-sm text-ink">
          <Icon name="coins" className="mt-0.5 text-ink-3" />
          <span>{texts.cost}</span>
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {rejecting ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const text = reason.trim();
              if (text) void run(() => rejectProposal(proposal.id, text, auth));
            }}
          >
            <Field label="Cuéntanos cuál es el problema">
              <Input
                value={reason}
                autoFocus
                onChange={(event) => setReason(event.target.value)}
                placeholder="Por ejemplo: ahí pasa una viga que no está en el modelo"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !reason.trim()}>
                {busy ? 'Enviando…' : 'Enviar problema'}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setRejecting(false)}
              >
                Volver
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-12 flex-1 text-base"
              disabled={busy}
              onClick={() => void run(() => acceptProposal(proposal.id, auth))}
            >
              <Icon name="check" className="size-4" />
              {busy ? 'Aplicando…' : 'Aceptar propuesta'}
            </Button>
            <Button
              variant="secondary"
              className="h-12 flex-1 text-base"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              <Icon name="alert" className="size-4" />
              Tengo un problema
            </Button>
          </div>
        )}
        <p className="text-sm text-ink-2">{texts.footer}</p>
      </div>
    </Card>
  );
}

export function CamilaView({
  flow,
  auth,
  reportPresence,
  onChanged,
}: {
  readonly flow: FlowState;
  readonly auth: Auth;
  readonly reportPresence: boolean;
  readonly onChanged: () => void;
}) {
  const { proposal } = flow;
  const cardVisible = proposal?.status === 'propuesta';
  const viewing: Viewing = cardVisible ? 'propuesta' : 'plano';
  const token = auth.seatToken ?? null;

  useEffect(() => {
    if (!reportPresence || !token) return undefined;
    const send = () => {
      if (!document.hidden)
        postPresence(viewing, { seatToken: token }).catch(() => undefined);
    };
    send();
    document.addEventListener('visibilitychange', send);
    const timer = setInterval(send, 8000);
    return () => {
      document.removeEventListener('visibilitychange', send);
      clearInterval(timer);
    };
  }, [reportPresence, token, viewing]);

  const applied =
    proposal &&
    (proposal.status === 'aceptada' ||
      proposal.status === 'aplicada' ||
      proposal.status === 'resuelta');

  return (
    <div className="flex flex-col gap-4">
      <CasePlan flow={flow} />
      {!proposal && (
        <Card>
          <p className="flex items-center gap-2 text-base text-ink-2">
            <Icon name="check" className="text-good" />
            Nada que revisar por ahora. Cuando un cambio toque tu bandeja,
            Vigente te propone el arreglo aquí.
          </p>
        </Card>
      )}
      {proposal && cardVisible && (
        <ProposalCard proposal={proposal} auth={auth} onChanged={onChanged} />
      )}
      {applied && (
        <Card>
          <div className="flex flex-col gap-2">
            <StatusChip
              tone="good"
              icon="check"
              label={
                proposal.appliedText ??
                `Aplicado en tu plano a las ${formatHourMinute(proposal.decidedAt)}`
              }
              className="self-start text-sm"
            />
            <p className="text-base text-ink-2">{proposal.texts.title}</p>
          </div>
        </Card>
      )}
      {proposal?.status === 'rechazada' && (
        <Card>
          <div className="flex flex-col gap-2">
            <StatusChip
              tone="serious"
              icon="alert"
              label="Avisaste que tienes un problema"
              className="self-start text-sm"
            />
            <p className="text-base text-ink-2">
              {proposal.rejectReason ?? ''}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

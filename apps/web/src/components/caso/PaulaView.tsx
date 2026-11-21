'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useRef, useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { authorTimeline, sentText } from '@/lib/case-view';
import { buildMinute, postMinute, type FlowState } from '@/lib/flow-api';
import { ApiError, describeError, newActionId, type Auth } from '@/lib/http';

import { CasePlan } from './CasePlan';
import { Timeline } from './Timeline';

export function PaulaView({
  flow,
  auth,
  onChanged,
  onSeatLost,
}: {
  readonly flow: FlowState;
  readonly auth: Auth;
  readonly onChanged: () => void;
  readonly onSeatLost?: () => void;
}) {
  const minuteId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = flow.change !== null;
  const shownError = sent ? null : error;
  const sentLine = sentText(flow);

  if (!flow.change) minuteId.current = null;

  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    minuteId.current ??= newActionId();
    setBusy(true);
    setError(null);
    try {
      await postMinute(buildMinute(minuteId.current), auth);
      onChanged();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401 && onSeatLost) {
        onSeatLost();
        return;
      }
      setError(
        failure instanceof ApiError && failure.status === 409
          ? 'Ya hay un cambio abierto. Pídele a la presentadora que reinicie el caso.'
          : describeError(failure),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CasePlan flow={flow} showProposal={false} />
      <Card
        title="Tu cambio"
        description={`${flow.case.level}, ${flow.case.axis}. Pilar P-12 (40×60 cm, H30).`}
      >
        <div className="flex flex-col gap-4">
          <Button
            size="md"
            className="h-12 text-base"
            disabled={busy || sent}
            onClick={() => void send()}
          >
            <Icon name="arrow" className="size-4 -rotate-90" />
            {busy ? 'Enviando…' : 'Mover P-12 40 cm al norte'}
          </Button>
          {shownError && <Notice tone="error">{shownError}</Notice>}
          {flow.proposal?.status === 'resuelta' &&
            flow.proposal.resolvedText && (
              <div className="rounded-lg border border-good/40 bg-good/10 px-4 py-3">
                <p className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <Icon name="check" className="size-5 text-good" />
                  {flow.proposal.resolvedText}
                </p>
              </div>
            )}
          {sentLine && <Notice tone="success">{sentLine}</Notice>}
          <Timeline steps={authorTimeline(flow)} />
        </div>
      </Card>
    </div>
  );
}

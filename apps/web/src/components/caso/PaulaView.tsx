'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useState } from 'react';

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
}: {
  readonly flow: FlowState;
  readonly auth: Auth;
  readonly onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = flow.change !== null;
  const sentLine = sentText(flow);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await postMinute(buildMinute(newActionId()), auth);
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 409
          ? 'Ya hay un cambio abierto. Pídele a la presentadora que reinicie el caso.'
          : describeError(failure),
      );
    } finally {
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
          {error && <Notice tone="error">{error}</Notice>}
          {sentLine && <Notice tone="success">{sentLine}</Notice>}
          <Timeline steps={authorTimeline(flow)} />
        </div>
      </Card>
    </div>
  );
}

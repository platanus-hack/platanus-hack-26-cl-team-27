import type { ValueStatus } from '@/lib/baseline-api';
import type { DocumentState, ClaimOutcome } from '@/lib/spaces-api';

import type { IconName } from './Icon';
import { StateMark, type Tone } from './StateMark';

interface Look {
  readonly tone: Tone;
  readonly icon: IconName;
  readonly label: string;
}

export const VALUE_STATUS: Record<ValueStatus, Look> = {
  confirmed: { tone: 'good', icon: 'check', label: 'Confirmado' },
  proposed: { tone: 'warning', icon: 'hourglass', label: 'Propuesto' },
  disputed: { tone: 'critical', icon: 'alert', label: 'En disputa' },
};

export const DOCUMENT_STATE: Record<DocumentState, Look> = {
  current: { tone: 'good', icon: 'check', label: 'Al día' },
  stale: { tone: 'serious', icon: 'hourglass', label: 'Desfasado' },
  discrepancy: { tone: 'critical', icon: 'alert', label: 'Con discrepancia' },
  acknowledged: {
    tone: 'warning',
    icon: 'minus',
    label: 'Confirmado sin cambio',
  },
};

export const OUTCOME_LABEL: Record<ClaimOutcome, string> = {
  same: 'Igual a lo vigente',
  corroborates: 'Corrobora lo vigente',
  change: 'Propone un cambio',
  discrepancy: 'Abre una discrepancia',
  stale: 'Deja desfasado un documento',
  new: 'Valor nuevo',
};

export function ValueStatusMark({
  status,
  large,
}: {
  readonly status: ValueStatus;
  readonly large?: boolean;
}) {
  const look = VALUE_STATUS[status];
  return <StateMark {...look} large={large} />;
}

export function DocumentStateMark({
  state,
}: {
  readonly state: DocumentState;
}) {
  return <StateMark {...DOCUMENT_STATE[state]} />;
}

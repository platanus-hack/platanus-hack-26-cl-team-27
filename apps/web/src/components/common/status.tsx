import type { ValueStatus } from '@/lib/baseline-api';
import {
  STATUS_LABEL,
  toProposalStatus,
  type ProposalStatus,
} from '@/lib/proposals-api';
import type { ClaimOutcome, DocumentState } from '@/lib/spaces-api';

import type { IconName } from './Icon';
import { StateMark, type Tone } from './StateMark';
import { StatusChip } from './StatusChip';

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

const PROPOSAL_LOOK: Record<ProposalStatus, Omit<Look, 'label'>> = {
  open: { tone: 'warning', icon: 'hourglass' },
  disputed: { tone: 'critical', icon: 'alert' },
  merged: { tone: 'good', icon: 'check' },
  withdrawn: { tone: 'neutral', icon: 'minus' },
  replaced: { tone: 'neutral', icon: 'arrow' },
};

export const OUTCOME_LABEL: Record<ClaimOutcome, string> = {
  same: 'Igual a lo vigente',
  corroborates: 'Corrobora lo vigente',
  change: 'Propone un cambio',
  discrepancy: 'Abre una discrepancia',
  stale: 'Deja desfasado un documento',
  new: 'Valor nuevo',
};

export const OUTCOME_TONE: Record<ClaimOutcome, Tone> = {
  same: 'neutral',
  corroborates: 'good',
  change: 'warning',
  discrepancy: 'critical',
  stale: 'serious',
  new: 'neutral',
};

const isValueStatus = (status: string): status is ValueStatus =>
  status in VALUE_STATUS;

export function ValueStatusMark({
  status,
  large,
}: {
  readonly status: ValueStatus;
  readonly large?: boolean;
}) {
  return <StateMark {...VALUE_STATUS[status]} large={large} />;
}

export function ValueStatusChip({ status }: { readonly status: string }) {
  if (!isValueStatus(status)) return null;
  return <StatusChip {...VALUE_STATUS[status]} />;
}

export function DocumentStateChip({
  state,
}: {
  readonly state: DocumentState;
}) {
  return <StatusChip {...DOCUMENT_STATE[state]} />;
}

export function ProposalStatusChip({ status }: { readonly status: string }) {
  const known = toProposalStatus(status);
  if (!known) return <StatusChip tone="neutral" icon="dot" label={status} />;
  return <StatusChip {...PROPOSAL_LOOK[known]} label={STATUS_LABEL[known]} />;
}

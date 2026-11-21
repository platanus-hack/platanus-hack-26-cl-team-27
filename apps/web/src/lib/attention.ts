import type { InboxDiscrepancy, InboxItem } from './inbox-api';
import {
  disputersOf,
  lastActivity,
  type ProposalReviewer,
  type ProposalView,
} from './proposals-api';

export type AttentionItem =
  | {
      readonly kind: 'dispute';
      readonly id: string;
      readonly at: string;
      readonly proposal: ProposalView;
      readonly disputers: readonly ProposalReviewer[];
    }
  | {
      readonly kind: 'discrepancy';
      readonly id: string;
      readonly at: string;
      readonly discrepancy: InboxDiscrepancy;
    };

export const attentionItems = (
  inbox: readonly InboxItem[],
  proposals: readonly ProposalView[],
): AttentionItem[] => {
  const disputes = proposals
    .filter((proposal) => proposal.status === 'disputed')
    .map((proposal): AttentionItem => ({
      kind: 'dispute',
      id: proposal.id,
      at: lastActivity(proposal),
      proposal,
      disputers: disputersOf(proposal),
    }));
  const discrepancies = inbox
    .filter((item): item is InboxDiscrepancy => item.type === 'discrepancy')
    .map((discrepancy): AttentionItem => ({
      kind: 'discrepancy',
      id: discrepancy.id,
      at: discrepancy.at,
      discrepancy,
    }));
  const newestFirst = (a: AttentionItem, b: AttentionItem) =>
    b.at.localeCompare(a.at);
  return [...disputes.sort(newestFirst), ...discrepancies.sort(newestFirst)];
};

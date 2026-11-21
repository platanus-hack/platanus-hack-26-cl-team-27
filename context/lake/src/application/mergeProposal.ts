import type { Proposal } from '../domain/Proposal.ts';
import type { BaselineRepository } from './ports/BaselineRepository.ts';

export const mergeProposal = async (
  baseline: BaselineRepository,
  proposal: Proposal,
  at: Date,
): Promise<void> => {
  for (const change of proposal.changes) {
    const current = await baseline.find(change.subject, change.attribute);
    await baseline.upsert({
      subject: change.subject,
      attribute: change.attribute,
      value: change.after,
      unit: change.unit,
      claimId: change.claimId,
      revisionId: change.revisionId ?? proposal.sourceRevisionId,
      proposalId: proposal.id,
      since: at,
      version: (current?.version ?? 0) + 1,
    });
  }
};

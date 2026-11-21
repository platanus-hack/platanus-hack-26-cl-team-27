import type { Acknowledgement } from './Acknowledgement.ts';
import { hasAuthority } from './Authority.ts';
import type { AuthorityTable } from './Authority.ts';
import { baselineKey } from './Baseline.ts';
import type { BaselineEntry } from './Baseline.ts';
import type { Claim, ClaimRole, ClaimValue } from './Claim.ts';
import type { DocumentKind } from './DocumentKind.ts';
import { isActive } from './Proposal.ts';
import type { Proposal } from './Proposal.ts';
import { latestPerDocument } from './Revision.ts';
import type { Revision } from './Revision.ts';

export interface StaleItem {
  readonly claimId: string;
  readonly subject: string;
  readonly attribute: string;
  readonly role: ClaimRole;
  readonly unit: string | null;
  readonly locator: string;
  readonly usedValue: ClaimValue;
  readonly currentValue: ClaimValue;
}

export interface StaleDocument {
  readonly documentId: string;
  readonly documentName: string;
  readonly kind: DocumentKind;
  readonly revisionId: string;
  readonly label: string;
  readonly ownerId: string;
  readonly items: readonly StaleItem[];
  readonly signature: string;
  readonly acknowledgement: Acknowledgement | null;
}

export interface StalenessInput {
  readonly revisions: readonly Revision[];
  readonly claims: readonly Claim[];
  readonly baseline: readonly BaselineEntry[];
  readonly proposals: readonly Proposal[];
  readonly acknowledgements: readonly Acknowledgement[];
  readonly authority?: AuthorityTable;
}

export const staleSignature = (items: readonly StaleItem[]): string =>
  items
    .map(
      (item) =>
        `${item.subject}.${item.attribute}:${String(item.usedValue)}>${String(item.currentValue)}`,
    )
    .sort()
    .join('|');

export const computeStaleness = (input: StalenessInput): StaleDocument[] => {
  const entries = new Map(
    input.baseline.map((entry) => [
      baselineKey(entry.subject, entry.attribute),
      entry,
    ]),
  );
  const active = input.proposals.filter(isActive);
  const belongsToProposal = (claim: Claim): boolean =>
    active.some(
      (proposal) =>
        proposal.subject === claim.subject &&
        proposal.changes.some(
          (change) =>
            change.attribute === claim.attribute &&
            change.after === claim.value,
        ),
    );

  const result: StaleDocument[] = [];
  for (const revision of latestPerDocument(input.revisions)) {
    const items: StaleItem[] = [];
    for (const claim of input.claims) {
      if (claim.revisionId !== revision.id) continue;
      const entry = entries.get(baselineKey(claim.subject, claim.attribute));
      if (!entry || claim.value === entry.value) continue;
      const counts =
        claim.role === 'usa' ||
        hasAuthority(revision.kind, claim.attribute, input.authority);
      if (!counts || belongsToProposal(claim)) continue;
      items.push({
        claimId: claim.id,
        subject: claim.subject,
        attribute: claim.attribute,
        role: claim.role,
        unit: claim.unit,
        locator: claim.locator,
        usedValue: claim.value,
        currentValue: entry.value,
      });
    }
    if (items.length === 0) continue;
    const signature = staleSignature(items);
    result.push({
      documentId: revision.documentId,
      documentName: revision.documentName,
      kind: revision.kind,
      revisionId: revision.id,
      label: revision.label,
      ownerId: revision.authorId,
      items,
      signature,
      acknowledgement:
        input.acknowledgements.find(
          (ack) =>
            ack.revisionId === revision.id && ack.signature === signature,
        ) ?? null,
    });
  }
  return result;
};

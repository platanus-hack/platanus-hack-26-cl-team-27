import type { FakeLake } from './fakeLake.ts';
import { fakeLake } from './fakeLake.ts';
import { AcknowledgeStale } from '../src/application/use-cases/AcknowledgeStale.ts';
import { GetConsensus } from '../src/application/use-cases/GetConsensus.ts';
import { IngestRevision } from '../src/application/use-cases/IngestRevision.ts';
import { ListStale } from '../src/application/use-cases/ListStale.ts';
import { OpenProposal } from '../src/application/use-cases/OpenProposal.ts';
import { RecordReview } from '../src/application/use-cases/RecordReview.ts';
import { SeedLake } from '../src/application/use-cases/SeedLake.ts';
import type { ClaimDraft } from '../src/domain/Claim.ts';
import type { DocumentKind } from '../src/domain/DocumentKind.ts';
import type { RevisionDraft } from '../src/domain/Revision.ts';

export const afirma = (
  subject: string,
  attribute: string,
  value: ClaimDraft['value'],
): ClaimDraft => ({
  subject,
  attribute,
  value,
  unit: null,
  role: 'afirma',
  locator: `${subject}.${attribute}`,
});

export const usa = (
  subject: string,
  attribute: string,
  value: ClaimDraft['value'],
): ClaimDraft => ({ ...afirma(subject, attribute, value), role: 'usa' });

export const draftOf = (
  documentId: string,
  label: string,
  kind: DocumentKind,
  authorId = 'fernanda',
): RevisionDraft => ({
  documentId,
  documentName: documentId,
  label,
  kind,
  spaceId: 'drive',
  authorId,
  contentHash: `${documentId}${label}`,
  sourcePointer: `Drive/${documentId}/${label}`,
});

export const buildLake = (catalog: Record<string, ClaimDraft[]> = {}) => {
  const lake: FakeLake = fakeLake(catalog);
  return {
    lake,
    seed: new SeedLake(
      lake.revisions,
      lake.claims,
      lake.baseline,
      lake.proposals,
      lake.discrepancies,
      lake.acknowledgements,
    ),
    ingest: new IngestRevision(
      lake.revisions,
      lake.claims,
      lake.baseline,
      lake.proposals,
      lake.discrepancies,
      lake.extractor,
    ),
    open: new OpenProposal(lake.proposals, lake.baseline),
    review: new RecordReview(lake.proposals, lake.baseline),
    stale: new ListStale(
      lake.revisions,
      lake.claims,
      lake.baseline,
      lake.proposals,
      lake.acknowledgements,
    ),
    acknowledge: new AcknowledgeStale(
      lake.revisions,
      lake.claims,
      lake.baseline,
      lake.proposals,
      lake.acknowledgements,
    ),
    consensus: new GetConsensus(
      lake.revisions,
      lake.claims,
      lake.baseline,
      lake.proposals,
      lake.discrepancies,
      lake.acknowledgements,
    ),
  };
};

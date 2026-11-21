import type { BaselineEntry } from '../src/domain/Baseline.ts';
import type { Claim } from '../src/domain/Claim.ts';
import type { Discrepancy } from '../src/domain/Discrepancy.ts';
import type { DocumentKind } from '../src/domain/DocumentKind.ts';
import type { Overlap } from '../src/domain/Overlap.ts';
import type {
  Proposal,
  ProposalChange,
  Review,
} from '../src/domain/Proposal.ts';
import type { Revision } from '../src/domain/Revision.ts';

export const at = (minute: number): Date =>
  new Date(Date.UTC(2026, 10, 21, 12, minute));

export const revision = (
  id: string,
  overrides: Partial<Revision> = {},
): Revision => ({
  id,
  documentId: id,
  documentName: id,
  label: 'rev A',
  kind: 'plano' satisfies DocumentKind,
  spaceId: 'drive',
  authorId: 'fernanda',
  contentHash: id,
  sourcePointer: `Drive/${id}`,
  ingestOrder: 1,
  ingestedAt: at(0),
  ...overrides,
});

export const claim = (
  id: string,
  revisionId: string,
  subject: string,
  attribute: string,
  value: Claim['value'],
  role: Claim['role'] = 'afirma',
): Claim => ({
  id,
  revisionId,
  subject,
  attribute,
  value,
  unit: null,
  role,
  locator: `loc-${id}`,
  chunkId: null,
  confidence: null,
});

export const entry = (
  subject: string,
  attribute: string,
  value: BaselineEntry['value'],
  overrides: Partial<BaselineEntry> = {},
): BaselineEntry => ({
  subject,
  attribute,
  value,
  unit: null,
  claimId: null,
  revisionId: 'r-base',
  proposalId: null,
  since: at(0),
  version: 1,
  ...overrides,
});

export const review = (
  reviewerId: string,
  decision: Review['decision'] = null,
): Review => ({
  reviewerId,
  decision,
  note: decision === 'dispute' ? 'problema' : null,
  at: decision ? at(5) : null,
});

export const hunk = (
  subject: string,
  attribute: string,
  before: ProposalChange['before'],
  after: ProposalChange['after'],
  unit: string | null = null,
): ProposalChange => ({
  subject,
  attribute,
  unit,
  before,
  after,
  claimId: null,
  locator: `${subject}.${attribute}`,
});

export const proposal = (
  id: string,
  overrides: Partial<Proposal> = {},
): Proposal => ({
  id,
  changeId: null,
  changeIds: [],
  documentId: 'e102',
  sourceRevisionId: 'r-new',
  authorId: 'fernanda',
  changes: [hunk('losa-n3', 'espesor_cm', 15, 20, 'cm')],
  context: [],
  status: 'open',
  reviews: [review('paula'), review('javier')],
  filtered: [],
  openedAt: at(1),
  resolvedAt: null,
  supersededById: null,
  ...overrides,
});

export const discrepancy = (
  id: string,
  overrides: Partial<Discrepancy> = {},
): Discrepancy => ({
  id,
  subject: 'ventanas-norte',
  attribute: 'ancho_cm',
  value: 150,
  baselineValue: 120,
  unit: 'cm',
  documentId: 'wa',
  revisionId: 'r-wa',
  claimId: null,
  ownerId: 'fernanda',
  status: 'open',
  backedByRevisionId: null,
  note: null,
  createdAt: at(2),
  resolvedAt: null,
  ...overrides,
});

export const overlapOf = (
  id: string,
  overrides: Partial<Overlap> = {},
): Overlap => ({
  id,
  proposalId: 'p1',
  otherProposalId: null,
  revisionId: 'r-new',
  chunkLocator: 'cota',
  kind: 'misma-area',
  area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
  relation: 'cruce_trazado',
  subjectId: 'shaft-s1',
  otherSubjectId: 'colector-b2',
  otherBacking: { documentId: 'is301', label: 'rev A', ownerId: 'javier' },
  validators: ['fernanda', 'javier'],
  status: 'abierto',
  votes: [],
  resolution: null,
  createdAt: at(1),
  resolvedAt: null,
  ...overrides,
});

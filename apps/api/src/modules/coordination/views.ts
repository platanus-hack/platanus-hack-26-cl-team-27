import type { Impact } from '@team27/context-impact';
import { quantityOf } from '@team27/context-impact';
import type {
  BaselineEntry,
  Change,
  Chunk,
  Claim,
  ClaimValue,
  Consensus,
  Discrepancy,
  Overlap,
  Proposal,
  Provenance,
  Revision,
  StaleDocument,
} from '@team27/context-lake';
import {
  activeFor,
  baselineValues,
  finalValues,
  formatValue,
  isActive,
  isLiveOverlap,
  sameFootprint,
  subjectsOf,
  valueStatus,
} from '@team27/context-lake';
import type { Notification } from '@team27/context-notification';

import {
  ALL_CELLS,
  areaLabel,
  footprintModel,
  LEVELS,
  levelLabel,
  LONGITUDINAL_AXES,
  SPANS,
  SYSTEMS,
  TRANSVERSAL_AXES,
  spatialKindOf,
} from '../../scenario/areas.ts';
import {
  attributeLabel,
  DOCUMENTS,
  type SectionId,
  SPACES,
  SUBJECTS,
  subjectName,
} from '../../scenario/documents.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import {
  castMember,
  castName,
  documentDef,
  factLabel,
  revisionTitle,
  spaceName,
  spaceOf,
} from './lookup.ts';

export interface LakeSnapshot {
  readonly revisions: readonly Revision[];
  readonly claims: readonly Claim[];
  readonly baseline: readonly BaselineEntry[];
  readonly proposals: readonly Proposal[];
  readonly discrepancies: readonly Discrepancy[];
  readonly overlaps: readonly Overlap[];
  readonly chunks: readonly Chunk[];
  readonly consensus: Consensus;
  readonly impacts: ReadonlyMap<string, Impact>;
  readonly notifications: readonly Notification[];
}

export interface StaleRef {
  readonly revisionId: string;
  readonly subjectId: string;
  readonly attribute: string;
}

const BASE_COST = Math.round(
  LOS_AROMOS.graph.budgetItems.reduce(
    (total, item) =>
      total +
      LOS_AROMOS.model
        .filter((element) => element.category === item.category)
        .reduce((sum, element) => {
          const properties = Object.fromEntries(
            element.properties.map((property) => [
              property.key,
              property.value,
            ]),
          );
          return (
            sum +
            quantityOf(item.category, item.quantity, properties) *
              item.factor *
              item.unitPrice
          );
        }, 0),
    0,
  ),
);

const sectionOf = (subject: string): SectionId =>
  SUBJECTS.find((candidate) => candidate.id === subject)?.section ?? 'costos';

export const printable = (value: ClaimValue): number | string =>
  typeof value === 'boolean' ? String(value) : value;

export const proposalTitle = (proposal: Pick<Proposal, 'changes'>) => {
  const bySubject = new Map<string, Proposal['changes'][number][]>();
  for (const change of proposal.changes) {
    bySubject.set(change.subject, [
      ...(bySubject.get(change.subject) ?? []),
      change,
    ]);
  }
  return [...bySubject.entries()]
    .map(
      ([subject, changes]) =>
        `${subjectName(subject)} · ${changes
          .map(
            (change) =>
              `${attributeLabel(change.attribute)}: ${formatValue(printable(change.before), change.unit)} → ${formatValue(printable(change.after), change.unit)}`,
          )
          .join(' · ')}`,
    )
    .join(' + ');
};

const backingTitle = (backing: Overlap['otherBacking']): string =>
  `${documentDef(backing.documentId)?.name ?? backing.documentId} ${backing.label}`;

export const overlapTitle = (
  overlap: Overlap,
  revisions: readonly Revision[],
): string => {
  const revision = revisions.find((item) => item.id === overlap.revisionId);
  const incoming = revision ? revisionTitle(revision) : overlap.revisionId;
  if (overlap.area === null) {
    return `${subjectName(overlap.subjectId)}: ${incoming} y ${backingTitle(overlap.otherBacking)} cambian datos distintos del mismo elemento`;
  }
  return `${subjectName(overlap.subjectId)} (${incoming}) y ${subjectName(overlap.otherSubjectId)} (${backingTitle(overlap.otherBacking)}) · ${areaLabel(overlap.area)}`;
};

export const mergedProposals = (snapshot: LakeSnapshot): Proposal[] =>
  snapshot.proposals.filter((proposal) => proposal.status === 'merged');

export const projectVersion = (snapshot: LakeSnapshot): number =>
  1 + mergedProposals(snapshot).length;

const impactsOf = (snapshot: LakeSnapshot, proposal: Proposal): Impact[] =>
  proposal.changeIds.flatMap((id) => {
    const impact = snapshot.impacts.get(id);
    return impact ? [impact] : [];
  });

const sumOf = (impacts: readonly Impact[]) => ({
  costDelta: impacts.reduce((sum, impact) => sum + impact.costDelta, 0),
  delayDays: impacts.reduce((sum, impact) => sum + impact.delayDays, 0),
});

export const totalsOf = (snapshot: LakeSnapshot) => {
  const impacts = mergedProposals(snapshot).flatMap((proposal) =>
    impactsOf(snapshot, proposal),
  );
  const costDelta = impacts.reduce((sum, impact) => sum + impact.costDelta, 0);
  const delayDays = impacts.reduce((sum, impact) => sum + impact.delayDays, 0);
  const baseDays = Number(
    snapshot.baseline.find(
      (entry) =>
        entry.subject === 'proyecto' && entry.attribute === 'entrega_dias',
    )?.value ?? 0,
  );
  return {
    costTotal: BASE_COST + costDelta,
    costDelta,
    projectDays: baseDays + delayDays,
    delayDays,
  };
};

export const staleRefs = (stale: readonly StaleDocument[]): StaleRef[] =>
  stale
    .filter((document) => document.acknowledgement === null)
    .flatMap((document) =>
      document.items.map((item) => ({
        revisionId: document.revisionId,
        subjectId: item.subject,
        attribute: item.attribute,
      })),
    );

const reviewerInfo = (stakeholderId: string) => {
  const member = castMember(stakeholderId);
  return {
    name: member?.name ?? stakeholderId,
    role: member?.role ?? '',
    channel: member?.channel ?? 'email',
  };
};

export const progressOf = (proposal: Proposal) => {
  const approved = proposal.reviews.filter(
    (review) => review.decision === 'approve',
  ).length;
  return {
    id: proposal.id,
    status: proposal.status === 'superseded' ? 'replaced' : proposal.status,
    approved,
    required: proposal.reviews.length,
    missing: proposal.reviews
      .filter((review) => review.decision !== 'approve')
      .map((review) => castName(review.reviewerId)),
  };
};

export const WAITING_FOR_OVERLAP = 'Espera la validación del solapamiento';

const overlapsOfProposal = (
  snapshot: LakeSnapshot,
  proposalId: string,
): Overlap[] =>
  snapshot.overlaps.filter(
    (overlap) =>
      overlap.proposalId === proposalId ||
      overlap.otherProposalId === proposalId,
  );

export const blockedByOverlap = (
  snapshot: LakeSnapshot,
  proposal: Proposal,
): boolean =>
  isActive(proposal) &&
  overlapsOfProposal(snapshot, proposal.id).some(isLiveOverlap);

export const overlapView = (snapshot: LakeSnapshot, overlap: Overlap) => {
  const revision = snapshot.revisions.find(
    (item) => item.id === overlap.revisionId,
  );
  return {
    id: overlap.id,
    kind: overlap.kind,
    status: overlap.status,
    relation: overlap.relation,
    title: overlapTitle(overlap, snapshot.revisions),
    area: overlap.area
      ? {
          nivel: overlap.area.nivel,
          nivelLabel: levelLabel(overlap.area.nivel),
          celda: overlap.area.celda,
          sistemas: [...overlap.area.sistemas],
          label: areaLabel(overlap.area),
        }
      : null,
    subjectId: overlap.subjectId,
    subjectName: subjectName(overlap.subjectId),
    otherSubjectId: overlap.otherSubjectId,
    otherSubjectName: subjectName(overlap.otherSubjectId),
    chunkLocator: overlap.chunkLocator,
    revisionId: overlap.revisionId,
    revisionTitle: revision ? revisionTitle(revision) : overlap.revisionId,
    otherBacking: {
      documentId: overlap.otherBacking.documentId,
      label: overlap.otherBacking.label,
      title: backingTitle(overlap.otherBacking),
      ownerId: overlap.otherBacking.ownerId,
      ownerName: castName(overlap.otherBacking.ownerId),
    },
    proposalId: overlap.proposalId,
    otherProposalId: overlap.otherProposalId,
    validators: [...overlap.validators],
    validatorsInfo: overlap.validators.map((id) => ({
      id,
      name: castName(id),
      role: castMember(id)?.role ?? '',
    })),
    votes: overlap.votes.map((vote) => ({
      validatorId: vote.validatorId,
      validatorName: castName(vote.validatorId),
      kind: vote.kind,
      note: vote.note,
      at: vote.at,
    })),
    resolution: overlap.resolution,
    createdAt: overlap.createdAt,
    resolvedAt: overlap.resolvedAt,
  };
};

export type OverlapView = ReturnType<typeof overlapView>;

const hunksOf = (proposal: Proposal) => [
  ...proposal.changes.map((change) => ({
    subjectId: change.subject,
    subjectName: subjectName(change.subject),
    attribute: change.attribute,
    label: attributeLabel(change.attribute),
    unit: change.unit,
    before: change.before,
    after: change.after,
    locator: change.locator ?? '',
    changed: true,
  })),
  ...proposal.context.map((item) => ({
    subjectId: item.subject,
    subjectName: subjectName(item.subject),
    attribute: item.attribute,
    label: attributeLabel(item.attribute),
    unit: item.unit,
    before: item.value,
    after: item.value,
    locator: item.locator ?? '',
    changed: false,
  })),
];

export const proposalView = (snapshot: LakeSnapshot, proposal: Proposal) => {
  const impacts = impactsOf(snapshot, proposal);
  const { costDelta, delayDays } = sumOf(impacts);
  const notifications = snapshot.notifications.filter(
    (notification) => notification.changeId === proposal.changeId,
  );
  const backing = snapshot.discrepancies.filter(
    (discrepancy) =>
      discrepancy.status === 'backed' &&
      discrepancy.backedByRevisionId === proposal.sourceRevisionId &&
      proposal.changes.some(
        (change) =>
          change.subject === discrepancy.subject &&
          change.attribute === discrepancy.attribute,
      ),
  );
  const progress = progressOf(proposal);
  const source = snapshot.revisions.find(
    (revision) => revision.id === proposal.sourceRevisionId,
  );
  const overlaps = overlapsOfProposal(snapshot, proposal.id);
  const live = isActive(proposal) ? overlaps.filter(isLiveOverlap) : [];
  const subjects = subjectsOf(proposal);
  const first = proposal.changes[0];
  const hunks = hunksOf(proposal);
  return {
    id: proposal.id,
    changeId: proposal.changeId,
    changeIds: [...proposal.changeIds],
    title: proposalTitle(proposal),
    status: progress.status,
    documentId: proposal.documentId,
    label: source?.label ?? '',
    revision: source
      ? {
          id: source.id,
          title: revisionTitle(source),
          documentId: source.documentId,
          label: source.label,
          pointer: source.sourcePointer,
          spaceName: spaceName(source.spaceId),
        }
      : null,
    elementName:
      subjects.length === 1
        ? subjectName(subjects[0] ?? '')
        : subjects.map(subjectName).join(' y '),
    subjectId: first?.subject ?? '',
    subjectIds: subjects,
    attribute: first?.attribute ?? '',
    diffs: proposal.changes.map((change) => ({
      subjectId: change.subject,
      subjectName: subjectName(change.subject),
      attribute: change.attribute,
      label: attributeLabel(change.attribute),
      unit: change.unit,
      before: change.before,
      after: change.after,
    })),
    hunks,
    unchangedHunks: proposal.context.length,
    costDelta,
    delayDays,
    authorId: proposal.authorId,
    authorName: castName(proposal.authorId),
    sourceRevisionId: proposal.sourceRevisionId,
    openedAt: proposal.openedAt,
    mergedAt: proposal.status === 'merged' ? proposal.resolvedAt : null,
    reviewers: proposal.reviews.map((review) => ({
      stakeholderId: review.reviewerId,
      ...reviewerInfo(review.reviewerId),
      notificationId:
        notifications.find(
          (notification) => notification.stakeholderId === review.reviewerId,
        )?.id ?? null,
      decision: review.decision,
      note: review.note,
      at: review.at,
    })),
    filtered: proposal.filtered.map((filtered) => ({
      stakeholderId: filtered.id,
      name: castName(filtered.id),
      reason: filtered.reason,
    })),
    progress: {
      approved: progress.approved,
      required: progress.required,
      missing: progress.missing,
    },
    checks: {
      cost: { costDelta },
      schedule: { delayDays },
      overlaps: {
        total: overlaps.length,
        open: overlaps.filter((item) => item.status === 'abierto').length,
        confirmed: overlaps.filter((item) => item.status === 'confirmado')
          .length,
        resolved: overlaps.filter((item) => item.status === 'resuelto').length,
        discarded: overlaps.filter((item) => item.status === 'descartado')
          .length,
      },
    },
    overlaps: overlaps.map((item) => overlapView(snapshot, item)),
    blockedByOverlap: live.length > 0,
    waitingFor: live.length > 0 ? WAITING_FOR_OVERLAP : null,
    backedBy: backing.map((discrepancy) => {
      const revision = snapshot.revisions.find(
        (candidate) => candidate.id === discrepancy.revisionId,
      );
      return revision
        ? `${revisionTitle(revision)} · ${spaceName(revision.spaceId)}`
        : discrepancy.documentId;
    }),
  };
};

export type ProposalView = ReturnType<typeof proposalView>;

export const voteProposal = (proposal: Proposal) => {
  const progress = progressOf(proposal);
  return {
    id: progress.id,
    status: progress.status,
    approved: progress.approved,
    required: progress.required,
    missing: progress.missing,
  };
};

export const baselineResponse = (
  snapshot: LakeSnapshot,
  section: SectionId | undefined,
) => {
  const active = snapshot.proposals.filter(isActive);
  const staleBySubject = (subject: string, attribute: string): number =>
    snapshot.consensus.stale.filter(
      (document) =>
        document.acknowledgement === null &&
        document.items.some(
          (item) => item.subject === subject && item.attribute === attribute,
        ),
    ).length;
  const entries = snapshot.baseline
    .filter((entry) => !section || sectionOf(entry.subject) === section)
    .map((entry) => {
      const status = valueStatus(entry, snapshot.proposals);
      const proposal = active.find((candidate) =>
        candidate.changes.some(
          (change) =>
            change.subject === entry.subject &&
            change.attribute === entry.attribute,
        ),
      );
      const change = proposal?.changes.find(
        (candidate) =>
          candidate.subject === entry.subject &&
          candidate.attribute === entry.attribute,
      );
      const current = new Set(latestRevisionIds(snapshot.revisions));
      const sources = snapshot.claims.filter(
        (claim) =>
          claim.role === 'afirma' &&
          claim.subject === entry.subject &&
          claim.attribute === entry.attribute &&
          claim.value === entry.value &&
          current.has(claim.revisionId),
      ).length;
      return {
        section: sectionOf(entry.subject),
        subjectId: entry.subject,
        subjectName: subjectName(entry.subject),
        attribute: entry.attribute,
        label: attributeLabel(entry.attribute),
        value: entry.value,
        unit: entry.unit,
        status,
        proposedValue: change?.after ?? null,
        proposalId: proposal?.id ?? null,
        sources,
        staleCount: staleBySubject(entry.subject, entry.attribute),
        version: entry.version,
        since: entry.since,
      };
    })
    .sort(
      (a, b) =>
        subjectIndex(a.subjectId) - subjectIndex(b.subjectId) ||
        a.attribute.localeCompare(b.attribute),
    );
  return {
    version: projectVersion(snapshot),
    totals: totalsOf(snapshot),
    entries,
  };
};

const subjectIndex = (id: string): number =>
  SUBJECTS.findIndex((subject) => subject.id === id);

const latestRevisionIds = (revisions: readonly Revision[]): string[] => {
  const latest = new Map<string, Revision>();
  for (const revision of revisions) {
    const known = latest.get(revision.documentId);
    if (!known || revision.ingestOrder > known.ingestOrder) {
      latest.set(revision.documentId, revision);
    }
  }
  return [...latest.values()].map((revision) => revision.id);
};

export const provenanceResponse = (
  snapshot: LakeSnapshot,
  provenance: Provenance,
) => {
  const proposalById = new Map(
    snapshot.proposals.map((proposal) => [proposal.id, proposal]),
  );
  const reviewsOf = (proposal: Proposal | null) =>
    (proposal?.reviews ?? []).map((review) => ({
      stakeholderId: review.reviewerId,
      name: castName(review.reviewerId),
      decision: review.decision,
      note: review.note,
      at: review.at,
    }));
  const proposalRef = (proposal: Proposal | null) =>
    proposal
      ? {
          id: proposal.id,
          status: proposal.status,
          at: proposal.resolvedAt ?? proposal.openedAt,
        }
      : null;
  const step = (input: {
    value: ClaimValue;
    unit: string | null;
    current: boolean;
    claim: Claim | null;
    revision: Revision | null;
    proposal: Proposal | null;
    backedBy: ReturnType<typeof backedBy>;
  }) =>
    input.revision
      ? [
          {
            value: input.value,
            unit: input.unit,
            current: input.current,
            claim: {
              role: input.claim?.role ?? 'afirma',
              locator: input.claim?.locator ?? '',
            },
            revision: {
              id: input.revision.id,
              title: revisionTitle(input.revision),
              label: input.revision.label,
              pointer: input.revision.sourcePointer,
              capturedAt: input.revision.ingestedAt,
            },
            space: {
              id: input.revision.spaceId,
              name: spaceName(input.revision.spaceId),
            },
            author: {
              id: input.revision.authorId,
              name: castName(input.revision.authorId),
            },
            proposal: proposalRef(input.proposal),
            reviews: reviewsOf(input.proposal),
            backedBy: input.backedBy,
          },
        ]
      : [];
  const backedBy = () =>
    provenance.backedDiscrepancies.map(({ discrepancy, revision }) => ({
      revisionTitle: revision
        ? revisionTitle(revision)
        : discrepancy.documentId,
      spaceName: revision ? spaceName(revision.spaceId) : '',
      authorName: revision ? castName(revision.authorId) : '',
      weakValue: discrepancy.value,
    }));
  const primaryClaimId = provenance.claim?.id ?? null;
  return {
    subjectId: provenance.subject,
    attribute: provenance.attribute,
    label: factLabel(provenance.subject, provenance.attribute),
    current: {
      value: provenance.value,
      unit: provenance.unit,
      status: provenance.status,
    },
    chain: [
      ...step({
        value: provenance.value,
        unit: provenance.unit,
        current: true,
        claim: provenance.claim,
        revision: provenance.revision,
        proposal: provenance.proposal,
        backedBy: backedBy(),
      }),
      ...provenance.previous.flatMap((previous) =>
        step({
          value: previous.value,
          unit: previous.unit,
          current: false,
          claim: previous.claim,
          revision: previous.revision,
          proposal: previous.proposalId
            ? (proposalById.get(previous.proposalId) ?? null)
            : null,
          backedBy: [],
        }),
      ),
    ],
    corroborations: provenance.sources
      .filter((source) => source.claim.id !== primaryClaimId)
      .flatMap((source) =>
        source.revision
          ? [
              {
                revisionTitle: revisionTitle(source.revision),
                label: source.revision.label,
                spaceName: spaceName(source.revision.spaceId),
                role: source.claim.role,
              },
            ]
          : [],
      ),
  };
};

const claimOutcome = (
  snapshot: LakeSnapshot,
  claim: Claim,
): 'same' | 'corroborates' | 'change' | 'discrepancy' | 'stale' | 'new' => {
  if (
    snapshot.discrepancies.some(
      (discrepancy) => discrepancy.claimId === claim.id,
    )
  ) {
    return 'discrepancy';
  }
  if (
    snapshot.proposals.some((proposal) =>
      proposal.changes.some((change) => change.claimId === claim.id),
    )
  ) {
    return 'change';
  }
  const entry = snapshot.baseline.find(
    (candidate) =>
      candidate.subject === claim.subject &&
      candidate.attribute === claim.attribute,
  );
  if (!entry) return 'new';
  if (entry.value === claim.value) return 'same';
  return claim.role === 'usa' ? 'stale' : 'corroborates';
};

export const spacesResponse = (snapshot: LakeSnapshot) => {
  const staleByDocument = new Map(
    snapshot.consensus.stale.map((document) => [document.documentId, document]),
  );
  const discrepancyDocuments = new Set(
    snapshot.discrepancies
      .filter((discrepancy) => discrepancy.status === 'open')
      .map((discrepancy) => discrepancy.documentId),
  );
  const current = new Set(latestRevisionIds(snapshot.revisions));
  return {
    spaces: SPACES.map((space) => ({
      id: space.id,
      name: space.name,
      kind: space.kind,
      ownerId: space.ownerId,
      ownerName: castName(space.ownerId),
      documents: DOCUMENTS.filter(
        (document) => document.spaceId === space.id,
      ).map((document) => {
        const stale = staleByDocument.get(document.id);
        const state = stale
          ? stale.acknowledgement
            ? 'acknowledged'
            : 'stale'
          : discrepancyDocuments.has(document.id)
            ? 'discrepancy'
            : 'current';
        return {
          id: document.id,
          title: document.name,
          kind: document.kind,
          state,
          ownerId: document.ownerId,
          ownerName: castName(document.ownerId),
          staleFacts: (stale?.items ?? []).map((item) => ({
            subjectId: item.subject,
            attribute: item.attribute,
            label: factLabel(item.subject, item.attribute),
            usedValue: item.usedValue,
            currentValue: item.currentValue,
            unit: item.unit,
          })),
          acknowledgedNote: stale?.acknowledgement?.note ?? null,
          revisions: snapshot.revisions
            .filter((revision) => revision.documentId === document.id)
            .sort((a, b) => a.ingestOrder - b.ingestOrder)
            .map((revision) => ({
              id: revision.id,
              label: revision.label,
              title: revisionTitle(revision),
              pointer: revision.sourcePointer,
              author: {
                id: revision.authorId,
                name: castName(revision.authorId),
              },
              capturedAt: revision.ingestedAt,
              current: current.has(revision.id),
              chunks: snapshot.chunks
                .filter((chunk) => chunk.revisionId === revision.id)
                .map((chunk) => ({
                  locator: chunk.locator,
                  kind: chunk.kind,
                  text: chunk.text,
                  rejected: chunk.rejected.map((item) => ({
                    subjectId: item.subject,
                    attribute: item.attribute,
                    label: factLabel(item.subject, item.attribute),
                    value: item.value,
                    unit: item.unit,
                    role: item.role,
                    confidence: item.confidence,
                    reason: item.reason,
                  })),
                })),
              claims: snapshot.claims
                .filter((claim) => claim.revisionId === revision.id)
                .map((claim) => ({
                  confidence: claim.confidence,
                  subjectId: claim.subject,
                  attribute: claim.attribute,
                  label: factLabel(claim.subject, claim.attribute),
                  value: claim.value,
                  unit: claim.unit,
                  role: claim.role,
                  locator: claim.locator,
                  outcome: claimOutcome(snapshot, claim),
                })),
            })),
        };
      }),
    })),
  };
};

export const sealOf = (snapshot: LakeSnapshot) => {
  if (!snapshot.consensus.index.sealed) return null;
  const merged = mergedProposals(snapshot);
  const lastAt = merged
    .map((proposal) => proposal.resolvedAt)
    .filter((at): at is Date => at !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    version: projectVersion(snapshot),
    sealedAt: lastAt ?? null,
    lines: merged.map((proposal) => {
      const approvals = proposal.reviews.filter(
        (review) => review.decision === 'approve',
      ).length;
      return `${castName(proposal.authorId)} propuso ${proposalTitle(proposal)} y lo aprobaron ${approvals} de ${proposal.reviews.length}.`;
    }),
  };
};

export interface RoomExtras {
  readonly epoch: number;
  readonly cursor: number;
  readonly present: ReadonlySet<string>;
}

const CHANNEL_PREVIEW = {
  email: 'Recibes los avisos en tu correo.',
  whatsapp: 'Recibes los avisos en tu chat.',
  slack: 'Recibes los avisos en tu canal de equipo.',
} as const;

const previewOf = (member: (typeof LOS_AROMOS.cast)[number]): string =>
  member.id === LOS_AROMOS.author.id
    ? 'Presentas la muestra y firmas los cambios del proyecto.'
    : `${member.role}. ${CHANNEL_PREVIEW[member.channel]}`;

export const occupantOf = (
  castId: string,
  present: ReadonlySet<string>,
): 'human' | 'bot' | 'presenter' =>
  castId === LOS_AROMOS.author.id
    ? 'presenter'
    : present.has(castId)
      ? 'human'
      : 'bot';

export const castView = (
  member: (typeof LOS_AROMOS.cast)[number],
  present: ReadonlySet<string>,
) => {
  const occupant = occupantOf(member.id, present);
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    channel: member.id === LOS_AROMOS.author.id ? null : member.channel,
    handle: member.id === LOS_AROMOS.author.id ? null : member.handle,
    presenter: member.id === LOS_AROMOS.author.id,
    preview: previewOf(member),
    occupant,
    occupied: occupant === 'human',
    present: occupant === 'human',
    bot: occupant === 'bot',
  };
};

export const roomResponse = (snapshot: LakeSnapshot, extras: RoomExtras) => {
  const { index } = snapshot.consensus;
  return {
    epoch: extras.epoch,
    cursor: extras.cursor,
    lake: { empty: snapshot.revisions.length === 0 },
    projectVersion: projectVersion(snapshot),
    project: LOS_AROMOS.project,
    totals: totalsOf(snapshot),
    consensus: index,
    cast: LOS_AROMOS.cast.map((member) => castView(member, extras.present)),
    spaces: SPACES.map((space) => ({
      id: space.id,
      name: space.name,
      kind: space.kind,
      ownerId: space.ownerId,
      ownerName: castName(space.ownerId),
      members: [] as { id: string; name: string }[],
      documents: DOCUMENTS.filter((document) => document.spaceId === space.id)
        .length,
      revisions: snapshot.revisions.filter(
        (revision) => spaceOf(revision.spaceId)?.id === space.id,
      ).length,
    })),
    counters: {
      documents: index.total,
      upToDate: index.upToDate,
      openProposals: index.openProposals,
      openDiscrepancies: index.openDiscrepancies,
      openOverlaps: index.openOverlaps,
      stale: index.staleDocuments,
    },
    seal: sealOf(snapshot),
  };
};

export const inboxResponse = (snapshot: LakeSnapshot, castId: string) => {
  const revisionById = new Map(
    snapshot.revisions.map((revision) => [revision.id, revision]),
  );
  const votes = snapshot.notifications
    .filter((notification) => notification.stakeholderId === castId)
    .flatMap((notification) => {
      const proposal = [...snapshot.proposals]
        .reverse()
        .find((candidate) => candidate.changeId === notification.changeId);
      if (!proposal) return [];
      const { costDelta, delayDays } = sumOf(impactsOf(snapshot, proposal));
      const progress = progressOf(proposal);
      return [
        {
          type: 'vote' as const,
          id: notification.id,
          notificationId: notification.id,
          proposalId: proposal.id,
          changeId: notification.changeId,
          title: notification.title,
          sentAt: notification.sentAt,
          findings: notification.findings,
          costDelta,
          delayDays,
          progress: {
            approved: progress.approved,
            required: progress.required,
            missing: progress.missing,
          },
          status: progress.status,
          blockedByOverlap: blockedByOverlap(snapshot, proposal),
          response: notification.response,
          link: notification.link,
        },
      ];
    });
  const discrepancies = snapshot.discrepancies
    .filter(
      (discrepancy) =>
        discrepancy.status === 'open' && discrepancy.ownerId === castId,
    )
    .map((discrepancy) => {
      const revision = revisionById.get(discrepancy.revisionId);
      return {
        type: 'discrepancy' as const,
        id: discrepancy.id,
        subjectName: subjectName(discrepancy.subject),
        label: attributeLabel(discrepancy.attribute),
        claimedValue: discrepancy.value,
        currentValue: discrepancy.baselineValue,
        unit: discrepancy.unit,
        sourceTitle: revision
          ? revisionTitle(revision)
          : discrepancy.documentId,
        spaceName: revision ? spaceName(revision.spaceId) : '',
        authorName: revision ? castName(revision.authorId) : '',
        at: discrepancy.createdAt,
      };
    });
  const overlaps = snapshot.overlaps
    .filter(
      (overlap) =>
        isLiveOverlap(overlap) && overlap.validators.includes(castId),
    )
    .map((overlap) => ({
      type: 'overlap' as const,
      kind: 'overlap' as const,
      id: overlap.id,
      overlapId: overlap.id,
      myVote:
        overlap.votes.find((vote) => vote.validatorId === castId)?.kind ?? null,
      at: overlap.createdAt,
      overlap: overlapView(snapshot, overlap),
    }));
  const stale = snapshot.consensus.stale
    .filter(
      (document) =>
        document.acknowledgement === null && document.ownerId === castId,
    )
    .flatMap((document) =>
      document.items.map((item) => ({
        type: 'stale' as const,
        id: `${document.revisionId}:${item.subject}.${item.attribute}`,
        documentId: document.documentId,
        documentTitle: document.documentName,
        revisionId: document.revisionId,
        revisionLabel: document.label,
        subjectId: item.subject,
        attribute: item.attribute,
        label: factLabel(item.subject, item.attribute),
        usedValue: item.usedValue,
        currentValue: item.currentValue,
        unit: item.unit,
        at: revisionById.get(document.revisionId)?.ingestedAt ?? null,
      })),
    );
  const filtered = snapshot.proposals.flatMap((proposal) => {
    const entry = proposal.filtered.find((item) => item.id === castId);
    if (!entry || proposal.changeId === null) return [];
    return [
      {
        type: 'filtered' as const,
        id: `${proposal.id}:${castId}`,
        proposalId: proposal.id,
        changeId: proposal.changeId,
        title: proposalTitle(proposal),
        reason: entry.reason,
        at: proposal.openedAt,
      },
    ];
  });
  return {
    castId,
    items: [...overlaps, ...votes, ...discrepancies, ...stale, ...filtered],
    authoring: snapshot.proposals
      .filter((proposal) => proposal.authorId === castId && isActive(proposal))
      .map((proposal) => proposalView(snapshot, proposal)),
  };
};

const withoutChangeId = ({ changeId, ...impact }: Impact) => {
  void changeId;
  return impact;
};

const withoutFindings = ({ findings, ...notification }: Notification) => {
  void findings;
  return notification;
};

export const changeView = (
  snapshot: LakeSnapshot,
  change: Change,
  proposal: Proposal | undefined,
) => {
  const { id, ...rest } = change;
  const impact = snapshot.impacts.get(id);
  return {
    id,
    ...rest,
    impact: impact ? withoutChangeId(impact) : null,
    notifications: snapshot.notifications
      .filter((notification) => notification.changeId === id)
      .map(withoutFindings),
    proposal: proposal ? proposalView(snapshot, proposal) : null,
  };
};

const areaCellView = (area: {
  nivel: string;
  celda: string;
  sistemas: readonly string[];
}) => ({
  nivel: area.nivel,
  celda: area.celda,
  sistemas: [...area.sistemas],
  label: areaLabel({ ...area }),
});

export const areasResponse = (snapshot: LakeSnapshot) => {
  const occupants = [
    ...new Set(snapshot.baseline.map((entry) => entry.subject)),
  ]
    .filter((subject) => spatialKindOf(subject) !== 'ninguno')
    .sort((a, b) => subjectIndex(a) - subjectIndex(b))
    .map((subject) => {
      const current = footprintModel(
        subject,
        baselineValues(subject, snapshot.baseline),
      );
      const proposals = activeFor(subject, snapshot.proposals);
      const proposed = footprintModel(
        subject,
        finalValues(subject, snapshot.baseline, snapshot.proposals),
      );
      const latest = proposals[proposals.length - 1];
      const entries = snapshot.baseline
        .filter((entry) => entry.subject === subject)
        .sort((a, b) => b.since.getTime() - a.since.getTime());
      const backingRevision = snapshot.revisions.find(
        (revision) => revision.id === entries[0]?.revisionId,
      );
      return {
        subjectId: subject,
        name: subjectName(subject),
        section: sectionOf(subject),
        kind: current.kind,
        areas: current.areas.map(areaCellView),
        proposed:
          latest && !sameFootprint(current, proposed)
            ? {
                proposalId: latest.id,
                areas: proposed.areas.map(areaCellView),
              }
            : null,
        backing: backingRevision
          ? {
              revisionId: backingRevision.id,
              title: revisionTitle(backingRevision),
              ownerId: backingRevision.authorId,
              ownerName: castName(backingRevision.authorId),
            }
          : null,
        overlapIds: snapshot.overlaps
          .filter(
            (overlap) =>
              isLiveOverlap(overlap) &&
              (overlap.subjectId === subject ||
                overlap.otherSubjectId === subject),
          )
          .map((overlap) => overlap.id),
      };
    });
  return {
    levels: LEVELS.map((level) => ({ id: level.id, label: level.label })),
    axes: {
      longitudinal: LONGITUDINAL_AXES.map((axis) => ({ ...axis })),
      transversal: [...TRANSVERSAL_AXES],
    },
    spans: [...SPANS],
    cells: [...ALL_CELLS],
    systems: SYSTEMS.map((system) => ({ ...system })),
    occupants,
    overlaps: snapshot.overlaps
      .filter(isLiveOverlap)
      .map((overlap) => overlapView(snapshot, overlap)),
  };
};

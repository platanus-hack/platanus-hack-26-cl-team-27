import type { Change } from '@team27/context-capture';
import { formatValue } from '@team27/context-capture';
import type { Impact } from '@team27/context-impact';
import { quantityOf } from '@team27/context-impact';
import type {
  BaselineEntry,
  Claim,
  ClaimValue,
  Consensus,
  Discrepancy,
  Proposal,
  Provenance,
  Revision,
  StaleDocument,
} from '@team27/context-lake';
import { isActive, valueStatus } from '@team27/context-lake';
import type { Notification } from '@team27/context-notification';

import {
  attributeLabel,
  DOCUMENTS,
  type Fixture,
  FIXTURES,
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

export const proposalTitle = (
  proposal: Pick<Proposal, 'subject' | 'changes'>,
) =>
  `${subjectName(proposal.subject)} · ${proposal.changes
    .map(
      (change) =>
        `${attributeLabel(change.attribute)}: ${formatValue(printable(change.before), change.unit)} → ${formatValue(printable(change.after), change.unit)}`,
    )
    .join(' · ')}`;

export const mergedProposals = (snapshot: LakeSnapshot): Proposal[] =>
  snapshot.proposals.filter((proposal) => proposal.status === 'merged');

export const projectVersion = (snapshot: LakeSnapshot): number =>
  1 + mergedProposals(snapshot).length;

export const totalsOf = (snapshot: LakeSnapshot) => {
  const impacts = mergedProposals(snapshot).flatMap((proposal) => {
    const impact = proposal.changeId
      ? snapshot.impacts.get(proposal.changeId)
      : undefined;
    return impact ? [impact] : [];
  });
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

export const proposalView = (snapshot: LakeSnapshot, proposal: Proposal) => {
  const impact = proposal.changeId
    ? snapshot.impacts.get(proposal.changeId)
    : undefined;
  const notifications = snapshot.notifications.filter(
    (notification) => notification.changeId === proposal.changeId,
  );
  const backing = snapshot.discrepancies.filter(
    (discrepancy) =>
      discrepancy.status === 'backed' &&
      discrepancy.backedByRevisionId === proposal.sourceRevisionId &&
      discrepancy.subject === proposal.subject &&
      proposal.changes.some(
        (change) => change.attribute === discrepancy.attribute,
      ),
  );
  const progress = progressOf(proposal);
  return {
    id: proposal.id,
    changeId: proposal.changeId,
    title: proposalTitle(proposal),
    status: progress.status,
    elementName: subjectName(proposal.subject),
    subjectId: proposal.subject,
    attribute: proposal.changes[0]?.attribute ?? '',
    diffs: proposal.changes.map((change) => ({
      label: attributeLabel(change.attribute),
      unit: change.unit,
      before: change.before,
      after: change.after,
    })),
    costDelta: impact?.costDelta ?? 0,
    delayDays: impact?.delayDays ?? 0,
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
      const proposal = active.find(
        (candidate) =>
          candidate.subject === entry.subject &&
          candidate.changes.some(
            (change) => change.attribute === entry.attribute,
          ),
      );
      const change = proposal?.changes.find(
        (candidate) => candidate.attribute === entry.attribute,
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
              claims: snapshot.claims
                .filter((claim) => claim.revisionId === revision.id)
                .map((claim) => ({
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

export const fixtureState = (
  snapshot: LakeSnapshot,
  fixture: Fixture,
): { dropped: boolean; blockedReason: string | null } => {
  const has = (documentId: string, label: string): boolean =>
    snapshot.revisions.some(
      (revision) =>
        revision.documentId === documentId && revision.label === label,
    );
  const dropped = has(fixture.documentId, fixture.label);
  const missing = fixture.requires.find(
    (requirement) => !has(requirement.documentId, requirement.label),
  );
  return {
    dropped,
    blockedReason: missing
      ? `Antes hay que soltar ${documentDef(missing.documentId)?.name ?? missing.documentId} ${missing.label}.`
      : null,
  };
};

export const trayResponse = (snapshot: LakeSnapshot, castId: string) => ({
  castId,
  items: FIXTURES.filter((fixture) => fixture.seat === castId).map(
    (fixture) => {
      const state = fixtureState(snapshot, fixture);
      return {
        fixtureId: fixture.id,
        documentId: fixture.documentId,
        documentTitle:
          documentDef(fixture.documentId)?.name ?? fixture.documentId,
        revisionLabel: fixture.label,
        spaceId: fixture.spaceId,
        spaceName: spaceName(fixture.spaceId),
        pointer: fixture.pointer,
        claims: fixture.claims.map((claim) => ({
          label: factLabel(claim.subject, claim.attribute),
          value: claim.value,
          unit: claim.unit,
          role: claim.role,
        })),
        available: !state.dropped && state.blockedReason === null,
        blockedReason: state.dropped ? null : state.blockedReason,
        dropped: state.dropped,
      };
    },
  ),
});

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
  readonly autoplay: { readonly enabled: boolean; readonly speed: number };
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
      stale: index.staleDocuments,
    },
    seal: sealOf(snapshot),
    autoplay: extras.autoplay,
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
      const impact = snapshot.impacts.get(notification.changeId);
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
          costDelta: impact?.costDelta ?? 0,
          delayDays: impact?.delayDays ?? 0,
          progress: {
            approved: progress.approved,
            required: progress.required,
            missing: progress.missing,
          },
          status: progress.status,
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
    items: [...votes, ...discrepancies, ...stale, ...filtered],
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

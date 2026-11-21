import type {
  Acknowledgement,
  AcknowledgementRepository,
  BaselineEntry,
  BaselineHistoryItem,
  BaselineRepository,
  Claim,
  ClaimRepository,
  Discrepancy,
  DiscrepancyRepository,
  Proposal,
  ProposalRepository,
  ProposalStatus,
  Revision,
  RevisionRepository,
} from '@team27/context-lake';

export class InMemoryRevisions implements RevisionRepository {
  private rows: Revision[] = [];
  private order = 0;

  save: RevisionRepository['save'] = (draft) => {
    const revision: Revision = {
      ...draft,
      id: `rev-${this.order + 1}`,
      ingestOrder: ++this.order,
      ingestedAt: new Date(),
    };
    this.rows.push(revision);
    return Promise.resolve(revision);
  };

  findByKey: RevisionRepository['findByKey'] = (documentId, label) =>
    Promise.resolve(
      this.rows.find(
        (row) => row.documentId === documentId && row.label === label,
      ) ?? null,
    );

  findById: RevisionRepository['findById'] = (id) =>
    Promise.resolve(this.rows.find((row) => row.id === id) ?? null);

  list: RevisionRepository['list'] = () => Promise.resolve([...this.rows]);

  clear: RevisionRepository['clear'] = () => {
    this.rows = [];
    return Promise.resolve();
  };
}

export class InMemoryClaims implements ClaimRepository {
  private rows: Claim[] = [];

  saveMany: ClaimRepository['saveMany'] = (revisionId, drafts) => {
    const claims = drafts.map((draft, index): Claim => ({
      ...draft,
      id: `${revisionId}-claim-${this.rows.length + index}`,
      revisionId,
    }));
    this.rows.push(...claims);
    return Promise.resolve(claims);
  };

  list: ClaimRepository['list'] = () => Promise.resolve([...this.rows]);

  listFor: ClaimRepository['listFor'] = (subject, attribute) =>
    Promise.resolve(
      this.rows.filter(
        (row) => row.subject === subject && row.attribute === attribute,
      ),
    );

  clear: ClaimRepository['clear'] = () => {
    this.rows = [];
    return Promise.resolve();
  };
}

export class InMemoryBaseline implements BaselineRepository {
  private rows = new Map<string, BaselineEntry>();
  private past: BaselineHistoryItem[] = [];

  private key = (subject: string, attribute: string) =>
    `${subject}|${attribute}`;

  list: BaselineRepository['list'] = () =>
    Promise.resolve([...this.rows.values()]);

  find: BaselineRepository['find'] = (subject, attribute) =>
    Promise.resolve(this.rows.get(this.key(subject, attribute)) ?? null);

  upsert: BaselineRepository['upsert'] = (entry) => {
    const key = this.key(entry.subject, entry.attribute);
    const current = this.rows.get(key);
    if (current) {
      this.past.push({
        subject: current.subject,
        attribute: current.attribute,
        value: current.value,
        unit: current.unit,
        claimId: current.claimId,
        revisionId: current.revisionId,
        proposalId: current.proposalId,
        since: current.since,
        until: entry.since,
      });
    }
    this.rows.set(key, entry);
    return Promise.resolve();
  };

  history: BaselineRepository['history'] = (subject, attribute) =>
    Promise.resolve(
      this.past.filter(
        (item) => item.subject === subject && item.attribute === attribute,
      ),
    );

  clear: BaselineRepository['clear'] = () => {
    this.rows.clear();
    this.past = [];
    return Promise.resolve();
  };
}

export class InMemoryProposals implements ProposalRepository {
  private rows: Proposal[] = [];

  create: ProposalRepository['create'] = (input) => {
    const proposal: Proposal = {
      id: `proposal-${this.rows.length + 1}`,
      changeId: input.changeId,
      subject: input.subject,
      sourceRevisionId: input.sourceRevisionId,
      authorId: input.authorId,
      changes: input.changes,
      status: 'open',
      reviews: input.reviewerIds.map((reviewerId) => ({
        reviewerId,
        decision: null,
        note: null,
        at: null,
      })),
      filtered: input.filtered,
      openedAt: input.openedAt,
      resolvedAt: null,
      supersededById: null,
    };
    this.rows.push(proposal);
    return Promise.resolve(proposal);
  };

  save: ProposalRepository['save'] = (proposal) => {
    this.rows = this.rows.map((row) =>
      row.id === proposal.id ? proposal : row,
    );
    return Promise.resolve();
  };

  findById: ProposalRepository['findById'] = (id) =>
    Promise.resolve(this.rows.find((row) => row.id === id) ?? null);

  list: ProposalRepository['list'] = (status?: ProposalStatus) =>
    Promise.resolve(
      this.rows.filter((row) => status === undefined || row.status === status),
    );

  listActive: ProposalRepository['listActive'] = () =>
    Promise.resolve(
      this.rows.filter(
        (row) => row.status === 'open' || row.status === 'disputed',
      ),
    );

  clear: ProposalRepository['clear'] = () => {
    this.rows = [];
    return Promise.resolve();
  };
}

export class InMemoryDiscrepancies implements DiscrepancyRepository {
  private rows: Discrepancy[] = [];

  create: DiscrepancyRepository['create'] = (draft) => {
    const discrepancy: Discrepancy = {
      ...draft,
      id: `discrepancy-${this.rows.length + 1}`,
      status: 'open',
      backedByRevisionId: null,
      note: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.rows.push(discrepancy);
    return Promise.resolve(discrepancy);
  };

  resolve: DiscrepancyRepository['resolve'] = (id, resolution) => {
    const current = this.rows.find((row) => row.id === id);
    if (!current) return Promise.reject(new Error(`No existe ${id}`));
    const next: Discrepancy = { ...current, ...resolution };
    this.rows = this.rows.map((row) => (row.id === id ? next : row));
    return Promise.resolve(next);
  };

  findById: DiscrepancyRepository['findById'] = (id) =>
    Promise.resolve(this.rows.find((row) => row.id === id) ?? null);

  list: DiscrepancyRepository['list'] = () => Promise.resolve([...this.rows]);

  listOpen: DiscrepancyRepository['listOpen'] = () =>
    Promise.resolve(this.rows.filter((row) => row.status === 'open'));

  clear: DiscrepancyRepository['clear'] = () => {
    this.rows = [];
    return Promise.resolve();
  };
}

export class InMemoryAcknowledgements implements AcknowledgementRepository {
  private rows: Acknowledgement[] = [];

  create: AcknowledgementRepository['create'] = (draft) => {
    const acknowledgement: Acknowledgement = {
      ...draft,
      id: `ack-${this.rows.length + 1}`,
      at: new Date(),
    };
    this.rows.push(acknowledgement);
    return Promise.resolve(acknowledgement);
  };

  list: AcknowledgementRepository['list'] = () =>
    Promise.resolve([...this.rows]);

  clear: AcknowledgementRepository['clear'] = () => {
    this.rows = [];
    return Promise.resolve();
  };
}

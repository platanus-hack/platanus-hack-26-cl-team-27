import type { Config } from '../config.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class ApiUnreachable extends Error {
  constructor(url: string) {
    super(
      `No pude conectar con la API en ${url}. ¿Está corriendo? Levántala con «pnpm dev:api» o revisa API_URL.`,
    );
    this.name = 'ApiUnreachable';
  }
}

export const isSeatHeld = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status === 409 &&
  error.code === 'seat_held';

export const isBadKey = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

export interface RequestOptions {
  readonly actAs?: string;
  readonly actionId?: string;
  readonly body?: unknown;
}

export type Fetch = typeof fetch;

export interface ReviewerView {
  readonly stakeholderId: string;
  readonly name: string;
  readonly notificationId: string | null;
  readonly decision: 'approve' | 'dispute' | null;
  readonly note: string | null;
}

export interface ProposalView {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly subjectId: string;
  readonly costDelta: number;
  readonly delayDays: number;
  readonly reviewers: readonly ReviewerView[];
  readonly filtered: readonly {
    stakeholderId: string;
    name: string;
    reason: string;
  }[];
}

export type OverlapStatus =
  'abierto' | 'descartado' | 'confirmado' | 'resuelto';

export type OverlapVoteKind = 'se_tocan' | 'no_se_tocan';

export interface OverlapView {
  readonly id: string;
  readonly proposalId: string | null;
  readonly revisionId: string;
  readonly chunkLocator: string;
  readonly kind: string;
  readonly area: {
    readonly nivel: string;
    readonly celda: string;
    readonly sistemas: readonly string[];
  };
  readonly subjectId: string;
  readonly otherSubjectId: string;
  readonly otherBacking: {
    readonly documentId: string;
    readonly label: string;
    readonly ownerId: string;
  };
  readonly status: OverlapStatus;
  readonly validators: readonly string[];
  readonly votes: readonly {
    readonly validatorId: string;
    readonly kind: OverlapVoteKind;
    readonly note: string | null;
  }[];
}

export interface ApiEvent {
  readonly seq: number;
  readonly kind: string;
  readonly message: string;
  readonly refs: Readonly<Record<string, unknown>> | null;
}

export interface EventsResponse {
  readonly epoch: number;
  readonly cursor: number;
  readonly reset: boolean;
  readonly events: readonly ApiEvent[];
}

export interface CastView {
  readonly id: string;
  readonly name: string;
  readonly occupied?: boolean;
  readonly occupant?: string;
}

export interface RoomView {
  readonly epoch: number;
  readonly cast: readonly CastView[];
  readonly lake?: { readonly empty: boolean };
  readonly counters: {
    readonly openProposals: number;
    readonly openDiscrepancies: number;
    readonly stale: number;
    readonly upToDate: number;
    readonly documents: number;
  };
  readonly totals: {
    readonly costDelta: number;
    readonly delayDays: number;
    readonly projectDays: number;
  };
  readonly projectVersion: number;
}

export interface SpacesView {
  readonly spaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly documents: readonly {
      readonly id: string;
      readonly title: string;
      readonly state: string;
      readonly revisions: readonly { readonly label: string }[];
    }[];
  }[];
}

export interface IngestClaimResult {
  readonly subjectId: string;
  readonly attribute: string;
  readonly value: number | string;
  readonly outcome: string;
}

export interface ProposalHunk {
  readonly subjectId: string;
  readonly attribute?: string;
  readonly before?: number | string | null;
  readonly after?: number | string | null;
  readonly from?: number | string | null;
  readonly to?: number | string | null;
  readonly locator?: string;
  readonly chunkLocator?: string;
  readonly changed?: boolean;
  readonly kind?: string;
}

export interface IngestProposal {
  readonly id: string;
  readonly title: string;
  readonly documentId?: string;
  readonly label?: string;
  readonly authorId?: string;
  readonly hunks?: readonly ProposalHunk[];
  readonly unchanged?: number;
  readonly unchangedCount?: number;
  readonly blockedByOverlap?: boolean;
  readonly waitingOverlap?: boolean;
  readonly costDelta: number;
  readonly delayDays: number;
  readonly reviewers: readonly string[];
  readonly filtered: readonly { stakeholderId: string; reason: string }[];
}

export interface IngestResponse {
  readonly revisionId: string;
  readonly claims: readonly IngestClaimResult[];
  readonly proposals: readonly IngestProposal[];
  readonly discrepancies: readonly { id: string; ownerId: string }[];
  readonly backed: readonly string[];
  readonly stale: readonly {
    revisionId: string;
    subjectId: string;
    attribute: string;
  }[];
}

export class Api {
  private readonly config: Config;
  private readonly http: Fetch;

  constructor(config: Config, http: Fetch = fetch) {
    this.config = config;
    this.http = http;
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'x-presenter-key': this.config.presenterKey,
    };
    if (options.actAs) headers['x-act-as'] = options.actAs;
    if (options.actionId) headers['x-action-id'] = options.actionId;
    if (options.body !== undefined)
      headers['content-type'] = 'application/json';
    let response: Response;
    try {
      response = await this.http(`${this.config.apiUrl}/api${path}`, {
        method,
        headers,
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      });
    } catch {
      throw new ApiUnreachable(this.config.apiUrl);
    }
    const text = await response.text();
    let payload: unknown = null;
    if (text !== '') {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const body = (payload ?? {}) as { code?: unknown; message?: unknown };
      throw new ApiError(
        response.status,
        typeof body.code === 'string' ? body.code : null,
        typeof body.message === 'string'
          ? body.message
          : `La API respondió ${response.status}`,
      );
    }
    return payload as T;
  }

  room(): Promise<RoomView> {
    return this.request('GET', '/room');
  }

  spaces(): Promise<SpacesView> {
    return this.request('GET', '/spaces');
  }

  async proposals(): Promise<ProposalView[]> {
    const body = await this.request<{ proposals: ProposalView[] }>(
      'GET',
      '/proposals',
    );
    return body.proposals;
  }

  async overlaps(): Promise<OverlapView[]> {
    const body = await this.request<
      OverlapView[] | { overlaps: OverlapView[] }
    >('GET', '/overlaps');
    return Array.isArray(body) ? body : body.overlaps;
  }

  events(
    after: number | undefined,
    epoch: number | undefined,
  ): Promise<EventsResponse> {
    const query = new URLSearchParams({ limit: '200' });
    if (after !== undefined) query.set('after', String(after));
    if (epoch !== undefined) query.set('epoch', String(epoch));
    return this.request('GET', `/events?${query.toString()}`);
  }

  reset(): Promise<{ epoch: number }> {
    return this.request('POST', '/room/reset');
  }

  async vote(input: {
    notificationId: string;
    kind: 'reviewed' | 'issue';
    note: string;
    actAs: string;
    actionId: string;
  }): Promise<void> {
    await this.request(
      'POST',
      `/notifications/${input.notificationId}/response`,
      {
        actAs: input.actAs,
        actionId: input.actionId,
        body: { kind: input.kind, note: input.note },
      },
    );
  }

  async voteOverlap(input: {
    overlapId: string;
    kind: OverlapVoteKind;
    note: string;
    actAs: string;
    actionId: string;
  }): Promise<void> {
    await this.request('POST', `/overlaps/${input.overlapId}/vote`, {
      actAs: input.actAs,
      actionId: input.actionId,
      body: { kind: input.kind, note: input.note },
    });
  }

  async reopen(proposalId: string): Promise<void> {
    await this.request('POST', `/proposals/${proposalId}/reopen`);
  }
}

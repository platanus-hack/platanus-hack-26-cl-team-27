import { type Auth, request } from './http';

export interface IgnoredCell {
  readonly locator: string;
  readonly reason: string;
}

export interface SourceView {
  readonly id: string;
  readonly provider: 'google';
  readonly documentId: string;
  readonly documentName: string;
  readonly spaceName: string | null;
  readonly title: string;
  readonly pointer: string;
  readonly checkedAt: string | null;
  readonly createdAt: string;
  readonly lastRead: {
    readonly at: string;
    readonly label: string;
    readonly ignored: readonly IgnoredCell[];
  } | null;
  readonly lastError: { readonly at: string; readonly message: string } | null;
}

export interface LinkableDocument {
  readonly id: string;
  readonly name: string;
  readonly spaceName: string;
  readonly linked: boolean;
}

export interface ConnectorsOverview {
  readonly google: {
    readonly configured: boolean;
    readonly connection: {
      readonly accountEmail: string;
      readonly connectedAt: string;
    } | null;
    readonly pollSeconds: number;
  };
  readonly sources: readonly SourceView[];
  readonly documents: readonly LinkableDocument[];
}

export type SyncStatus = 'ingested' | 'unchanged' | 'waiting' | 'failed';

export interface SyncResponse {
  readonly source: SourceView;
  readonly sync: {
    readonly status: SyncStatus;
    readonly message: string;
    readonly revisionId: string | null;
    readonly proposals: number;
  };
}

export type FeedbackTone = 'success' | 'info' | 'error';

export interface Feedback {
  readonly tone: FeedbackTone;
  readonly text: string;
}

const BASE = '/api/integrations';

export const getConnectors = (
  auth: Auth,
  signal?: AbortSignal,
): Promise<ConnectorsOverview> =>
  request<ConnectorsOverview>(BASE, { ...auth, signal });

export const authorizeGoogle = (auth: Auth): Promise<{ url: string }> =>
  request<{ url: string }>(`${BASE}/google/authorize`, {
    ...auth,
    method: 'POST',
  });

export const disconnectGoogle = (auth: Auth): Promise<void> =>
  request<void>(`${BASE}/google`, { ...auth, method: 'DELETE' });

export const linkSheet = (
  input: { readonly documentId: string; readonly url: string },
  auth: Auth,
): Promise<SyncResponse> =>
  request<SyncResponse>(`${BASE}/sources`, {
    ...auth,
    method: 'POST',
    body: input,
  });

export const syncSource = (id: string, auth: Auth): Promise<SyncResponse> =>
  request<SyncResponse>(`${BASE}/sources/${encodeURIComponent(id)}/sync`, {
    ...auth,
    method: 'POST',
  });

export const unlinkSource = (id: string, auth: Auth): Promise<void> =>
  request<void>(`${BASE}/sources/${encodeURIComponent(id)}`, {
    ...auth,
    method: 'DELETE',
  });

const SYNC_TONES: Readonly<Record<SyncStatus, FeedbackTone>> = {
  ingested: 'success',
  unchanged: 'info',
  waiting: 'info',
  failed: 'error',
};

export const syncFeedback = (response: SyncResponse): Feedback => ({
  tone: SYNC_TONES[response.sync.status],
  text: response.sync.message,
});

export const connectionFeedback = (
  google: string | null,
  reason: string | null,
): Feedback | null => {
  if (google === 'conectado') {
    return { tone: 'success', text: 'Conectamos tu cuenta de Google.' };
  }
  if (google === 'error') {
    return {
      tone: 'error',
      text: reason ?? 'Google no completó la conexión.',
    };
  }
  return null;
};

export type SourceTone = 'good' | 'serious' | 'neutral';

export const sourceState = (
  source: SourceView,
): { readonly tone: SourceTone; readonly label: string } => {
  if (source.lastError) return { tone: 'serious', label: 'Con error' };
  if (source.lastRead) return { tone: 'good', label: 'Al día' };
  return { tone: 'neutral', label: 'Sin leer todavía' };
};

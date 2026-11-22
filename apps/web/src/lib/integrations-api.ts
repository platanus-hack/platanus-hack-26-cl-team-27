import { type Auth, request } from './http';

export interface SourceView {
  readonly id: string;
  readonly provider: 'google';
  readonly title: string;
  readonly pointer: string;
  readonly checkedAt: string | null;
  readonly changedAt: string | null;
  readonly createdAt: string;
  readonly lastError: { readonly at: string; readonly message: string } | null;
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
}

export type CheckStatus = 'changed' | 'unchanged' | 'failed';

export interface CheckResponse {
  readonly source: SourceView;
  readonly check: {
    readonly status: CheckStatus;
    readonly message: string;
    readonly cells: number | null;
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
  url: string,
  auth: Auth,
): Promise<{ source: SourceView }> =>
  request<{ source: SourceView }>(`${BASE}/sources`, {
    ...auth,
    method: 'POST',
    body: { url },
  });

export const checkSource = (id: string, auth: Auth): Promise<CheckResponse> =>
  request<CheckResponse>(`${BASE}/sources/${encodeURIComponent(id)}/check`, {
    ...auth,
    method: 'POST',
  });

export const unlinkSource = (id: string, auth: Auth): Promise<void> =>
  request<void>(`${BASE}/sources/${encodeURIComponent(id)}`, {
    ...auth,
    method: 'DELETE',
  });

const CHECK_TONES: Readonly<Record<CheckStatus, FeedbackTone>> = {
  changed: 'success',
  unchanged: 'info',
  failed: 'error',
};

export const checkFeedback = (response: CheckResponse): Feedback => ({
  tone: CHECK_TONES[response.check.status],
  text: `«${response.source.title}»: ${response.check.message}.`,
});

export const linkFeedback = (
  source: SourceView,
  pollSeconds: number,
): Feedback => ({
  tone: 'success',
  text:
    pollSeconds > 0
      ? `Vinculamos «${source.title}». Revisamos cada ${pollSeconds} s si cambia.`
      : `Vinculamos «${source.title}». Usa «Revisar ahora» para ver si cambió.`,
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

export type SourceTone = 'good' | 'serious';

export const sourceState = (
  source: SourceView,
): { readonly tone: SourceTone; readonly label: string } =>
  source.lastError
    ? { tone: 'serious', label: 'Con error' }
    : { tone: 'good', label: 'Escuchando' };

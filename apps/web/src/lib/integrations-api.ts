import { request } from './http';

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

export const CONNECTORS_PATH = '/conectores';
export const PROJECT_PARAM = 'proyecto';

const BASE = '/api/integrations';

const projectBase = (projectId: string): string =>
  `${BASE}/projects/${encodeURIComponent(projectId)}`;

export const getConnectors = (
  projectId: string,
  signal?: AbortSignal,
): Promise<ConnectorsOverview> =>
  request<ConnectorsOverview>(projectBase(projectId), { signal });

export const authorizeGoogle = (projectId: string): Promise<{ url: string }> =>
  request<{ url: string }>(`${BASE}/google/authorize`, {
    method: 'POST',
    body: { projectId },
  });

export const disconnectGoogle = (): Promise<void> =>
  request<void>(`${BASE}/google`, { method: 'DELETE' });

export const linkSheet = (
  projectId: string,
  url: string,
): Promise<{ source: SourceView }> =>
  request<{ source: SourceView }>(`${projectBase(projectId)}/sources`, {
    method: 'POST',
    body: { url },
  });

export const checkSource = (
  projectId: string,
  id: string,
): Promise<CheckResponse> =>
  request<CheckResponse>(
    `${projectBase(projectId)}/sources/${encodeURIComponent(id)}/check`,
    { method: 'POST' },
  );

export const unlinkSource = (projectId: string, id: string): Promise<void> =>
  request<void>(`${projectBase(projectId)}/sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const connectorsHref = (projectId: string): string =>
  `${CONNECTORS_PATH}?${new URLSearchParams({ [PROJECT_PARAM]: projectId }).toString()}`;

export const pickProject = <T extends { readonly id: string }>(
  projects: readonly T[],
  requested: string | null,
): T | null =>
  projects.find((project) => project.id === requested) ?? projects[0] ?? null;

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

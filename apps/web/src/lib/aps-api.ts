import { request } from './http';

export type Discipline =
  | 'architectural'
  | 'site'
  | 'structural'
  | 'plumbing'
  | 'hvac'
  | 'electrical'
  | 'other';

export interface ViewerModel {
  readonly file: string;
  readonly discipline: Discipline;
  readonly urn: string;
}

export interface ViewerToken {
  readonly access_token: string;
  readonly expires_in: number;
}

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  architectural: 'Arquitectura',
  site: 'Terreno',
  structural: 'Estructura',
  plumbing: 'Sanitarias',
  hvac: 'Climatización',
  electrical: 'Eléctricas',
  other: 'Otros',
};

export const getViewerModels = (
  signal?: AbortSignal,
): Promise<{ models: ViewerModel[] }> =>
  request<{ models: ViewerModel[] }>('/api/aps/models', { signal });

export const getViewerToken = (): Promise<ViewerToken> =>
  request<ViewerToken>('/api/aps/viewer-token');

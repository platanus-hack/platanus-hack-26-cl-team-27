import { request, type Auth } from './http';
import type { AutoplaySpeed } from './room-api';

export interface SceneView {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly extra: boolean;
  readonly status: 'pending' | 'running' | 'played';
  readonly playable: boolean;
  readonly disabledReason: string | null;
}

export interface ScenesResponse {
  readonly scenes: readonly SceneView[];
  readonly autoplay: {
    readonly enabled: boolean;
    readonly speed: AutoplaySpeed;
  };
}

export const SPEEDS: readonly AutoplaySpeed[] = [1, 2, 4];

export const getScenes = (
  auth: Auth,
  signal?: AbortSignal,
): Promise<ScenesResponse> =>
  request<ScenesResponse>('/api/room/scenes', { ...auth, signal });

export const playScene = (sceneId: string, auth: Auth): Promise<void> =>
  request<void>(`/api/room/scenes/${sceneId}/play`, {
    method: 'POST',
    body: {},
    ...auth,
  });

export const setAutoplay = (
  enabled: boolean,
  speed: AutoplaySpeed,
  auth: Auth,
): Promise<void> =>
  request<void>('/api/room/autoplay', {
    method: 'POST',
    body: { enabled, speed },
    ...auth,
  });

export const resetRoom = (auth: Auth): Promise<void> =>
  request<void>('/api/room/reset', { method: 'POST', body: {}, ...auth });

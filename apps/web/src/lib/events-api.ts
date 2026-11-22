import { request } from './http';
import { projectApi } from './project-paths';

export interface ProjectEvent {
  readonly seq: number;
  readonly kind: string;
  readonly message: string;
  readonly at: string;
}

export interface EventsResponse {
  readonly cursor: number;
  readonly reset: boolean;
  readonly events: readonly ProjectEvent[];
}

export const eventsPath = (projectId: string, after: number | null): string =>
  projectApi(projectId, after === null ? '/events' : `/events?after=${after}`);

export const getEvents = (
  projectId: string,
  after: number | null,
  signal?: AbortSignal,
): Promise<EventsResponse> =>
  request<EventsResponse>(eventsPath(projectId, after), { signal });

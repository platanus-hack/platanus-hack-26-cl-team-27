import { request } from './http';
import { projectApi } from './project-paths';

export interface ModelOption {
  readonly subject: string;
  readonly attribute: string;
  readonly label: string;
  readonly unit: string | null;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly current: number | string | null;
}

export interface ModelRole {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly color: string;
  readonly focus: string;
  readonly summary: string;
  readonly document: string | null;
  readonly owner: string;
  readonly options: readonly ModelOption[];
}

export interface ModelChangeResult {
  readonly value: number;
  readonly unit: string | null;
  readonly label: string;
  readonly changeId: string | null;
  readonly title: string | null;
  readonly changed: boolean;
}

export interface HistoryPerson {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly channel: string;
  readonly count: number;
}

export interface HistoryNotice {
  readonly id: string;
  readonly changeId: string;
  readonly kind: string;
  readonly stakeholderId: string;
  readonly name: string;
  readonly role: string | null;
  readonly noticeRole: string;
  readonly channel: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
  readonly aiAdded: boolean;
  readonly whyBy: string | null;
  readonly sentAt: string;
  readonly response: string | null;
  readonly delivery: {
    readonly status: string;
    readonly channel: string;
    readonly reason: string | null;
    readonly sentAt: string | null;
  } | null;
}

export const getModel = (projectId: string, signal?: AbortSignal) =>
  request<{ roles: ModelRole[] }>(projectApi(projectId, '/model'), { signal });

export const postModelChange = (
  projectId: string,
  body: { role: string; subject: string; attribute: string; value: number },
) =>
  request<ModelChangeResult>(projectApi(projectId, '/model/changes'), {
    method: 'POST',
    body,
  });

export const modelImage = (
  projectId: string,
  role: string,
  option?: { subject: string; unit: string | null },
  shift = 0,
): string => {
  const focus =
    option?.subject.startsWith('ventanas') === true
      ? '&focus=muros'
      : option?.subject.startsWith('partida') === true
        ? '&focus=losa'
        : '';
  const move = option?.unit === 'm' && shift !== 0 ? `&shift=${shift}` : '';
  return projectApi(
    projectId,
    `/model/image?role=${encodeURIComponent(role)}${focus}${move}`,
  );
};

export const getHistory = (
  projectId: string,
  person: string | null,
  signal?: AbortSignal,
) =>
  request<{ people: HistoryPerson[]; notices: HistoryNotice[] }>(
    projectApi(
      projectId,
      person
        ? `/notifications/history?person=${encodeURIComponent(person)}`
        : '/notifications/history',
    ),
    { signal },
  );

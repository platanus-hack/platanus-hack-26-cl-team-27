import { request } from './http';
import type { FactValue } from './format';
import { projectApi, projectPage } from './project-paths';

export interface ProvenanceStep {
  readonly value: FactValue;
  readonly unit: string | null;
  readonly current: boolean;
  readonly claim: { readonly role: 'afirma' | 'usa'; readonly locator: string };
  readonly revision: {
    readonly id: string;
    readonly title: string;
    readonly label: string;
    readonly pointer: string;
    readonly capturedAt: string;
  };
  readonly space: { readonly id: string; readonly name: string };
  readonly author: { readonly id: string; readonly name: string };
  readonly proposal: {
    readonly id: string;
    readonly status: string;
    readonly at: string;
  } | null;
  readonly reviews: readonly {
    readonly stakeholderId: string;
    readonly name: string;
    readonly decision: 'approve' | 'dispute' | null;
    readonly note: string | null;
    readonly at: string | null;
  }[];
  readonly backedBy: readonly {
    readonly revisionTitle: string;
    readonly spaceName: string;
    readonly authorName: string;
    readonly weakValue: FactValue;
  }[];
}

export interface ProvenanceResponse {
  readonly subjectId: string;
  readonly attribute: string;
  readonly label: string;
  readonly current: {
    readonly value: FactValue;
    readonly unit: string | null;
    readonly status: string;
  };
  readonly chain: readonly ProvenanceStep[];
  readonly corroborations: readonly {
    readonly revisionTitle: string;
    readonly label: string;
    readonly spaceName: string;
    readonly role: string;
  }[];
}

export const getProvenance = (
  projectId: string,
  subjectId: string,
  attribute: string,
  signal?: AbortSignal,
): Promise<ProvenanceResponse> =>
  request<ProvenanceResponse>(
    projectApi(
      projectId,
      `/baseline/${encodeURIComponent(subjectId)}/${encodeURIComponent(attribute)}/provenance`,
    ),
    { signal },
  );

export const valuePath = (
  projectId: string,
  subjectId: string,
  attribute: string,
): string =>
  projectPage(
    projectId,
    `/valor/${encodeURIComponent(subjectId)}/${encodeURIComponent(attribute)}`,
  );

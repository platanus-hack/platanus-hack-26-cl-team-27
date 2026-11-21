import { request } from './http';
import type { FactValue } from './format';
import type { SpaceKind } from './room-api';

export type ClaimOutcome =
  | 'same'
  | 'corroborates'
  | 'change'
  | 'discrepancy'
  | 'stale'
  | 'new';

export type DocumentState =
  | 'current'
  | 'stale'
  | 'discrepancy'
  | 'acknowledged';

export interface ClaimView {
  readonly subjectId: string;
  readonly attribute: string;
  readonly label: string;
  readonly value: FactValue;
  readonly unit: string | null;
  readonly role: 'afirma' | 'usa';
  readonly locator: string;
  readonly outcome: ClaimOutcome;
}

export interface RevisionView {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly pointer: string;
  readonly author: { readonly id: string; readonly name: string };
  readonly capturedAt: string;
  readonly current: boolean;
  readonly claims: readonly ClaimView[];
}

export interface StaleFact {
  readonly subjectId: string;
  readonly attribute: string;
  readonly label: string;
  readonly usedValue: FactValue;
  readonly currentValue: FactValue;
  readonly unit: string | null;
}

export interface DocumentView {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly state: DocumentState;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly staleFacts: readonly StaleFact[];
  readonly acknowledgedNote: string | null;
  readonly revisions: readonly RevisionView[];
}

export interface SpaceView {
  readonly id: string;
  readonly name: string;
  readonly kind: SpaceKind;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly documents: readonly DocumentView[];
}

export interface SpacesResponse {
  readonly spaces: readonly SpaceView[];
}

export const getSpaces = (signal?: AbortSignal): Promise<SpacesResponse> =>
  request<SpacesResponse>('/api/spaces', { signal });

export const staleDocuments = (
  spaces: readonly SpaceView[],
): (DocumentView & { spaceName: string })[] =>
  spaces.flatMap((space) =>
    space.documents
      .filter((document) => document.state === 'stale')
      .map((document) => ({ ...document, spaceName: space.name })),
  );

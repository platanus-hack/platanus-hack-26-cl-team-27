import { request } from './http';
import type { FactValue } from './format';
import type { SpaceKind } from './room-api';

export type ClaimOutcome =
  'same' | 'corroborates' | 'change' | 'discrepancy' | 'stale' | 'new';

export type DocumentState =
  'current' | 'stale' | 'discrepancy' | 'acknowledged';

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

export interface PlacedDocument extends DocumentView {
  readonly spaceId: string;
  readonly spaceName: string;
}

const place = (space: SpaceView, document: DocumentView): PlacedDocument => ({
  ...document,
  spaceId: space.id,
  spaceName: space.name,
});

export const pendingDocuments = (
  spaces: readonly SpaceView[],
): PlacedDocument[] =>
  spaces.flatMap((space) =>
    space.documents
      .filter(
        (document) =>
          document.state === 'stale' || document.state === 'discrepancy',
      )
      .map((document) => place(space, document)),
  );

export const revisionsNewestFirst = (document: DocumentView): RevisionView[] =>
  [...document.revisions].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  );

export const latestRevision = (document: DocumentView): RevisionView | null =>
  document.revisions.find((revision) => revision.current) ??
  revisionsNewestFirst(document)[0] ??
  null;

export const findDocument = (
  spaces: readonly SpaceView[],
  {
    documentId,
    revisionId,
  }: { documentId?: string | null; revisionId?: string | null },
): PlacedDocument | null => {
  for (const space of spaces) {
    const document = space.documents.find(
      (candidate) =>
        candidate.id === documentId ||
        (revisionId != null &&
          candidate.revisions.some((revision) => revision.id === revisionId)),
    );
    if (document) return place(space, document);
  }
  return null;
};

export const revisionCount = (space: SpaceView): number =>
  space.documents.reduce(
    (total, document) => total + document.revisions.length,
    0,
  );

export const SPACE_KIND_LABEL: Record<SpaceKind, string> = {
  drive: 'Carpeta de planos',
  sharepoint: 'Carpeta de costos',
  email: 'Correo',
  whatsapp: 'Chat de obra',
  libro_obra: 'Libro de obra',
};

import { request, type Auth } from './http';
import type { FactValue } from './format';
import type { ClaimOutcome } from './spaces-api';

export interface TrayItem {
  readonly fixtureId: string;
  readonly documentId: string;
  readonly documentTitle: string;
  readonly revisionLabel: string;
  readonly spaceId: string;
  readonly spaceName: string;
  readonly pointer: string;
  readonly claims: readonly {
    readonly label: string;
    readonly value: FactValue;
    readonly unit: string | null;
    readonly role: 'afirma' | 'usa';
  }[];
  readonly available: boolean;
  readonly blockedReason: string | null;
  readonly dropped: boolean;
}

export interface TrayResponse {
  readonly castId: string;
  readonly items: readonly TrayItem[];
}

export interface DropResponse {
  readonly revisionId: string;
  readonly claims: readonly {
    readonly subjectId: string;
    readonly attribute: string;
    readonly value: FactValue;
    readonly outcome: ClaimOutcome;
  }[];
  readonly proposals: readonly {
    readonly id: string;
    readonly changeId: string;
    readonly title: string;
    readonly costDelta: number;
    readonly delayDays: number;
    readonly reviewers: readonly string[];
    readonly filtered: readonly {
      readonly stakeholderId: string;
      readonly reason: string;
    }[];
  }[];
  readonly discrepancies: readonly { readonly id: string; readonly ownerId: string }[];
  readonly backed: readonly string[];
  readonly stale: readonly {
    readonly revisionId: string;
    readonly subjectId: string;
    readonly attribute: string;
  }[];
}

export const getTray = (
  castId: string,
  auth: Auth,
  signal?: AbortSignal,
): Promise<TrayResponse> =>
  request<TrayResponse>(`/api/seats/${castId}/tray`, { ...auth, signal });

export const dropDocument = (
  item: Pick<TrayItem, 'spaceId' | 'fixtureId'>,
  auth: Auth,
): Promise<DropResponse> =>
  request<DropResponse>(`/api/spaces/${item.spaceId}/drops`, {
    method: 'POST',
    body: { fixtureId: item.fixtureId },
    ...auth,
  });

export const describeDrop = (drop: DropResponse): string => {
  const parts: string[] = [];
  if (drop.proposals.length > 0)
    parts.push(
      drop.proposals.length === 1
        ? 'Se abrió una propuesta de cambio.'
        : `Se abrieron ${drop.proposals.length} propuestas de cambio.`,
    );
  if (drop.discrepancies.length > 0)
    parts.push('Quedó una discrepancia para el dueño del valor.');
  if (drop.backed.length > 0)
    parts.push('Respaldó una discrepancia abierta.');
  if (drop.stale.length > 0) parts.push('Dejó documentos por actualizar.');
  return parts.length > 0 ? parts.join(' ') : 'Quedó registrado, sin cambios.';
};

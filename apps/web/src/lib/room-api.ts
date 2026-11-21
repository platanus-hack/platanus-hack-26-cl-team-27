import { request, type Auth } from './http';

export type Channel = 'email' | 'whatsapp' | 'slack';

export type SpaceKind =
  'drive' | 'sharepoint' | 'email' | 'whatsapp' | 'libro_obra';

export interface CastMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly channel: Channel | null;
  readonly handle: string | null;
  readonly presenter: boolean;
  readonly preview: string;
  readonly occupied: boolean;
  readonly present: boolean;
  readonly bot: boolean;
}

export interface RoomSpace {
  readonly id: string;
  readonly name: string;
  readonly kind: SpaceKind;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly members: readonly { readonly id: string; readonly name: string }[];
  readonly documents: number;
  readonly revisions: number;
}

export interface Seal {
  readonly version: number;
  readonly sealedAt: string | null;
  readonly lines: readonly string[];
}

export interface RoomSnapshot {
  readonly epoch: number;
  readonly cursor: number;
  readonly lake: { readonly empty: boolean };
  readonly projectVersion: number;
  readonly project: {
    readonly name: string;
    readonly location: string;
    readonly description: string;
  };
  readonly cast: readonly CastMember[];
  readonly spaces: readonly RoomSpace[];
  readonly counters: {
    readonly documents: number;
    readonly upToDate: number;
    readonly openProposals: number;
    readonly openDiscrepancies: number;
    readonly stale: number;
  };
  readonly seal: Seal | null;
}

export interface ClaimResponse {
  readonly castId: string;
  readonly token: string;
  readonly cast: CastMember;
}

export const getRoom = (signal?: AbortSignal): Promise<RoomSnapshot> =>
  request<RoomSnapshot>('/api/room', { signal });

export const resetRoom = (auth: Auth): Promise<void> =>
  request<void>('/api/room/reset', { method: 'POST', body: {}, ...auth });

export const claimSeat = (
  castId: string,
  auth: Auth = {},
): Promise<ClaimResponse> =>
  request<ClaimResponse>(`/api/seats/${castId}/claim`, {
    method: 'POST',
    ...auth,
  });

export const releaseSeat = (castId: string, auth: Auth): Promise<void> =>
  request<void>(`/api/seats/${castId}`, { method: 'DELETE', ...auth });

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Correo',
  whatsapp: 'Chat',
  slack: 'Canal de equipo',
};

import { request } from './http';

export type AutodeskStatus = 'active' | 'reconnect_required';

export interface AutodeskConnection {
  readonly configured: boolean;
  readonly connection: {
    readonly status: AutodeskStatus;
    readonly autodeskUser: {
      readonly id: string;
      readonly email: string | null;
      readonly name: string | null;
    };
    readonly scopes: readonly string[];
    readonly connectedById: string | null;
    readonly connectedAt: string;
    readonly refreshedAt: string;
  } | null;
}

const base = (organizationId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/integrations/aps`;

export const getAutodeskConnection = (
  organizationId: string,
  signal?: AbortSignal,
) => request<AutodeskConnection>(base(organizationId), { signal });

export const authorizeAutodesk = (organizationId: string) =>
  request<{ url: string }>(`${base(organizationId)}/authorize`, {
    method: 'POST',
  });

export const disconnectAutodesk = (organizationId: string) =>
  request<void>(base(organizationId), { method: 'DELETE' });

const CALLBACK_ERRORS: Readonly<Record<string, string>> = {
  invalid_state:
    'La conexión con Autodesk venció o empezó en otro navegador. Vuelve a intentarlo.',
  access_denied: 'No autorizaste el acceso a Autodesk.',
  code_rejected: 'Autodesk rechazó la autorización. Vuelve a intentarlo.',
  aps_unavailable: 'Autodesk no respondió. Vuelve a intentarlo en un rato.',
};

export const callbackNotice = (
  params: URLSearchParams,
): { tone: 'success' | 'error'; text: string } | null => {
  const outcome = params.get('autodesk');
  if (outcome === 'conectada') {
    return { tone: 'success', text: 'Conectaste la cuenta de Autodesk.' };
  }
  if (outcome === 'error') {
    return {
      tone: 'error',
      text:
        CALLBACK_ERRORS[params.get('motivo') ?? ''] ??
        'No pudimos conectar la cuenta de Autodesk.',
    };
  }
  return null;
};

export const connectionSummary = (
  connection: AutodeskConnection['connection'],
): string => {
  if (!connection) return 'Sin conectar';
  const who =
    connection.autodeskUser.email ?? connection.autodeskUser.name ?? 'Autodesk';
  return connection.status === 'active'
    ? `Conectada como ${who}`
    : `Hay que volver a conectarla (${who})`;
};

import { describe, expect, it } from 'vitest';

import {
  type AutodeskConnection,
  callbackNotice,
  connectionSummary,
} from './autodesk-api';

const connection = (
  status: 'active' | 'reconnect_required',
  email: string | null,
): AutodeskConnection['connection'] => ({
  status,
  autodeskUser: { id: 'u1', email, name: 'Fernanda Soto' },
  scopes: ['data:read', 'account:read'],
  connectedById: 'user-1',
  connectedAt: '2026-11-21T00:00:00.000Z',
  refreshedAt: '2026-11-21T00:00:00.000Z',
});

describe('callbackNotice', () => {
  it('avisa cuando la cuenta quedó conectada', () => {
    expect(callbackNotice(new URLSearchParams('autodesk=conectada'))).toEqual({
      tone: 'success',
      text: 'Conectaste la cuenta de Autodesk.',
    });
  });

  it('explica el motivo cuando falla, con un texto por defecto', () => {
    expect(
      callbackNotice(
        new URLSearchParams('autodesk=error&motivo=access_denied'),
      ),
    ).toEqual({ tone: 'error', text: 'No autorizaste el acceso a Autodesk.' });
    expect(
      callbackNotice(new URLSearchParams('autodesk=error&motivo=otro'))?.text,
    ).toBe('No pudimos conectar la cuenta de Autodesk.');
  });

  it('no dice nada sin el parámetro', () => {
    expect(callbackNotice(new URLSearchParams(''))).toBeNull();
  });
});

describe('connectionSummary', () => {
  it('resume el estado de la conexión', () => {
    expect(connectionSummary(null)).toBe('Sin conectar');
    expect(connectionSummary(connection('active', 'admin@aromos.cl'))).toBe(
      'Conectada como admin@aromos.cl',
    );
    expect(connectionSummary(connection('reconnect_required', null))).toBe(
      'Hay que volver a conectarla (Fernanda Soto)',
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  checkFeedback,
  connectionFeedback,
  type GoogleStatus,
  linkFeedback,
  listeningText,
  type SourceView,
  sourceState,
} from './integrations-api';

const SOURCE: SourceView = {
  id: 's1',
  provider: 'google',
  title: 'Presupuesto Los Aromos',
  pointer: 'https://docs.google.com/spreadsheets/d/x/edit',
  checkedAt: '2026-11-21T10:00:00Z',
  changedAt: null,
  changedBy: null,
  createdAt: '2026-11-21T10:00:00Z',
  lastError: null,
  push: { active: false, expiresAt: null },
};

describe('connectionFeedback', () => {
  it('traduce la vuelta desde Google', () => {
    expect(connectionFeedback('conectado', null)).toEqual({
      tone: 'success',
      text: 'Conectamos tu cuenta de Google.',
    });
    expect(
      connectionFeedback('error', 'Cancelaste la conexión con Google'),
    ).toEqual({ tone: 'error', text: 'Cancelaste la conexión con Google' });
    expect(connectionFeedback('error', null)?.text).toBe(
      'Google no completó la conexión.',
    );
    expect(connectionFeedback(null, null)).toBeNull();
  });
});

describe('sourceState', () => {
  it('escucha, salvo que la última revisión haya fallado', () => {
    expect(sourceState(SOURCE)).toEqual({ tone: 'good', label: 'Escuchando' });
    expect(
      sourceState({
        ...SOURCE,
        lastError: { at: '2026-11-21T10:02:00Z', message: 'x' },
      }),
    ).toEqual({ tone: 'serious', label: 'Con error' });
  });
});

describe('listeningText', () => {
  const GOOGLE: GoogleStatus = {
    configured: true,
    connection: null,
    pollSeconds: 60,
    push: { enabled: false, reason: null, fallbackSeconds: null },
  };

  it('dice cómo nos enteramos de los cambios', () => {
    expect(
      listeningText({
        ...GOOGLE,
        push: { enabled: true, reason: null, fallbackSeconds: 600 },
      }),
    ).toBe('Google nos avisa al instante cuando alguien edita una planilla.');
    expect(listeningText(GOOGLE)).toBe(
      'Revisamos cada 60 s si las planillas cambiaron.',
    );
    expect(listeningText({ ...GOOGLE, pollSeconds: 0 })).toBe(
      'La revisión automática está apagada: usa «Revisar ahora».',
    );
  });
});

describe('avisos', () => {
  it('el tono de la revisión sigue su resultado', () => {
    const response = (status: 'changed' | 'unchanged' | 'failed') => ({
      source: SOURCE,
      check: { status, message: 'La planilla cambió: 1 celda', cells: 1 },
    });
    expect(checkFeedback(response('changed'))).toEqual({
      tone: 'success',
      text: '«Presupuesto Los Aromos»: La planilla cambió: 1 celda.',
    });
    expect(checkFeedback(response('unchanged')).tone).toBe('info');
    expect(checkFeedback(response('failed')).tone).toBe('error');
  });

  it('al vincular dice cada cuánto revisamos', () => {
    expect(linkFeedback(SOURCE, 60).text).toBe(
      'Vinculamos «Presupuesto Los Aromos». Revisamos cada 60 s si cambia.',
    );
    expect(linkFeedback(SOURCE, 0).text).toMatch(/Revisar ahora/);
  });
});

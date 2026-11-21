import { describe, expect, it } from 'vitest';

import {
  connectionFeedback,
  type SourceView,
  sourceState,
  syncFeedback,
} from './integrations-api';

const SOURCE: SourceView = {
  id: 's1',
  provider: 'google',
  documentId: 'presupuesto',
  documentName: 'Presupuesto itemizado',
  spaceName: 'Carpeta de costos',
  title: 'Presupuesto Los Aromos',
  pointer: 'https://docs.google.com/spreadsheets/d/x/edit',
  checkedAt: null,
  createdAt: '2026-11-21T10:00:00Z',
  lastRead: null,
  lastError: null,
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
  it('el error manda sobre la última lectura', () => {
    expect(sourceState(SOURCE)).toEqual({
      tone: 'neutral',
      label: 'Sin leer todavía',
    });
    const read = {
      ...SOURCE,
      lastRead: {
        at: '2026-11-21T10:01:00Z',
        label: 'Sheets 21-11 07:01:00',
        ignored: [],
      },
    };
    expect(sourceState(read).label).toBe('Al día');
    expect(
      sourceState({
        ...read,
        lastError: { at: '2026-11-21T10:02:00Z', message: 'x' },
      }),
    ).toEqual({ tone: 'serious', label: 'Con error' });
  });
});

describe('syncFeedback', () => {
  it('el tono sigue el resultado de la lectura', () => {
    const response = (status: 'ingested' | 'failed' | 'waiting') => ({
      source: SOURCE,
      sync: { status, message: 'm', revisionId: null, proposals: 0 },
    });
    expect(syncFeedback(response('ingested')).tone).toBe('success');
    expect(syncFeedback(response('waiting')).tone).toBe('info');
    expect(syncFeedback(response('failed')).tone).toBe('error');
  });
});

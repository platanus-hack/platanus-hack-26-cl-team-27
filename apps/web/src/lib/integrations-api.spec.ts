import { describe, expect, it } from 'vitest';

import {
  checkFeedback,
  connectionFeedback,
  connectorsHref,
  linkFeedback,
  pickProject,
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

describe('pickProject', () => {
  const PROJECTS = [{ id: 'los-aromos' }, { id: 'torre' }];

  it('toma el proyecto pedido si es de la persona', () => {
    expect(pickProject(PROJECTS, 'torre')).toEqual({ id: 'torre' });
  });

  it('si no lo pidió o no es suyo, toma el primero', () => {
    expect(pickProject(PROJECTS, null)).toEqual({ id: 'los-aromos' });
    expect(pickProject(PROJECTS, 'ajeno')).toEqual({ id: 'los-aromos' });
    expect(pickProject([], 'torre')).toBeNull();
  });

  it('el link a los conectores lleva el proyecto', () => {
    expect(connectorsHref('los aromos')).toBe(
      '/conectores?proyecto=los+aromos',
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

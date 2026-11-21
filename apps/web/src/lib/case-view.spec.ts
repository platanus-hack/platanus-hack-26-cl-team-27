import { describe, expect, it } from 'vitest';

import { authorTimeline, sentText } from './case-view.ts';
import type { FlowState } from './flow-api.ts';

const base = {
  epoch: 1,
  case: { id: 'p12-bandeja', title: 'Caso', level: 'Nivel 3', axis: 'Eje B-6' },
  elements: [],
  change: null,
  clash: null,
  proposal: null,
  presence: [],
} as unknown as FlowState;

const withChange = {
  ...base,
  change: {
    elementId: 'P-12',
    summary:
      'Cambio enviado: P-12 se movió 40 cm al norte (Nivel 3, eje B-6). Vigente encontró 1 equipo afectado: Instalaciones eléctricas (Camila Vera).',
  },
  clash: { status: 'detectada' },
} as unknown as FlowState;

describe('author timeline', () => {
  it('starts with the pending send', () => {
    expect(authorTimeline(base).map((step) => step.id)).toEqual(['sent']);
  });

  it('writes the sent text', () => {
    expect(sentText(withChange)).toBe(
      'Cambio enviado: P-12 se movió 40 cm al norte (Nivel 3, eje B-6). Vigente encontró 1 equipo afectado: Instalaciones eléctricas (Camila Vera).',
    );
  });

  it('waits for Camila, then shows she is reviewing', () => {
    expect(authorTimeline(withChange).at(-1)?.label).toBe(
      'Esperando a Camila…',
    );
    const reviewing = {
      ...withChange,
      presence: [{ castId: 'camila-vera', online: true, viewing: 'propuesta' }],
    } as unknown as FlowState;
    expect(authorTimeline(reviewing).at(-1)?.label).toBe(
      'Camila está revisando tu cambio',
    );
  });

  it('closes with the resolution or the problem', () => {
    const rejected = {
      ...withChange,
      proposal: {
        status: 'rechazada',
        decidedByName: 'Camila Vera',
        rejectReason: 'hay una viga',
      },
    } as unknown as FlowState;
    const last = authorTimeline(rejected).at(-1);
    expect(last?.state).toBe('problem');
    expect(last?.label).toContain('hay una viga');
    const resolved = {
      ...withChange,
      proposal: {
        status: 'resuelta',
        decidedByName: 'Camila Vera',
        resolvedText: 'Resuelto por Camila Vera a las 19:02',
      },
    } as unknown as FlowState;
    expect(authorTimeline(resolved).at(-1)?.label).toBe(
      'Resuelto por Camila Vera a las 19:02',
    );
  });
});

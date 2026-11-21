import { describe, expect, it } from 'vitest';

import { approvalText, historyKey, pendingText } from './flow-history';
import type { FlowState } from './flow-api';

describe('flow-history', () => {
  it('arma el texto de aprobación con la hora', () => {
    const at = new Date(2026, 10, 21, 18, 32, 10).toISOString();
    expect(approvalText([{ id: 'camila-vera', name: 'Camila Vera', at }])).toBe(
      'Aprobó Camila Vera a las 18:32',
    );
    expect(approvalText([])).toBeNull();
  });

  it('describe lo pendiente según quién mira', () => {
    const pending = {
      value: 'x',
      by: { id: 'paula-rojas', name: 'Paula Rojas' },
      at: '2026-11-21T21:00:00.000Z',
      status: 'propuesta' as const,
      awaiting: [{ id: 'camila-vera', name: 'Camila Vera' }],
      text: 'Pendiente de Camila Vera',
    };
    expect(pendingText(pending, 'camila-vera')).toBe(
      'Pendiente de tu respuesta',
    );
    expect(pendingText(pending, null)).toBe('Pendiente de Camila Vera');
    expect(
      pendingText({ ...pending, status: 'rechazada', reason: 'Choca' }, null),
    ).toBe('Rechazada: Choca');
  });

  it('la clave cambia con época, estado y minuta', () => {
    const flow = {
      epoch: 2,
      proposal: { status: 'propuesta' },
      change: { minuteId: 'm1' },
    } as unknown as FlowState;
    expect(historyKey(flow)).toBe('2:propuesta:m1');
    expect(
      historyKey({
        epoch: 1,
        proposal: null,
        change: null,
      } as unknown as FlowState),
    ).toBe('1:none:');
  });
});

import type { SourceLink } from '@team27/context-integrations';

import {
  describeChange,
  LoggingChangeListener,
} from '../../../src/modules/integrations/change-log.ts';
import {
  OAuthStates,
  STATE_TTL_MS,
} from '../../../src/modules/integrations/oauth-states.ts';

const SOURCE = {
  id: 's1',
  title: 'Presupuesto Los Aromos',
} as SourceLink;

const AT = new Date('2026-11-21T21:05:12Z');

describe('describeChange', () => {
  it('cuenta las celdas y muestra el antes y el después', () => {
    expect(
      describeChange({
        source: SOURCE,
        at: AT,
        cells: [
          { locator: 'Partidas!C2', before: 145000, after: 150000 },
          { locator: 'Partidas!B3', before: 'Acero', after: null },
        ],
      }),
    ).toBe(
      '«Presupuesto Los Aromos» cambió: 2 celdas. Partidas!C2: 145000 → 150000; Partidas!B3: "Acero" → (vacía)',
    );
  });

  it('muestra hasta 10 celdas y cuenta el resto', () => {
    const cells = Array.from({ length: 12 }, (_, index) => ({
      locator: `Hoja!A${index + 1}`,
      before: null,
      after: index,
    }));
    expect(describeChange({ source: SOURCE, at: AT, cells })).toMatch(
      /12 celdas\. .*Hoja!A10: \(vacía\) → 9 y 2 más$/,
    );
  });

  it('sin la revisión anterior, avisa el cambio sin detalle', () => {
    expect(describeChange({ source: SOURCE, at: AT, cells: null })).toBe(
      '«Presupuesto Los Aromos» cambió; no tenemos la revisión anterior para el detalle',
    );
  });

  it('el listener lo deja en el log y no lo guarda', async () => {
    const log = vi.fn();
    await new LoggingChangeListener({ log }).changed({
      source: SOURCE,
      at: AT,
      cells: [{ locator: 'Partidas!C2', before: 145000, after: 150000 }],
    });
    expect(log).toHaveBeenCalledWith(
      '«Presupuesto Los Aromos» cambió: 1 celda. Partidas!C2: 145000 → 150000',
    );
  });
});

describe('OAuthStates', () => {
  it('un estado sirve una vez, vence y recuerda quién conecta', () => {
    let now = 0;
    const states = new OAuthStates(() => now);
    const owner = { userId: 'u1', projectId: 'los-aromos' };
    const first = states.issue(owner);
    const second = states.issue({ userId: 'u2', projectId: null });

    expect(states.consume(first)).toEqual(owner);
    expect(states.consume(first)).toBeNull();
    expect(states.consume(undefined)).toBeNull();
    now = STATE_TTL_MS + 1;
    expect(states.consume(second)).toBeNull();
  });
});

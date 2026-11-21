import {
  BOT_DELAY_MS,
  delayFor,
  planVote,
  REAPPROVAL_DELAY_MS,
  scaled,
} from '../../src/scenario/bots.ts';
import { LOS_AROMOS } from '../../src/scenario/los-aromos.ts';

describe('bots', () => {
  it('cada integrante del elenco tiene su retardo', () => {
    for (const member of LOS_AROMOS.cast) {
      expect(BOT_DELAY_MS[member.id]).toBeGreaterThan(0);
    }
    expect(delayFor('paula-rojas')).toBe(2500);
    expect(delayFor('tomas-reyes')).toBe(6000);
  });

  it('el retardo se divide por la velocidad', () => {
    expect(scaled(3000, 1)).toBe(3000);
    expect(scaled(3000, 4)).toBe(750);
  });

  it('Paula disputa la losa y aprueba tras la reapertura', () => {
    const first = planVote({
      castId: 'paula-rojas',
      subjectId: 'losa-n3',
      round: 0,
    });
    const second = planVote({
      castId: 'paula-rojas',
      subjectId: 'losa-n3',
      round: 1,
    });
    expect(first).toMatchObject({ kind: 'issue', delayMs: 2500 });
    expect(first.note).toContain('Necesito 2 días');
    expect(second).toMatchObject({
      kind: 'reviewed',
      delayMs: REAPPROVAL_DELAY_MS,
      note: 'Recalculado, queda conforme',
    });
  });

  it('Javier disputa el shaft y aprueba tras la reapertura', () => {
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'shaft-s1', round: 0 }),
    ).toMatchObject({ kind: 'issue' });
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'shaft-s1', round: 1 }),
    ).toMatchObject({ kind: 'reviewed' });
  });

  it('los demás aprueban siempre, y Paula aprueba lo que no es la losa', () => {
    for (const member of LOS_AROMOS.stakeholders) {
      expect(
        planVote({ castId: member.id, subjectId: 'ventanas-norte', round: 0 })
          .kind,
      ).toBe('reviewed');
    }
    expect(
      planVote({ castId: 'paula-rojas', subjectId: 'shaft-s1', round: 0 }).kind,
    ).toBe('reviewed');
  });
});

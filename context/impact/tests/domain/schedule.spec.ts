import { criticalPath } from '../../src/domain/schedule.ts';

describe('criticalPath', () => {
  it('calcula el plazo total y la holgura de cada tarea', () => {
    const schedule = criticalPath([
      { id: 'a', days: 5, predecessors: [] },
      { id: 'b', days: 3, predecessors: ['a'] },
      { id: 'c', days: 1, predecessors: ['a'] },
      { id: 'd', days: 2, predecessors: ['b', 'c'] },
    ]);

    expect(schedule.projectDays).toBe(10);
    expect(schedule.timings.get('b')).toEqual({
      earlyStart: 5,
      earlyFinish: 8,
      floatDays: 0,
      critical: true,
    });
    expect(schedule.timings.get('c')).toEqual({
      earlyStart: 5,
      earlyFinish: 6,
      floatDays: 2,
      critical: false,
    });
  });

  it('rechaza dependencias circulares', () => {
    expect(() =>
      criticalPath([
        { id: 'a', days: 1, predecessors: ['b'] },
        { id: 'b', days: 1, predecessors: ['a'] },
      ]),
    ).toThrow('depende de sí misma');
  });
});

import { describe, expect, it } from 'vitest';

import type { Discipline } from './aps-api';
import {
  groupByDiscipline,
  pick3dView,
  primaryDiscipline,
  selectionFromEvent,
  type ViewerModelHandle,
} from './aps-viewer';

describe('pick3dView', () => {
  it('prefiere la última vista maestra, después {3D} y después la primera', () => {
    const plain = { data: { name: 'Corte' } };
    const default3d = { data: { name: '{3D}' } };
    const existing = { data: { name: 'Existing', isMasterView: true } };
    const master = { data: { name: 'New Construction', isMasterView: true } };
    expect(pick3dView([plain, existing, default3d, master])).toBe(master);
    expect(pick3dView([plain, default3d])).toBe(default3d);
    expect(pick3dView([plain])).toBe(plain);
    expect(pick3dView([])).toBeNull();
  });
});

describe('groupByDiscipline', () => {
  it('agrupa los dbId por disciplina', () => {
    expect(
      groupByDiscipline([
        { discipline: 'structural', dbId: 1 },
        { discipline: 'hvac', dbId: 2 },
        { discipline: 'structural', dbId: 3 },
      ]),
    ).toEqual(
      new Map([
        ['structural', [1, 3]],
        ['hvac', [2]],
      ]),
    );
  });
});

describe('selectionFromEvent', () => {
  it('traduce la selección del visor a elementos por disciplina', () => {
    const arch = {} as ViewerModelHandle;
    const mep = {} as ViewerModelHandle;
    const models = new Map<Discipline, ViewerModelHandle>([
      ['architectural', arch],
      ['plumbing', mep],
    ]);
    expect(
      selectionFromEvent(
        {
          selections: [
            { model: mep, dbIdArray: [7] },
            { model: arch, dbIdArray: [4, 5] },
          ],
        },
        models,
      ),
    ).toEqual([
      { discipline: 'plumbing', dbId: 7 },
      { discipline: 'architectural', dbId: 4 },
      { discipline: 'architectural', dbId: 5 },
    ]);
    expect(selectionFromEvent({}, models)).toEqual([]);
  });
});

describe('primaryDiscipline', () => {
  it('parte por arquitectura y, si no está, por el primer modelo', () => {
    expect(primaryDiscipline(['site', 'architectural', 'hvac'])).toBe(
      'architectural',
    );
    expect(primaryDiscipline(['hvac', 'site'])).toBe('hvac');
    expect(primaryDiscipline([])).toBeNull();
  });
});

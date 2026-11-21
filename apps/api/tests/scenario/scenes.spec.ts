import { FIXTURES } from '../../src/scenario/documents.ts';
import {
  AUTOPLAY_CHAIN,
  findScene,
  fixturesOf,
  SCENES,
  sceneProgress,
  unmetRequirement,
} from '../../src/scenario/scenes.ts';

describe('escenas', () => {
  it('cubren cada fixture una sola vez y el autoplay las encadena todas', () => {
    const ids = SCENES.flatMap((scene) => scene.fixtureIds);
    expect([...ids].sort()).toEqual(FIXTURES.map((item) => item.id).sort());
    expect([...AUTOPLAY_CHAIN].sort()).toEqual(
      SCENES.map((scene) => scene.id).sort(),
    );
  });

  it('el orden del autoplay respeta las precondiciones de cada fixture', () => {
    const dropped = new Set<string>();
    const has = (documentId: string, label: string) =>
      dropped.has(`${documentId}:${label}`) ||
      FIXTURES.every(
        (item) => item.documentId !== documentId || item.label !== label,
      );
    for (const sceneId of AUTOPLAY_CHAIN) {
      const scene = findScene(sceneId);
      for (const fixture of scene ? fixturesOf(scene) : []) {
        expect(unmetRequirement(fixture, has)).toBeNull();
        dropped.add(`${fixture.documentId}:${fixture.label}`);
      }
    }
  });

  it('el progreso de una escena se completa al soltar sus documentos', () => {
    const scene = findScene('s6');
    expect(scene).toBeDefined();
    if (!scene) return;
    expect(sceneProgress(scene, () => false)).toMatchObject({
      complete: false,
    });
    expect(sceneProgress(scene, () => true)).toEqual({
      remaining: [],
      complete: true,
    });
  });

  it('las escenas extra son x1 y x2', () => {
    expect(
      SCENES.filter((scene) => scene.extra).map((scene) => scene.id),
    ).toEqual(['x1', 'x2']);
  });
});

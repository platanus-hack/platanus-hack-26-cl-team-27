import {
  FixtureFactExtractor,
  fixtureKey,
} from '../../src/infra/adapters/FixtureFactExtractor.ts';
import { afirma, draftOf } from '../scenario.ts';

describe('FixtureFactExtractor', () => {
  const extractor = new FixtureFactExtractor({
    [fixtureKey('e102', 'rev C')]: [afirma('losa-n3', 'espesor_cm', 20)],
  });

  it('entrega los hechos escritos a mano de la revisión del catálogo', async () => {
    expect(await extractor.extract(draftOf('e102', 'rev C', 'plano'))).toEqual([
      afirma('losa-n3', 'espesor_cm', 20),
    ]);
  });

  it('una revisión fuera del catálogo no tiene hechos', async () => {
    expect(await extractor.extract(draftOf('x', 'rev A', 'plano'))).toEqual([]);
  });
});

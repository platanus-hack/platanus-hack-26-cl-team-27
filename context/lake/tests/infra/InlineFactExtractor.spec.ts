import type { FactExtractor } from '../../src/application/ports/FactExtractor.ts';
import { InlineFactExtractor } from '../../src/infra/adapters/InlineFactExtractor.ts';
import { afirma, draftOf } from '../scenario.ts';

describe('InlineFactExtractor', () => {
  const claims = [afirma('losa-n3', 'espesor_cm', 20)];
  const extractor: FactExtractor = new InlineFactExtractor(claims);

  it('entrega los hechos que ya trae la revisión, sea cual sea', async () => {
    expect(await extractor.extract(draftOf('e102', 'rev C', 'plano'))).toEqual(
      claims,
    );
    expect(await extractor.extract(draftOf('x', 'rev A', 'plano'))).toEqual(
      claims,
    );
  });

  it('entrega una copia: quien la recibe no altera los hechos', async () => {
    const first = await extractor.extract(draftOf('x', 'rev A', 'plano'));
    first.pop();

    expect(await extractor.extract(draftOf('x', 'rev A', 'plano'))).toEqual(
      claims,
    );
  });
});

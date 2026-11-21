import { ValidationError } from '../../src/application/errors.ts';
import type { ClaimReader } from '../../src/application/ports/ClaimReader.ts';
import { ExtractClaims } from '../../src/application/use-cases/ExtractClaims.ts';
import type { TextEvidence } from '../../src/domain/Evidence.ts';
import type { ClaimCandidate } from '../../src/domain/ExtractedClaim.ts';
import { vocabulary } from '../support.ts';

const message: TextEvidence = {
  kind: 'text',
  source: 'mensaje',
  title: 'WhatsApp Obra Los Aromos, 14:02',
  text: 'Las ventanas del norte quedaron en 150',
};

const candidate: ClaimCandidate = {
  subject: 'ventanas-norte',
  attribute: 'ancho_cm',
  value: 150,
  unit: 'cm',
  role: 'afirma',
  locator: '«quedaron en 150»',
  confidence: 0.65,
};

const setup = (claims: ClaimCandidate[] = [candidate]) => {
  const reader = {
    read: vi.fn<ClaimReader['read']>(() => Promise.resolve(claims)),
  };
  return { reader, useCase: new ExtractClaims(reader) };
};

describe('ExtractClaims', () => {
  it('lee la evidencia y filtra por la confianza mínima por defecto (0,7)', async () => {
    const { reader, useCase } = setup();

    const result = await useCase.execute({ evidence: message, vocabulary });

    expect(reader.read).toHaveBeenCalledWith({ evidence: message, vocabulary });
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.reason).toBe(
      'Confianza 0,65, bajo el mínimo de 0,70',
    );
  });

  it('acepta con una confianza mínima más baja', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({
      evidence: message,
      vocabulary,
      minConfidence: 0.6,
    });

    expect(result.accepted).toEqual([candidate]);
  });

  it('no consulta si la evidencia está vacía', async () => {
    const { reader, useCase } = setup();

    await expect(
      useCase.execute({ evidence: { ...message, text: '  ' }, vocabulary }),
    ).rejects.toThrow(ValidationError);
    expect(reader.read).not.toHaveBeenCalled();
  });
});

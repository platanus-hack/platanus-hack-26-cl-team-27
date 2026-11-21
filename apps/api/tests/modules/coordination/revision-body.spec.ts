import {
  checkAuthor,
  checkRevision,
  knownDocument,
  revisionBody,
  seedBody,
} from '../../../src/modules/coordination/revision-body.ts';

const valid = {
  documentId: 'e102',
  label: 'rev C',
  spaceId: 'drive-proyecto',
  pointer: 'Drive/Los Aromos/Estructura/E-102_revC.pdf',
  claims: [
    {
      subject: 'losa-n3',
      attribute: 'espesor_cm',
      value: 20,
      unit: 'cm',
      role: 'afirma',
      locator: 'cuadro de losas rev C',
    },
  ],
};

const parse = (overrides: Record<string, unknown> = {}) =>
  revisionBody.parse({ ...valid, ...overrides });

const issuesOf = (overrides: Record<string, unknown>): string[] => {
  const input = parse(overrides);
  try {
    checkRevision(input, knownDocument(input.documentId));
  } catch (error) {
    return (error as { response: { issues: string[] } }).response.issues;
  }
  return [];
};

describe('cuerpo de una revisión', () => {
  it('acepta una revisión válida y devuelve sus hechos', () => {
    const input = parse();

    expect(checkRevision(input, knownDocument('e102'))).toEqual(input.claims);
  });

  it('exige hechos, un hash sha256 válido y roles conocidos', () => {
    expect(revisionBody.safeParse({ ...valid, claims: [] }).success).toBe(
      false,
    );
    expect(
      revisionBody.safeParse({ ...valid, contentHash: 'abc' }).success,
    ).toBe(false);
    expect(
      revisionBody.safeParse({
        ...valid,
        claims: [{ ...valid.claims[0], role: 'dice' }],
      }).success,
    ).toBe(false);
  });

  it('rechaza un documento que el proyecto no tiene con 404', () => {
    expect(() => knownDocument('nada')).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('rechaza con 422 un espacio distinto al del documento', () => {
    const input = parse({ spaceId: 'whatsapp-obra' });

    expect(() => checkRevision(input, knownDocument('e102'))).toThrow(
      expect.objectContaining({
        status: 422,
        response: expect.objectContaining({ code: 'invalid_claims' }),
      }),
    );
  });

  it('lista los sujetos y atributos desconocidos', () => {
    const issues = issuesOf({
      claims: [
        { ...valid.claims[0], subject: 'torre' },
        { ...valid.claims[0], attribute: 'color' },
      ],
    });

    expect(issues).toEqual([
      'claims[0]: no existe el sujeto torre',
      'claims[1]: no existe el atributo color',
    ]);
  });

  it('la carga inicial pide el autor y que sea del elenco', () => {
    expect(seedBody.safeParse({ revisions: [valid] }).success).toBe(false);
    expect(
      seedBody.safeParse({
        revisions: [{ ...valid, authorId: 'fernanda-lagos' }],
      }).success,
    ).toBe(true);
    expect(() => checkAuthor('nadie')).toThrow(
      expect.objectContaining({ status: 422 }),
    );
    expect(() => checkAuthor('fernanda-lagos')).not.toThrow();
  });
});

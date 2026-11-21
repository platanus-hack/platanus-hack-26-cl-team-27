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
  it('acepta una revisión válida y devuelve sus hechos como un fragmento implícito', () => {
    const input = parse();

    expect(checkRevision(input, knownDocument('e102'))).toEqual([
      {
        locator: 'cuadro de losas rev C',
        kind: 'fila',
        claims: input.claims,
      },
    ]);
  });

  it('el fragmento implícito agrupa los hechos que comparten localizador', () => {
    const input = parse({
      claims: [
        valid.claims[0],
        { ...valid.claims[0], attribute: 'ancho_cm' },
        { ...valid.claims[0], locator: 'otro cuadro' },
      ],
    });

    expect(
      checkRevision(input, knownDocument('e102')).map((chunk) => [
        chunk.locator,
        chunk.claims?.length,
      ]),
    ).toEqual([
      ['cuadro de losas rev C', 2],
      ['otro cuadro', 1],
    ]);
  });

  it('acepta fragmentos estructurados y de texto libre', () => {
    const input = parse({
      claims: undefined,
      chunks: [
        {
          locator: 'cuadro de losas · Losa nivel 3',
          kind: 'fila',
          claims: [{ ...valid.claims[0], locator: undefined }],
        },
        { locator: 'folio 44', kind: 'anotacion', text: 'El shaft se corre.' },
      ],
    });

    const chunks = checkRevision(input, knownDocument('e102'));
    expect(
      chunks.map((chunk) => [chunk.kind, chunk.text, chunk.claims?.length]),
    ).toEqual([
      ['fila', undefined, 1],
      ['anotacion', 'El shaft se corre.', undefined],
    ]);
    expect(chunks[0]?.claims?.[0]?.locator).toBe(
      'cuadro de losas · Losa nivel 3',
    );
  });

  it('un fragmento necesita texto o hechos y un tipo conocido', () => {
    expect(
      revisionBody.safeParse({
        ...valid,
        claims: undefined,
        chunks: [{ locator: 'a', kind: 'fila' }],
      }).success,
    ).toBe(false);
    expect(
      revisionBody.safeParse({
        ...valid,
        claims: undefined,
        chunks: [{ locator: 'a', kind: 'otro', text: 'hola' }],
      }).success,
    ).toBe(false);
    expect(
      revisionBody.safeParse({
        ...valid,
        claims: undefined,
        chunks: [{ locator: 'a', kind: 'mensaje', text: '   ' }],
      }).success,
    ).toBe(false);
  });

  it('exige al menos un fragmento, un hash sha256 válido y roles conocidos', () => {
    expect(revisionBody.safeParse({ ...valid, claims: [] }).success).toBe(
      false,
    );
    expect(
      revisionBody.safeParse({ ...valid, claims: [], chunks: [] }).success,
    ).toBe(false);
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
        { ...valid.claims[0], attribute: 'color', locator: 'otro' },
      ],
    });

    expect(issues).toEqual([
      'chunks[0]: no existe el sujeto torre',
      'chunks[1]: no existe el atributo color',
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

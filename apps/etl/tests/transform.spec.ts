import { claimsOf } from '../src/load/index.ts';
import { readLake } from '../src/pipeline.ts';
import { transformFile } from '../src/transform/index.ts';
import { parseNumber, subjectOf } from '../src/vocabulary.ts';
import { ParseError, type RawFile } from '../src/types.ts';

const lake = readLake();

const base = (kind: RawFile['kind'], text: string): RawFile => ({
  folder: 'f',
  spaceId: 's',
  name: 'x',
  relativePath: 'f/x',
  kind,
  pointer: 'p',
  text,
  sha256: 'h',
});

describe('vocabulario', () => {
  it('mapea nombres a sujetos', () => {
    expect(subjectOf('Losa nivel 3')).toBe('losa-n3');
    expect(subjectOf('losa del nivel 2')).toBe('losa-n2');
    expect(subjectOf('Losa de cubierta')).toBe('losa-cubierta');
    expect(subjectOf('Shaft de instalaciones S1')).toBe('shaft-s1');
    expect(subjectOf('las ventanas del norte')).toBe('ventanas-norte');
    expect(subjectOf('Ventana corredera fachada norte')).toBe('ventanas-norte');
    expect(subjectOf('Pintura interior')).toBeNull();
  });

  it('lee números a la chilena', () => {
    expect(parseNumber('145.000')).toBe(145000);
    expect(parseNumber('8,5')).toBe(8.5);
    expect(parseNumber('1.350')).toBe(1350);
    expect(parseNumber('6,0')).toBe(6);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('parsers', () => {
  it('cada archivo del lago produce una revisión con sha256 del contenido', () => {
    expect(lake).toHaveLength(20);
    expect(new Set(lake.map((item) => item.file.sha256)).size).toBe(20);
  });

  it('el mismo archivo da siempre el mismo resultado', () => {
    for (const item of lake) {
      expect(transformFile(item.file)).toEqual(item.revision);
    }
  });

  it('el presupuesto v3 no declara las ventanas en la celda F17', () => {
    const v3 = lake.find(
      (item) => item.file.name === 'Presupuesto_itemizado_v3.csv',
    )!;
    expect(
      claimsOf(v3.revision).some((claim) => claim.locator === 'Partidas!F17'),
    ).toBe(false);
  });

  it('la cotización rev 1 no confirma el ancho de fabricación', () => {
    const rev1 = lake.find((item) => item.file.name === 'Q-118_rev1.csv')!;
    expect(claimsOf(rev1.revision).map((claim) => claim.role)).toEqual([
      'afirma',
      'usa',
    ]);
  });

  it('rechaza archivos mal formados con el nombre del archivo', () => {
    expect(() => transformFile(base('plano', '{no es json'))).toThrow(
      ParseError,
    );
    expect(() =>
      transformFile(base('plano', '{"rotulo":{},"cuadros":[]}')),
    ).toThrow(/documento desconocido/);
    expect(() => transformFile(base('eett', 'sin encabezado'))).toThrow(
      /encabezado/,
    );
    expect(() => transformFile(base('presupuesto', 'a;b'))).toThrow(/Código/);
    expect(() => transformFile(base('whatsapp', 'sin mensajes'))).toThrow(
      /mensajes/,
    );
    expect(() => transformFile(base('libro', 'sin folio'))).toThrow(/FOLIO/);
    expect(() => transformFile(base('acta', 'sin título'))).toThrow(/ACTA/);
  });

  it('la exportación de WhatsApp toma el último mensaje como autor y cuenta los mensajes', () => {
    const chat = base(
      'whatsapp',
      [
        '[01-01-2026 09:00:00] Marcos Fuentes: hola',
        'segunda línea del mismo mensaje',
        '[01-01-2026 10:15:00] Paula Rojas: ok',
      ].join('\n'),
    );
    const revision = transformFile(chat);
    expect(revision.label).toBe('mensaje 2');
    expect(revision.authorId).toBe('paula-rojas');
    expect(claimsOf(revision)).toEqual([]);
    expect(revision.chunks.map((chunk) => chunk.text)).toEqual([
      'hola segunda línea del mismo mensaje',
      'ok',
    ]);
  });

  it('IS-301 da el colector B2 con su posición y su localizador', () => {
    const revA = lake.find((item) => item.file.name === 'IS-301_revA.json')!;
    const revB = lake.find((item) => item.file.name === 'IS-301_revB.json')!;
    expect(revA.revision.documentId).toBe('is301');
    expect(revA.revision.authorId).toBe('javier-munoz');
    expect(revA.revision.label).toBe('rev A');
    expect(claimsOf(revA.revision)).toEqual([
      {
        subject: 'colector-b2',
        attribute: 'posicion_m',
        value: 10,
        unit: 'm',
        role: 'afirma',
        locator: 'cuadro de colectores nivel 3 rev A · Colector B2',
      },
    ]);
    expect(claimsOf(revB.revision).map((claim) => claim.value)).toEqual([13.5]);
    expect(revB.revision.chunks).toHaveLength(1);
    expect(revB.revision.chunks[0]?.kind).toBe('fila');
  });
});

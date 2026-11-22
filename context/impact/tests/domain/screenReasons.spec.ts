import {
  MAX_REASON_LENGTH,
  type ReasonRecipient,
  screenReasons,
} from '../../src/domain/NoticeReason.ts';

const recipients: ReasonRecipient[] = [
  {
    stakeholderId: 'calculista',
    name: 'Paula Rojas',
    role: 'Ingeniera calculista',
    findings: ['Peso propio: 3,75 → 5 kN/m² (+1,25)'],
  },
  {
    stakeholderId: 'costos',
    name: 'Daniela Soto',
    role: 'Costos',
    findings: ['El presupuesto sube $3.636.500'],
  },
];

const source = 'Losa nivel 3 (modified) · Espesor: 15 → 20 cm';

describe('screenReasons', () => {
  it('acepta una frase por persona avisada, limpia de espacios', () => {
    expect(
      screenReasons(
        [
          {
            stakeholderId: 'calculista',
            why: '  Tus vigas sostienen\n la losa del nivel 3.  ',
          },
          {
            stakeholderId: 'costos',
            why: 'El hormigón de la losa es partida tuya.',
          },
        ],
        recipients,
        source,
      ),
    ).toEqual([
      {
        stakeholderId: 'calculista',
        why: 'Tus vigas sostienen la losa del nivel 3.',
      },
      {
        stakeholderId: 'costos',
        why: 'El hormigón de la losa es partida tuya.',
      },
    ]);
  });

  it('descarta a quien no fue avisado, las frases vacías y las repetidas', () => {
    expect(
      screenReasons(
        [
          { stakeholderId: 'inventado', why: 'Te toca.' },
          { stakeholderId: 'costos', why: '   ' },
          { stakeholderId: 'calculista', why: 'Primera.' },
          { stakeholderId: 'calculista', why: 'Segunda.' },
        ],
        recipients,
        source,
      ),
    ).toEqual([{ stakeholderId: 'calculista', why: 'Primera.' }]);
  });

  it('descarta la frase que trae una cifra que no estaba en el aviso', () => {
    expect(
      screenReasons(
        [
          {
            stakeholderId: 'costos',
            why: 'El presupuesto sube $4.000.000 y lo llevas tú.',
          },
          {
            stakeholderId: 'calculista',
            why: 'El espesor pasa de 15 a 20 cm y carga tus vigas del nivel 3.',
          },
        ],
        recipients,
        source,
      ),
    ).toEqual([
      {
        stakeholderId: 'calculista',
        why: 'El espesor pasa de 15 a 20 cm y carga tus vigas del nivel 3.',
      },
    ]);
  });

  it('descarta la frase demasiado larga', () => {
    expect(
      screenReasons(
        [{ stakeholderId: 'costos', why: 'x'.repeat(MAX_REASON_LENGTH + 1) }],
        recipients,
        source,
      ),
    ).toEqual([]);
  });
});

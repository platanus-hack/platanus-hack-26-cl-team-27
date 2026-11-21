import type { ClaimFixture } from '@team27/context-impact/adapters';

const SAMPLE_CONFIDENCE = 0.9;

const claim = (
  subject: string,
  attribute: string,
  value: number,
  unit: string,
  locator: string,
) => ({
  subject,
  attribute,
  value,
  unit,
  role: 'afirma' as const,
  locator,
  confidence: SAMPLE_CONFIDENCE,
});

export const SAMPLE_CLAIM_FIXTURES: readonly ClaimFixture[] = [
  {
    title: 'Mensajes de WhatsApp mensaje 1',
    textIncludes: 'hormigonamos la losa del nivel 2',
    claims: [],
  },
  {
    title: 'Mensajes de WhatsApp mensaje 2',
    textIncludes: 'hormigonamos la losa del nivel 2',
    claims: [],
  },
  {
    title: 'Mensajes de WhatsApp mensaje 2',
    textIncludes: 'ventanas del norte quedaron en 150',
    claims: [
      claim('ventanas-norte', 'ancho_cm', 150, 'cm', 'mensaje de las 14:32'),
    ],
  },
  {
    title: 'Libro de obra folio 41',
    textIncludes: 'replanteado a 6,0 m',
    claims: [claim('shaft-s1', 'posicion_m', 6, 'm', 'folio 41')],
  },
  {
    title: 'Libro de obra folio 44',
    textIncludes: 'se corre a 8,5 m',
    claims: [claim('shaft-s1', 'posicion_m', 8.5, 'm', 'folio 44')],
  },
  {
    title: 'Acta de coordinación N° 12',
    textIncludes: '108 días',
    claims: [claim('proyecto', 'entrega_dias', 108, 'días', 'acuerdo 4')],
  },
];

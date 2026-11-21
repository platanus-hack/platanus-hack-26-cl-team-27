import { type Box, makeBox } from '@team27/context-lake';

export const CASE_ID = 'p12-bandeja';
export const CASE_TITLE = 'Pilar P-12 y bandeja E-B-03';
export const CASE_LEVEL = 'Nivel 3';
export const CASE_AXIS = 'Eje B-6';

export const AUTHOR_ID = 'paula-rojas';
export const AFFECTED_ID = 'camila-vera';
export const PARTICIPANTS = [AUTHOR_ID, AFFECTED_ID] as const;

export const MOVE_REASON =
  'Alinear con el muro de corte M-6 y bajar la torsión';

export const SEGMENT = { fromX: 26, toX: 32 } as const;

export interface CaseElement {
  readonly id: string;
  readonly name: string;
  readonly discipline: string;
  readonly ownerId: string;
  readonly box: Box;
  readonly movable: boolean;
  readonly support: boolean;
}

export const CASE_ELEMENTS: readonly CaseElement[] = [
  {
    id: 'P-12',
    name: 'Pilar P-12 (40×60 cm, H30)',
    discipline: 'estructura',
    ownerId: 'paula-rojas',
    box: makeBox([29.8, 5.7, 0], [30.2, 6.3, 2.55]),
    movable: false,
    support: false,
  },
  {
    id: 'E-B-03',
    name: 'Bandeja E-B-03 (escalerilla 300×100 mm)',
    discipline: 'eléctricas',
    ownerId: 'camila-vera',
    box: makeBox([SEGMENT.fromX, 6.45, 2.25], [SEGMENT.toX, 6.75, 2.35]),
    movable: true,
    support: false,
  },
  {
    id: 'B2',
    name: 'Colector B2',
    discipline: 'sanitarias',
    ownerId: 'javier-munoz',
    box: makeBox([5, 6.4, 2.2], [7, 6.6, 2.3]),
    movable: false,
    support: false,
  },
  {
    id: 'cielo-n3',
    name: 'Cielo falso del nivel 3',
    discipline: 'arquitectura',
    ownerId: 'fernanda-lagos',
    box: makeBox([0, 0, 2.4], [33, 18, 2.6]),
    movable: false,
    support: false,
  },
];

export const CASE_SUBJECT_PREFIX = 'caso.';
export const CASE_ATTRIBUTE = 'ubicacion_m';
export const CASE_UNIT = 'm';
export const CASE_SPACE = 'drive-proyecto';
export const BASE_LABEL = 'base';
export const FIX_LABEL_PREFIX = 'propuesta-';
export const VIGENTE_ID = 'vigente';
export const VIGENTE_NAME = 'Vigente';

export const caseSubject = (elementId: string): string =>
  `${CASE_SUBJECT_PREFIX}${elementId}`;

export const caseElementId = (subject: string): string =>
  subject.slice(CASE_SUBJECT_PREFIX.length);

export const CASE_DOCUMENTS = [
  { id: 'losaromos-est', name: 'LosAromos_EST', elementId: 'P-12' },
  { id: 'losaromos-elec', name: 'LosAromos_ELEC', elementId: 'E-B-03' },
  { id: 'losaromos-sani', name: 'LosAromos_SAN', elementId: 'B2' },
  { id: 'losaromos-arq', name: 'LosAromos_ARQ', elementId: 'cielo-n3' },
] as const;

export const CASE_DOCUMENT_IDS: readonly string[] = CASE_DOCUMENTS.map(
  (document) => document.id,
);

export const documentOfElement = (elementId: string) =>
  CASE_DOCUMENTS.find((document) => document.elementId === elementId);

export const CLEARANCE_RULES = [
  { a: 'estructura', b: 'eléctricas', meters: 0.15 },
  { a: 'eléctricas', b: 'arquitectura', meters: 0.05 },
  { a: 'estructura', b: 'arquitectura', meters: null },
] as const;

export const DISCIPLINE_LABELS: Readonly<Record<string, string>> = {
  estructura: 'Estructura',
  eléctricas: 'Instalaciones eléctricas',
  sanitarias: 'Instalaciones sanitarias',
  arquitectura: 'Arquitectura',
};

export interface CostLine {
  readonly code: string;
  readonly detail: string;
  readonly quantity: number;
  readonly unit: string;
  readonly price: number;
  readonly total: number;
}

export const COST_LINES: readonly CostLine[] = [
  {
    code: '12.03.02',
    detail: 'Retiro y reinstalación de escalerilla 300 mm',
    quantity: 6,
    unit: 'm',
    price: 9500,
    total: 57000,
  },
  {
    code: '12.03.05',
    detail: 'Curva 45°',
    quantity: 2,
    unit: 'un',
    price: 14800,
    total: 29600,
  },
  {
    code: '12.03.07',
    detail: 'Consola galvanizada',
    quantity: 5,
    unit: 'un',
    price: 11200,
    total: 56000,
  },
  {
    code: '12.03.09',
    detail: 'Escalerilla adicional',
    quantity: 1,
    unit: 'm',
    price: 18900,
    total: 18900,
  },
];

export const COST_TOTAL = COST_LINES.reduce((sum, line) => sum + line.total, 0);

export const SCHEDULE = { days: 0.5, critical: false } as const;

const TIME = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Santiago',
});

export const clock = (date: Date): string => TIME.format(date);

export const meters = (value: number, digits = 2): string =>
  value.toFixed(digits).replace('.', ',');

export const centimeters = (value: number): number => Math.round(value * 100);

export const clp = (value: number): string =>
  `$${value.toLocaleString('es-CL')}`;

const DIRECTIONS = {
  x: { 1: 'al este', [-1]: 'al oeste' },
  y: { 1: 'al norte', [-1]: 'al sur' },
  z: { 1: 'hacia arriba', [-1]: 'hacia abajo' },
} as const;

export const direction = (axis: 'x' | 'y' | 'z', sign: 1 | -1): string =>
  DIRECTIONS[axis][sign];

export interface ChangeTextInput {
  readonly authorName: string;
  readonly elementId: string;
  readonly distance: number;
  readonly axis: 'x' | 'y' | 'z';
  readonly sign: 1 | -1;
}

export const minuteMessage = (input: ChangeTextInput): string =>
  `${input.authorName} movió ${input.elementId} ${centimeters(input.distance)} cm ${direction(input.axis, input.sign)} (${CASE_LEVEL}, eje ${CASE_AXIS.slice(4)})`;

export const sentText = (
  input: ChangeTextInput,
  affected: readonly { name: string; discipline: string }[],
): string => {
  const teams = affected
    .map((item) => `${DISCIPLINE_LABELS[item.discipline]} (${item.name})`)
    .join(', ');
  const found =
    affected.length === 0
      ? 'ningún equipo afectado'
      : `${affected.length === 1 ? '1 equipo afectado' : `${affected.length} equipos afectados`}: ${teams}`;
  return `Cambio enviado: ${input.elementId} se movió ${centimeters(input.distance)} cm ${direction(input.axis, input.sign)} (${CASE_LEVEL}, eje ${CASE_AXIS.slice(4)}). Vigente encontró ${found}.`;
};

export interface ProposalTextInput extends ChangeTextInput {
  readonly authorRole: string;
  readonly at: Date;
  readonly reason: string;
  readonly centerBefore: number;
  readonly centerAfter: number;
  readonly victimId: string;
  readonly victimSpec: string;
  readonly victimMin: number;
  readonly victimMax: number;
  readonly victimZ: number;
  readonly gapBefore: number;
  readonly penetration: number;
  readonly fixDistance: number;
  readonly segmentLength: number;
  readonly clearanceAfter: number;
  readonly causeSpec: string;
}

export const proposalTexts = (input: ProposalTextInput) => {
  const cm = centimeters(input.distance);
  const dir = direction(input.axis, input.sign);
  const fixCm = centimeters(input.fixDistance);
  const reason = `${input.reason.charAt(0).toLowerCase()}${input.reason.slice(1)}`;
  return {
    title: `El pilar ${input.elementId} se corrió ${cm} cm ${dir} y pisa tu bandeja del eje B`,
    why: `${input.authorName} (${input.authorRole}) movió ${input.elementId} (${input.causeSpec}) de ${input.axis} = ${meters(input.centerBefore)} m a ${input.axis} = ${meters(input.centerAfter)} m a las ${clock(input.at)}, para ${reason}. Tu bandeja ${input.victimId} (${input.victimSpec}, +${meters(input.victimZ)} m) ocupa de ${meters(input.victimMin)} a ${meters(input.victimMax)} m en ese punto. Antes pasaba a ${centimeters(input.gapBefore)} cm del pilar; ahora el pilar la atraviesa ${centimeters(input.penetration)} cm.`,
    proposal: `Propuesta de Vigente: correr ${fixCm} cm ${dir} el tramo de ${input.segmentLength} m de la bandeja ${input.victimId}, entre x = ${meters(SEGMENT.fromX, 1)} y ${meters(SEGMENT.toX, 1)} m, con dos quiebres de 45°. Queda a ${centimeters(input.clearanceAfter)} cm del pilar, igual que antes.`,
    cost: `${clp(COST_TOTAL)} + IVA (6 m de reinstalación, 2 curvas, 5 consolas, 1 m de bandeja). Plazo: 0,5 día, no mueve la entrega.`,
    footer: 'Vigente propone; tú decides. No se cambia nada hasta que aceptes.',
  };
};

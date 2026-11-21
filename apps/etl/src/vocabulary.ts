export const SPACE_FOLDERS: Readonly<Record<string, string>> = {
  'drive-proyecto': 'drive-proyecto',
  'carpeta-costos': 'carpeta-costos',
  'correo-quillay': 'correo-quillay',
  'whatsapp-obra': 'whatsapp-obra',
  'libro-de-obra': 'libro-obra',
};

export const PEOPLE: Readonly<Record<string, string>> = {
  'fernanda lagos': 'fernanda-lagos',
  'paula rojas': 'paula-rojas',
  'daniela soto': 'daniela-soto',
  'marcos fuentes': 'marcos-fuentes',
  'javier muñoz': 'javier-munoz',
  'camila vera': 'camila-vera',
  'tomás reyes': 'tomas-reyes',
  'ventanas quillay': 'ventanas-quillay',
};

export const DOCUMENT_ALIASES: Readonly<Record<string, string>> = {
  'e-102': 'e102',
  'is-301': 'is301',
  'a-201': 'a201',
  'eett-03': 'eett03',
  'q-118': 'q118',
  'presupuesto itemizado': 'presupuesto',
  'carta gantt': 'gantt',
  'acta de coordinación': 'acta',
  'libro de obra': 'libro',
};

export const DOCUMENT_TITLES: Readonly<Record<string, string>> = {
  e102: 'E-102',
  a201: 'A-201',
  is301: 'IS-301',
  eett03: 'EETT-03',
  q118: 'Q-118',
};

export const documentTitle = (id: string): string => DOCUMENT_TITLES[id] ?? id;

export const WHATSAPP_DOCUMENT = 'whatsapp';

const SUBJECT_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ['losa-n2', /\blosa(?: del)?(?: nivel| n)? ?2\b/i],
  ['losa-n3', /\blosa(?: del)?(?: nivel| n)? ?3\b/i],
  ['losa-n4', /\blosa(?: del)?(?: nivel| n)? ?4\b/i],
  ['losa-n5', /\blosa(?: del)?(?: nivel| n)? ?5\b/i],
  ['losa-cubierta', /\blosa de cubierta\b/i],
  ['shaft-s1', /\bshaft\b.*\bS1\b/i],
  ['ventanas-norte', /\bventanas?\b.*\bnorte\b/i],
  ['colector-b2', /\bcolector\b.*\bB2\b/i],
];

const BUDGET_ITEMS: ReadonlySet<string> = new Set([
  '03.02',
  '03.03',
  '05.04',
  '07.01',
]);

export const subjectOf = (text: string): string | null => {
  for (const [id, pattern] of SUBJECT_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return null;
};

export const budgetSubject = (code: string): string | null =>
  BUDGET_ITEMS.has(code.trim()) ? `partida-${code.trim()}` : null;

export const PROJECT_SUBJECT = 'proyecto';

export const ATTRIBUTE_UNITS: Readonly<Record<string, string | null>> = {
  espesor_cm: 'cm',
  ancho_cm: 'cm',
  alto_cm: 'cm',
  cantidad: null,
  posicion_m: 'm',
};

const ATTRIBUTE_WORDS: readonly (readonly [string, string])[] = [
  ['espesor', 'espesor_cm'],
  ['ancho', 'ancho_cm'],
  ['alto', 'alto_cm'],
  ['cantidad', 'cantidad'],
];

export const attributeOfHeader = (header: string): string | null => {
  const word = header.trim().toLowerCase();
  for (const [prefix, attribute] of ATTRIBUTE_WORDS) {
    if (word.startsWith(prefix)) return attribute;
  }
  return null;
};

export const personId = (name: string): string | null =>
  PEOPLE[name.trim().toLowerCase()] ?? null;

export const documentId = (name: string): string | null =>
  DOCUMENT_ALIASES[name.trim().toLowerCase()] ?? null;

export const parseNumber = (text: string): number | null => {
  const clean = text.trim().replace(/\s/g, '');
  if (clean === '') return null;
  let normal = clean;
  if (clean.includes(',')) normal = clean.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) normal = clean.replace(/\./g, '');
  const value = Number(normal);
  return Number.isFinite(value) ? value : null;
};

export const PERSON_NAMES: Readonly<Record<string, string>> = {
  'fernanda-lagos': 'Fernanda Lagos',
  'paula-rojas': 'Paula Rojas',
  'daniela-soto': 'Daniela Soto',
  'marcos-fuentes': 'Marcos Fuentes',
  'javier-munoz': 'Javier Muñoz',
  'camila-vera': 'Camila Vera',
  'tomas-reyes': 'Tomás Reyes',
  'ventanas-quillay': 'Ventanas Quillay',
};

export const personName = (id: string): string => PERSON_NAMES[id] ?? id;

export const PRESENTER_ID = 'fernanda-lagos';

export const NOTIFIABLE_PEOPLE: readonly string[] = Object.keys(
  PERSON_NAMES,
).filter((id) => id !== PRESENTER_ID);

const SUBJECT_LABELS: Readonly<Record<string, string>> = {
  'losa-n2': 'losa N2',
  'losa-n3': 'losa N3',
  'losa-n4': 'losa N4',
  'losa-n5': 'losa N5',
  'losa-cubierta': 'losa de cubierta',
  'shaft-s1': 'shaft S1',
  'colector-b2': 'colector B2',
  'ventanas-norte': 'ventanas del norte',
  proyecto: 'plazo del proyecto',
};

export const subjectLabel = (id: string): string =>
  SUBJECT_LABELS[id] ?? id.replace(/^partida-/, 'partida ');

const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
  espesor_cm: 'espesor',
  ancho_cm: 'ancho',
  alto_cm: 'alto',
  cantidad: 'cantidad',
  posicion_m: 'distancia al eje A',
  precio_unitario: 'precio unitario',
  entrega_dias: 'entrega',
  duracion_dias: 'duración',
};

export const attributeLabel = (key: string): string =>
  ATTRIBUTE_LABELS[key] ?? key;

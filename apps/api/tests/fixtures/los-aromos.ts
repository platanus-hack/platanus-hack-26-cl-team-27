import type {
  ModelElementDef,
  OrganizationDef,
  ProjectDefinition,
  ProjectSubjectDef,
  ScheduleTaskDef,
} from '@team27/data-main';

const SLABS = [
  { id: 'losa-n2', name: 'Losa nivel 2', level: 2, levelId: 'n2' },
  { id: 'losa-n3', name: 'Losa nivel 3', level: 3, levelId: 'n3' },
  { id: 'losa-n4', name: 'Losa nivel 4', level: 4, levelId: 'n4' },
  { id: 'losa-n5', name: 'Losa nivel 5', level: 5, levelId: 'n5' },
  { id: 'losa-cubierta', name: 'Losa de cubierta', level: 6, levelId: 'n6' },
] as const;

const PRICE_ITEMS = [
  ['partida-03.02', 'Partida 03.02 Hormigón H30 en losas', '$/m³'],
  ['partida-03.03', 'Partida 03.03 Acero de refuerzo en losas', '$/kg'],
  ['partida-05.04', 'Partida 05.04 Perforaciones y sellos del shaft', '$/m²'],
  ['partida-07.01', 'Partida 07.01 Ventanas de PVC termopanel', '$/m²'],
] as const;

const slabElement = ({
  id,
  name,
  level,
}: (typeof SLABS)[number]): ModelElementDef => ({
  id,
  name,
  category: 'losa',
  level,
  properties: [
    {
      key: 'espesor_cm',
      label: 'Espesor',
      value: 15,
      unit: 'cm',
      editable: true,
    },
    { key: 'area_m2', label: 'Área', value: 280, unit: 'm²', editable: false },
    {
      key: 'hormigon',
      label: 'Hormigón',
      value: 'H30',
      unit: null,
      editable: false,
    },
  ],
});

const ELEMENTS: readonly ModelElementDef[] = [
  ...SLABS.map(slabElement),
  {
    id: 'shaft-s1',
    name: 'Shaft de instalaciones S1',
    category: 'shaft',
    level: null,
    properties: [
      {
        key: 'posicion_m',
        label: 'Distancia al eje A',
        value: 6,
        unit: 'm',
        editable: true,
      },
      {
        key: 'ancho_cm',
        label: 'Ancho',
        value: 80,
        unit: 'cm',
        editable: true,
      },
      {
        key: 'largo_cm',
        label: 'Largo',
        value: 120,
        unit: 'cm',
        editable: true,
      },
      {
        key: 'recorrido',
        label: 'Recorrido',
        value: 'Nivel 1 a cubierta',
        unit: null,
        editable: false,
      },
    ],
  },
  {
    id: 'colector-b2',
    name: 'Colector sanitario B2',
    category: 'colector',
    level: 3,
    properties: [
      {
        key: 'posicion_m',
        label: 'Distancia al eje A',
        value: 10,
        unit: 'm',
        editable: true,
      },
    ],
  },
  {
    id: 'ventanas-norte',
    name: 'Ventanas fachada norte',
    category: 'ventana',
    level: null,
    properties: [
      {
        key: 'ancho_cm',
        label: 'Ancho',
        value: 120,
        unit: 'cm',
        editable: true,
      },
      { key: 'alto_cm', label: 'Alto', value: 150, unit: 'cm', editable: true },
      {
        key: 'cantidad',
        label: 'Cantidad',
        value: 24,
        unit: null,
        editable: false,
      },
      {
        key: 'tipo',
        label: 'Tipo',
        value: 'PVC termopanel',
        unit: null,
        editable: false,
      },
    ],
  },
];

const STRUCTURE_TASKS: readonly ScheduleTaskDef[] = SLABS.flatMap(
  ({ id, name }, index): ScheduleTaskDef[] => {
    const previous =
      index === 0 ? 't-fundaciones' : `t-muros-${SLABS[index - 1]?.id}`;
    const pour: ScheduleTaskDef = {
      id: `t-${id}`,
      name: `Hormigonado ${name.charAt(0).toLowerCase()}${name.slice(1)}`,
      days: 3,
      predecessors: [previous],
      driver: { elementId: id, quantity: 'volumen', productivity: 15 },
    };
    if (id === 'losa-cubierta') return [pour];
    const level = name.replace('Losa ', '');
    return [
      pour,
      {
        id: `t-muros-${id}`,
        name: `Muros y pilares ${level}`,
        days: 6,
        predecessors: [pour.id],
        driver: null,
      },
    ];
  },
);

const ALL_LEVELS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];

const SUBJECTS: readonly ProjectSubjectDef[] = [
  ...SLABS.map(({ id, name, levelId }): ProjectSubjectDef => ({
    id,
    name,
    section: 'estructura',
    category: 'losa',
    attributes: [{ key: 'espesor_cm', unit: 'cm' }],
    spatial: {
      kind: 'soporte',
      levels: [levelId],
      cells: { kind: 'all' },
      systems: ['estructura'],
    },
  })),
  {
    id: 'shaft-s1',
    name: 'Shaft de instalaciones S1',
    section: 'instalaciones',
    category: 'shaft',
    attributes: [
      { key: 'posicion_m', unit: 'm' },
      { key: 'ancho_cm', unit: 'cm' },
    ],
    spatial: {
      kind: 'ocupante',
      levels: ALL_LEVELS,
      cells: { kind: 'position', attribute: 'posicion_m', axis: 3 },
      systems: ['sanitarias', 'electricas'],
    },
  },
  {
    id: 'colector-b2',
    name: 'Colector sanitario B2',
    section: 'instalaciones',
    category: 'colector',
    attributes: [{ key: 'posicion_m', unit: 'm' }],
    spatial: {
      kind: 'ocupante',
      levels: ['n3'],
      cells: { kind: 'position', attribute: 'posicion_m', axis: 3 },
      systems: ['sanitarias'],
    },
  },
  {
    id: 'ventanas-norte',
    name: 'Ventanas fachada norte',
    section: 'fachada',
    category: 'ventana',
    attributes: [
      { key: 'ancho_cm', unit: 'cm' },
      { key: 'alto_cm', unit: 'cm' },
      { key: 'cantidad', unit: null },
    ],
    spatial: {
      kind: 'ocupante',
      levels: ALL_LEVELS.slice(0, 5),
      cells: { kind: 'axis', axis: 1 },
      systems: ['arquitectura'],
    },
  },
  ...PRICE_ITEMS.map(([id, name, unit]): ProjectSubjectDef => ({
    id,
    name,
    section: 'costos',
    category: 'partida',
    attributes: [{ key: 'precio_unitario', unit }],
    spatial: null,
  })),
  {
    id: 'proyecto',
    name: 'Proyecto',
    section: 'plazo',
    category: 'proyecto',
    attributes: [
      { key: 'entrega_dias', unit: 'días' },
      { key: 'duracion_dias', unit: 'días' },
    ],
    spatial: null,
  },
];

export const LOS_AROMOS_ORGANIZATION: OrganizationDef = {
  id: 'inmobiliaria-los-aromos',
  name: 'Inmobiliaria Los Aromos',
};

export const LOS_AROMOS: ProjectDefinition = {
  id: 'los-aromos',
  organizationId: LOS_AROMOS_ORGANIZATION.id,
  name: 'Edificio Los Aromos',
  location: 'Ñuñoa, Santiago',
  description: '5 pisos y 20 departamentos, en obra gruesa.',
  authorId: 'fernanda-lagos',
  costOwnerId: 'daniela-soto',
  scheduleOwnerId: 'marcos-fuentes',
  modelDocumentId: 'modelo-revit',
  members: [
    {
      id: 'fernanda-lagos',
      name: 'Fernanda Lagos',
      role: 'Arquitecta',
      channel: 'email',
      handle: 'fernanda.lagos@arquitectura.example',
    },
    {
      id: 'paula-rojas',
      name: 'Paula Rojas',
      role: 'Ingeniera calculista',
      channel: 'email',
      handle: 'paula.rojas@calculo.example',
    },
    {
      id: 'marcos-fuentes',
      name: 'Marcos Fuentes',
      role: 'Jefe de obra',
      channel: 'whatsapp',
      handle: '+56 9 0000 0101',
    },
    {
      id: 'daniela-soto',
      name: 'Daniela Soto',
      role: 'Control de costos',
      channel: 'slack',
      handle: '#costos-los-aromos',
    },
    {
      id: 'javier-munoz',
      name: 'Javier Muñoz',
      role: 'Instalaciones sanitarias',
      channel: 'whatsapp',
      handle: '+56 9 0000 0102',
    },
    {
      id: 'camila-vera',
      name: 'Camila Vera',
      role: 'Instalaciones eléctricas',
      channel: 'slack',
      handle: '#instalaciones',
    },
    {
      id: 'tomas-reyes',
      name: 'Tomás Reyes',
      role: 'Terminaciones',
      channel: 'email',
      handle: 'tomas.reyes@terminaciones.example',
    },
    {
      id: 'ventanas-quillay',
      name: 'Ventanas Quillay',
      role: 'Proveedor de ventanas',
      channel: 'email',
      handle: 'ventas@quillay.example',
    },
  ],
  spaces: [
    {
      id: 'drive-proyecto',
      name: 'Drive del proyecto',
      kind: 'drive',
      ownerId: 'fernanda-lagos',
    },
    {
      id: 'carpeta-costos',
      name: 'Carpeta de costos',
      kind: 'sharepoint',
      ownerId: 'daniela-soto',
    },
    {
      id: 'correo-quillay',
      name: 'Correo de Ventanas Quillay',
      kind: 'email',
      ownerId: 'ventanas-quillay',
    },
    {
      id: 'whatsapp-obra',
      name: 'WhatsApp Obra Los Aromos',
      kind: 'whatsapp',
      ownerId: 'marcos-fuentes',
    },
    {
      id: 'libro-obra',
      name: 'Libro de obra',
      kind: 'libro_obra',
      ownerId: 'marcos-fuentes',
    },
  ],
  documents: [
    {
      id: 'a201',
      name: 'A-201 Fachada norte y shaft',
      kind: 'plano',
      spaceId: 'drive-proyecto',
      ownerId: 'fernanda-lagos',
    },
    {
      id: 'e102',
      name: 'E-102 Planta estructural N3',
      kind: 'plano',
      spaceId: 'drive-proyecto',
      ownerId: 'fernanda-lagos',
    },
    {
      id: 'is301',
      name: 'IS-301 Plano de instalaciones sanitarias nivel 3',
      kind: 'plano',
      spaceId: 'drive-proyecto',
      ownerId: 'javier-munoz',
    },
    {
      id: 'eett03',
      name: 'EETT-03 Hormigones',
      kind: 'eett',
      spaceId: 'drive-proyecto',
      ownerId: 'paula-rojas',
    },
    {
      id: 'presupuesto',
      name: 'Presupuesto itemizado',
      kind: 'presupuesto',
      spaceId: 'carpeta-costos',
      ownerId: 'daniela-soto',
    },
    {
      id: 'gantt',
      name: 'Carta Gantt',
      kind: 'carta_gantt',
      spaceId: 'carpeta-costos',
      ownerId: 'marcos-fuentes',
    },
    {
      id: 'q118',
      name: 'Cotización Q-118',
      kind: 'cotizacion',
      spaceId: 'correo-quillay',
      ownerId: 'ventanas-quillay',
    },
    {
      id: 'acta',
      name: 'Acta de coordinación',
      kind: 'acta',
      spaceId: 'drive-proyecto',
      ownerId: 'fernanda-lagos',
    },
    {
      id: 'libro',
      name: 'Libro de obra',
      kind: 'libro_obra',
      spaceId: 'libro-obra',
      ownerId: 'marcos-fuentes',
    },
    {
      id: 'whatsapp',
      name: 'Mensajes de WhatsApp',
      kind: 'mensaje',
      spaceId: 'whatsapp-obra',
      ownerId: 'marcos-fuentes',
    },
    {
      id: 'modelo-revit',
      name: 'Modelo Revit de arquitectura',
      kind: 'plano',
      spaceId: 'drive-proyecto',
      ownerId: 'fernanda-lagos',
    },
  ],
  attributes: [
    { key: 'espesor_cm', label: 'Espesor' },
    { key: 'ancho_cm', label: 'Ancho' },
    { key: 'alto_cm', label: 'Alto' },
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'posicion_m', label: 'Distancia al eje A' },
    { key: 'precio_unitario', label: 'Precio unitario' },
    { key: 'entrega_dias', label: 'Entrega' },
    { key: 'duracion_dias', label: 'Duración' },
  ],
  subjects: SUBJECTS,
  elements: ELEMENTS,
  budgetItems: [
    {
      code: '03.02',
      name: 'Hormigón H30 en losas',
      unit: 'm³',
      unitPrice: 145_000,
      category: 'losa',
      quantity: 'volumen',
      factor: 1,
    },
    {
      code: '03.03',
      name: 'Acero de refuerzo en losas',
      unit: 'kg',
      unitPrice: 1_350,
      category: 'losa',
      quantity: 'volumen',
      factor: 85,
    },
    {
      code: '05.04',
      name: 'Perforaciones y sellos del shaft',
      unit: 'm²',
      unitPrice: 95_000,
      category: 'shaft',
      quantity: 'perforacion',
      factor: 6,
    },
    {
      code: '07.01',
      name: 'Ventanas de PVC termopanel',
      unit: 'm²',
      unitPrice: 185_000,
      category: 'ventana',
      quantity: 'superficie',
      factor: 1,
    },
  ],
  tasks: [
    {
      id: 't-fundaciones',
      name: 'Fundaciones y estructura nivel 1',
      days: 24,
      predecessors: [],
      driver: null,
    },
    ...STRUCTURE_TASKS,
    {
      id: 't-instalaciones',
      name: 'Montaje de instalaciones en shaft S1',
      days: 12,
      predecessors: ['t-losa-cubierta'],
      driver: null,
    },
    {
      id: 't-ventanas',
      name: 'Instalación de ventanas fachada norte',
      days: 4,
      predecessors: ['t-losa-cubierta'],
      driver: {
        elementId: 'ventanas-norte',
        quantity: 'superficie',
        productivity: 12,
      },
    },
    {
      id: 't-terminaciones',
      name: 'Terminaciones interiores',
      days: 30,
      predecessors: ['t-instalaciones'],
      driver: null,
    },
    {
      id: 't-recepcion',
      name: 'Recepción y entrega',
      days: 3,
      predecessors: ['t-terminaciones', 't-ventanas'],
      driver: null,
    },
  ],
  dependencies: [
    {
      category: 'losa',
      watches: ['espesor_cm'],
      stakeholderId: 'paula-rojas',
      summary: 'Cambia el peso propio de la {elemento}',
      action:
        'Revisa las vigas y pilares que la reciben y confirma si hay que redimensionar.',
      measures: ['peso_propio'],
    },
    {
      category: 'losa',
      watches: ['espesor_cm'],
      stakeholderId: 'javier-munoz',
      summary:
        'Las pasadas sanitarias que cruzan la {elemento} cambian de largo',
      action:
        'Revisa el largo de las camisas y sus fijaciones antes del hormigonado.',
      measures: [],
    },
    {
      category: 'shaft',
      watches: ['posicion_m', 'ancho_cm', 'largo_cm'],
      stakeholderId: 'javier-munoz',
      summary: 'El {elemento} cambia de ubicación o de tamaño',
      action: 'Ajusta el trazado de bajadas y ventilaciones al nuevo shaft.',
      measures: [],
    },
    {
      category: 'shaft',
      watches: ['posicion_m', 'ancho_cm', 'largo_cm'],
      stakeholderId: 'camila-vera',
      summary: 'Las montantes eléctricas del {elemento} cambian de trazado',
      action: 'Ajusta montantes y bandejas al nuevo shaft.',
      measures: [],
    },
    {
      category: 'shaft',
      watches: ['posicion_m', 'ancho_cm', 'largo_cm'],
      stakeholderId: 'paula-rojas',
      summary: 'Las perforaciones del {elemento} cambian en todas las losas',
      action:
        'Verifica que las nuevas perforaciones no corten vigas ni refuerzos.',
      measures: ['perforacion'],
    },
    {
      category: 'ventana',
      watches: ['ancho_cm', 'alto_cm'],
      stakeholderId: 'ventanas-quillay',
      summary: 'Cambian las medidas de las {elemento}',
      action:
        'Confirma precio y plazo de fabricación antes de cortar perfiles.',
      measures: ['superficie'],
    },
    {
      category: 'ventana',
      watches: ['ancho_cm'],
      stakeholderId: 'paula-rojas',
      summary: 'Los vanos de las {elemento} se ensanchan',
      action: 'Revisa los dinteles de la fachada norte.',
      measures: [],
    },
    {
      category: 'ventana',
      watches: ['ancho_cm', 'alto_cm'],
      stakeholderId: 'tomas-reyes',
      summary: 'Cambian los vanos de las {elemento}',
      action: 'Ajusta alféizares, remates y cortinas a las nuevas medidas.',
      measures: [],
    },
  ],
  levels: [
    { id: 'n1', label: 'Nivel 1', short: 'nivel 1' },
    { id: 'n2', label: 'Nivel 2', short: 'nivel 2' },
    { id: 'n3', label: 'Nivel 3', short: 'nivel 3' },
    { id: 'n4', label: 'Nivel 4', short: 'nivel 4' },
    { id: 'n5', label: 'Nivel 5', short: 'nivel 5' },
    { id: 'n6', label: 'Cubierta', short: 'cubierta' },
  ],
  longitudinalAxes: [
    { id: 'A', meters: 0 },
    { id: 'B', meters: 4 },
    { id: 'C', meters: 8 },
    { id: 'D', meters: 12 },
    { id: 'E', meters: 16 },
  ],
  transversalAxes: [1, 2, 3, 4],
  systems: [
    { id: 'estructura', label: 'estructura', occupiesSpace: true },
    { id: 'arquitectura', label: 'arquitectura', occupiesSpace: true },
    { id: 'sanitarias', label: 'sanitarias', occupiesSpace: true },
    { id: 'electricas', label: 'eléctricas', occupiesSpace: true },
    { id: 'costos', label: 'costos', occupiesSpace: false },
    { id: 'plazo', label: 'plazo', occupiesSpace: false },
  ],
};

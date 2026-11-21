import type { ModelElement } from '@team27/context-capture';
import type { ProjectGraph, Task } from '@team27/context-impact';
import type { Stakeholder } from '@team27/context-notification';

export type CastMember = Stakeholder;

const SLABS = [
  { id: 'losa-n2', name: 'Losa nivel 2', level: 2 },
  { id: 'losa-n3', name: 'Losa nivel 3', level: 3 },
  { id: 'losa-n4', name: 'Losa nivel 4', level: 4 },
  { id: 'losa-n5', name: 'Losa nivel 5', level: 5 },
  { id: 'losa-cubierta', name: 'Losa de cubierta', level: 6 },
] as const;

const slab = ({ id, name, level }: (typeof SLABS)[number]): ModelElement => ({
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

const MODEL: readonly ModelElement[] = [
  ...SLABS.map(slab),
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

const STRUCTURE_TASKS: readonly Task[] = SLABS.flatMap(
  ({ id, name }, index): Task[] => {
    const previous =
      index === 0 ? 't-fundaciones' : `t-muros-${SLABS[index - 1]?.id}`;
    const pour: Task = {
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

const GRAPH: ProjectGraph = {
  costOwnerId: 'daniela-soto',
  scheduleOwnerId: 'marcos-fuentes',
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
};

const STAKEHOLDERS: readonly Stakeholder[] = [
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
];

const AUTHOR: CastMember = {
  id: 'fernanda-lagos',
  name: 'Fernanda Lagos',
  role: 'Arquitecta',
  channel: 'email',
  handle: 'fernanda.lagos@arquitectura.example',
};

const CAST: readonly CastMember[] = [AUTHOR, ...STAKEHOLDERS];

export const LOS_AROMOS = {
  project: {
    name: 'Edificio Los Aromos',
    location: 'Ñuñoa, Santiago',
    description: '5 pisos y 20 departamentos, en obra gruesa.',
  },
  author: AUTHOR,
  cast: CAST,
  model: MODEL,
  graph: GRAPH,
  stakeholders: STAKEHOLDERS,
} as const;

export type Scenario = typeof LOS_AROMOS;

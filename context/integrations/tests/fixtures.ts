import type { SheetTab } from '../src/domain/Sheet.ts';
import type { SourceVocabulary } from '../src/domain/Vocabulary.ts';

const slab = (id: string, label: string) => ({
  id,
  label,
  attributes: [{ key: 'espesor_cm', label: 'Espesor', unit: 'cm' }],
});

const item = (code: string, label: string, unit: string) => ({
  id: `partida-${code}`,
  label: `Partida ${code} ${label}`,
  attributes: [{ key: 'precio_unitario', label: 'Precio unitario', unit }],
});

export const VOCABULARY: SourceVocabulary = {
  subjects: [
    slab('losa-n2', 'Losa nivel 2'),
    slab('losa-n3', 'Losa nivel 3'),
    slab('losa-n4', 'Losa nivel 4'),
    slab('losa-cubierta', 'Losa de cubierta'),
    {
      id: 'shaft-s1',
      label: 'Shaft de instalaciones S1',
      attributes: [
        { key: 'posicion_m', label: 'Distancia al eje A', unit: 'm' },
        { key: 'ancho_cm', label: 'Ancho', unit: 'cm' },
      ],
    },
    {
      id: 'ventanas-norte',
      label: 'Ventanas fachada norte',
      attributes: [
        { key: 'ancho_cm', label: 'Ancho', unit: 'cm' },
        { key: 'alto_cm', label: 'Alto', unit: 'cm' },
        { key: 'cantidad', label: 'Cantidad', unit: null },
      ],
    },
    item('03.02', 'Hormigón H30 en losas', '$/m³'),
    item('03.03', 'Acero de refuerzo en losas', '$/kg'),
    item('05.04', 'Perforaciones y sellos del shaft', '$/m²'),
    item('07.01', 'Ventanas de PVC termopanel', '$/m²'),
  ],
};

export const BUDGET_V2: SheetTab = {
  title: 'Partidas',
  rows: [
    ['Presupuesto itemizado'],
    ['Proyecto', 'Edificio Los Aromos'],
    ['Versión', 'v2'],
    ['Elaboró', 'Daniela Soto'],
    ['Fecha', '2026-10-20'],
    ['Hoja', 'Partidas'],
    ['Moneda', 'CLP'],
    ['IVA', 'No incluido'],
    ['Mandante', 'Inmobiliaria Los Aromos SpA'],
    ['Obra', 'Edificio Los Aromos, Ñuñoa'],
    ['Modalidad', 'Suma alzada con partidas itemizadas'],
    [],
    [
      'Código',
      'Descripción',
      'Precio unitario',
      'Unidad',
      'Cantidad',
      'Dimensión de diseño usada',
    ],
    [
      '03.02',
      'Hormigón H30 en losas',
      145000,
      'm³',
      210,
      'Losa nivel 3 · espesor 15 cm',
    ],
    ['03.03', 'Acero de refuerzo en losas', 1350, 'kg', 17850, ''],
    ['05.04', 'Perforaciones y sellos del shaft', 95000, 'm²', 5.76],
    [
      '07.01',
      'Ventanas de PVC termopanel',
      185000,
      'm²',
      43.2,
      'Ventanas del norte · ancho 120 cm',
    ],
    ['01.01', 'Instalación de faenas', 2800000, 'gl', 1, ''],
    [],
    ['02.01', 'Excavación masiva', 6500, 'm³', 1850, ''],
  ],
};

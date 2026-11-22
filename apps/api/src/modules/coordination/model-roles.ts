import type { VisualFocus } from '@team27/context-notification';

export type DemoRoleId = 'arquitectura' | 'costos' | 'canerias';

export interface DemoOption {
  readonly subject: string;
  readonly attribute: string;
  readonly label: string;
  readonly unit: string | null;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface DemoRole {
  readonly id: DemoRoleId;
  readonly name: string;
  readonly emoji: string;
  readonly color: string;
  readonly focus: VisualFocus;
  readonly documentId: string;
  readonly summary: string;
  readonly options: readonly DemoOption[];
}

export const DEMO_ROLES: readonly DemoRole[] = [
  {
    id: 'arquitectura',
    name: 'Arquitectura',
    emoji: '📐',
    color: '#256abf',
    focus: 'canerias',
    documentId: 'a201',
    summary: 'Mueves el shaft y cambias las ventanas del modelo.',
    options: [
      {
        subject: 'shaft-s1',
        attribute: 'posicion_m',
        label: 'Shaft S1 · distancia al eje A',
        unit: 'm',
        min: 4,
        max: 12,
        step: 0.5,
      },
      {
        subject: 'shaft-s1',
        attribute: 'ancho_cm',
        label: 'Shaft S1 · ancho',
        unit: 'cm',
        min: 60,
        max: 140,
        step: 10,
      },
      {
        subject: 'ventanas-norte',
        attribute: 'ancho_cm',
        label: 'Ventanas fachada norte · ancho',
        unit: 'cm',
        min: 80,
        max: 200,
        step: 10,
      },
    ],
  },
  {
    id: 'costos',
    name: 'Presupuesto',
    emoji: '💰',
    color: '#d92d20',
    focus: 'losa',
    documentId: 'presupuesto',
    summary: 'Cambias precios unitarios de las partidas.',
    options: [
      {
        subject: 'partida-03.02',
        attribute: 'precio_unitario',
        label: 'Hormigón H30 en losas',
        unit: '$/m³',
        min: 100000,
        max: 220000,
        step: 5000,
      },
      {
        subject: 'partida-05.04',
        attribute: 'precio_unitario',
        label: 'Perforaciones y sellos del shaft',
        unit: '$/m²',
        min: 60000,
        max: 160000,
        step: 5000,
      },
      {
        subject: 'partida-07.01',
        attribute: 'precio_unitario',
        label: 'Ventanas de PVC termopanel',
        unit: '$/m²',
        min: 120000,
        max: 260000,
        step: 5000,
      },
    ],
  },
  {
    id: 'canerias',
    name: 'Cañerías',
    emoji: '🚰',
    color: '#0e9384',
    focus: 'canerias',
    documentId: 'is301',
    summary: 'Mueves el colector sanitario del nivel 3.',
    options: [
      {
        subject: 'colector-b2',
        attribute: 'posicion_m',
        label: 'Colector sanitario B2 · distancia al eje A',
        unit: 'm',
        min: 4,
        max: 14,
        step: 0.5,
      },
    ],
  },
];

export const findOption = (
  roleId: string,
  subject: string,
  attribute: string,
): { role: DemoRole; option: DemoOption } | null => {
  const role = DEMO_ROLES.find((item) => item.id === roleId);
  const option = role?.options.find(
    (item) => item.subject === subject && item.attribute === attribute,
  );
  return role && option ? { role, option } : null;
};

export const snap = (option: DemoOption, value: number): number => {
  const clamped = Math.min(Math.max(value, option.min), option.max);
  const steps = Math.round((clamped - option.min) / option.step);
  return Number((option.min + steps * option.step).toFixed(2));
};

export class RateLimiter {
  private readonly perKeyMs: number;
  private readonly perMinute: number;
  private readonly last = new Map<string, number>();
  private window: number[] = [];

  constructor(perKeyMs: number, perMinute: number) {
    this.perKeyMs = perKeyMs;
    this.perMinute = perMinute;
  }

  check(key: string, now = Date.now()): { ok: true } | { ok: false; waitMs: number } {
    const previous = this.last.get(key);
    if (previous !== undefined && now - previous < this.perKeyMs) {
      return { ok: false, waitMs: this.perKeyMs - (now - previous) };
    }
    this.window = this.window.filter((at) => now - at < 60_000);
    if (this.window.length >= this.perMinute) {
      return { ok: false, waitMs: 60_000 - (now - this.window[0]!) };
    }
    this.window.push(now);
    this.last.set(key, now);
    return { ok: true };
  }
}

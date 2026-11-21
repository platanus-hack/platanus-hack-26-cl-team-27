import { createHash } from 'node:crypto';

import type {
  ChunkDraft,
  ClaimDraft,
  RevisionDraft,
} from '@team27/context-lake';
import { z } from 'zod';

import {
  ATTRIBUTES,
  documentOf,
  REVIT_MODEL_ID,
  SUBJECTS,
  toRevisionDraft,
} from '../../scenario/documents.ts';

const MAX_LOCATOR = 200;

interface TrackedAttribute {
  readonly unit: 'cm' | 'm' | null;
  readonly decimals: number;
}

const TRACKED: Readonly<Record<string, TrackedAttribute>> = {
  espesor_cm: { unit: 'cm', decimals: 1 },
  ancho_cm: { unit: 'cm', decimals: 1 },
  alto_cm: { unit: 'cm', decimals: 1 },
  posicion_m: { unit: 'm', decimals: 2 },
  cantidad: { unit: null, decimals: 0 },
};

const DESIGN_SECTIONS: readonly string[] = [
  'estructura',
  'instalaciones',
  'fachada',
];

const designSubjects = new Set(
  SUBJECTS.filter((subject) => DESIGN_SECTIONS.includes(subject.section)).map(
    (subject) => subject.id,
  ),
);

const attributeLabel = (key: string): string =>
  ATTRIBUTES.find((attribute) => attribute.key === key)?.label ?? key;

const text = z.string().min(1).max(200);

const nullableText = z.string().max(200).nullable();

const element = z.object({
  id: z.number().int(),
  uniqueId: z.string().min(1).max(200),
  category: nullableText,
  name: nullableText,
  level: nullableText,
});

const change = z.object({
  subjectId: text,
  attribute: text,
  before: z.number().nullable(),
  after: z.number().nullable(),
  unit: z.string().max(16).nullable(),
  elements: z.array(element).max(500),
});

export const revitMinuteBody = z
  .object({
    minuteId: z.uuid().refine((id) => id === id.toLowerCase(), {
      message: 'El minuteId va en minúsculas',
    }),
    trigger: z.enum(['save', 'sync', 'manual']),
    createdAt: z.iso.datetime({ offset: true }),
    model: z.object({
      title: z.string().min(1).max(200),
      saveNumber: z.number().int().min(0).nullable(),
      versionGuid: nullableText,
      revitVersion: nullableText,
    }),
    addin: z.object({
      name: text,
      version: text,
    }),
    changes: z.array(change).min(1).max(200),
    operations: z.array(z.string().max(200)).max(100),
  })
  .refine(
    (minute) => {
      const seen = new Set<string>();
      for (const item of minute.changes) {
        const key = `${item.subjectId}\u0000${item.attribute}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    {
      message:
        'La minuta repite un mismo valor (sujeto y atributo): deja un solo cambio por valor',
      path: ['changes'],
    },
  );

export type RevitMinute = z.output<typeof revitMinuteBody>;

export interface IgnoredChange {
  readonly subjectId: string;
  readonly attribute: string;
  readonly reason: string;
}

export interface MappedMinute {
  readonly revision: RevisionDraft;
  readonly claims: ClaimDraft[];
  readonly chunks: ChunkDraft[];
  readonly ignored: IgnoredChange[];
}

export const minuteLabel = (minute: RevitMinute): string =>
  (minute.trigger === 'save' || minute.trigger === 'sync') &&
  minute.model.saveNumber !== null
    ? `guardado ${minute.model.saveNumber}`
    : `minuta ${minute.minuteId.slice(0, 8)}`;

const locatorOf = (
  minute: RevitMinute,
  elements: RevitMinute['changes'][number]['elements'],
): string => {
  const [first] = elements;
  if (!first) return `Revit · ${minute.model.title}`.slice(0, MAX_LOCATOR);
  const parts = ['Revit'];
  if (first.category) parts.push(first.category);
  parts.push(`${first.name ?? 'Elemento'} (id ${first.id})`);
  const rest = elements.length - 1;
  const suffix = rest > 0 ? ` y ${rest} más` : '';
  return `${parts.join(' · ')}${suffix}`.slice(0, MAX_LOCATOR);
};

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const unitName = (unit: string | null): string =>
  unit === null ? 'sin unidad' : `«${unit}»`;

const judge = (
  item: RevitMinute['changes'][number],
): { value: number; unit: string | null } | string => {
  if (!designSubjects.has(item.subjectId)) {
    return 'El proyecto no sigue ese elemento';
  }
  const tracked = TRACKED[item.attribute];
  if (!tracked) return 'El proyecto no sigue ese atributo';
  if (item.unit !== tracked.unit) {
    return `${attributeLabel(item.attribute)} va en ${unitName(tracked.unit)} y la minuta trae ${unitName(item.unit)}`;
  }
  if (item.after === null) {
    return 'El elemento ya no está en el modelo y el repositorio no registra eliminaciones';
  }
  if (item.after < 0) return 'El valor no puede ser negativo';
  if (tracked.decimals === 0 && !Number.isInteger(item.after)) {
    return `${attributeLabel(item.attribute)} debe ser un número entero no negativo`;
  }
  return { value: roundTo(item.after, tracked.decimals), unit: tracked.unit };
};

export const mapMinute = (
  minute: RevitMinute,
  authorId: string,
): MappedMinute => {
  const claims: ClaimDraft[] = [];
  const ignored: IgnoredChange[] = [];
  for (const item of minute.changes) {
    const verdict = judge(item);
    if (typeof verdict === 'string') {
      ignored.push({
        subjectId: item.subjectId,
        attribute: item.attribute,
        reason: verdict,
      });
      continue;
    }
    claims.push({
      subject: item.subjectId,
      attribute: item.attribute,
      value: verdict.value,
      unit: verdict.unit,
      role: 'afirma',
      locator: locatorOf(minute, item.elements),
    });
  }
  const label = minuteLabel(minute);
  const document = documentOf(REVIT_MODEL_ID);
  const pointer = `Revit · ${minute.model.title}.rvt · ${label}`;
  const normalized = claims
    .map((claim) => [claim.subject, claim.attribute, claim.value, claim.unit])
    .sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
  const contentHash = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
  return {
    revision: {
      ...toRevisionDraft(
        document.id,
        label,
        authorId,
        document.spaceId,
        pointer,
      ),
      contentHash,
    },
    claims,
    chunks: claims.map((claim): ChunkDraft => ({
      locator: claim.locator,
      kind: 'parametro',
      text: null,
      claims: [claim],
      rejected: [],
    })),
    ignored,
  };
};

import { DOCUMENT_KINDS, type SpaceKind } from '@team27/context-lake';
import { CHANNELS } from '@team27/context-notification';
import { z } from 'zod';

const SPACE_KINDS = [
  'drive',
  'sharepoint',
  'email',
  'whatsapp',
  'libro_obra',
] as const satisfies readonly SpaceKind[];

const id = z.string().min(1).max(64);

const member = z.object({
  id,
  name: z.string().min(1),
  role: z.string(),
  channel: z.enum(CHANNELS),
  handle: z.string(),
});

const space = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(SPACE_KINDS),
  ownerId: id,
});

const document = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(DOCUMENT_KINDS),
  spaceId: id,
  ownerId: id,
});

const spatial = z.object({
  kind: z.enum(['soporte', 'ocupante']),
  levels: z.array(id),
  cells: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('all') }),
    z.object({ kind: z.literal('axis'), axis: z.number().int() }),
    z.object({
      kind: z.literal('position'),
      attribute: id,
      axis: z.number().int(),
    }),
  ]),
  systems: z.array(id),
});

const subject = z.object({
  id,
  name: z.string().min(1),
  section: id,
  category: id,
  attributes: z.array(z.object({ key: id, unit: z.string().nullable() })),
  spatial: spatial.nullable(),
});

const element = z.object({
  id,
  name: z.string().min(1),
  category: id,
  level: z.number().int().nullable(),
  properties: z.array(
    z.object({
      key: id,
      label: z.string(),
      value: z.union([z.number(), z.string()]),
      unit: z.string().nullable(),
      editable: z.boolean(),
    }),
  ),
});

const budgetItem = z.object({
  code: id,
  name: z.string().min(1),
  unit: z.string(),
  unitPrice: z.number(),
  category: id,
  quantity: id,
  factor: z.number(),
});

const task = z.object({
  id,
  name: z.string().min(1),
  days: z.number().int().min(0),
  predecessors: z.array(id),
  driver: z
    .object({
      elementId: id,
      quantity: id,
      productivity: z.number().positive(),
    })
    .nullable(),
});

const dependency = z.object({
  category: id,
  watches: z.array(id),
  stakeholderId: id,
  summary: z.string().min(1),
  action: z.string().min(1),
  measures: z.array(id),
});

export const projectSchema = z.object({
  id,
  name: z.string().min(1),
  location: z.string(),
  description: z.string(),
  authorId: id,
  costOwnerId: id,
  scheduleOwnerId: id,
  modelDocumentId: id.nullable(),
  members: z.array(member).min(1),
  spaces: z.array(space),
  documents: z.array(document),
  attributes: z.array(z.object({ key: id, label: z.string().min(1) })),
  subjects: z.array(subject),
  elements: z.array(element),
  budgetItems: z.array(budgetItem),
  tasks: z.array(task),
  dependencies: z.array(dependency),
  levels: z.array(
    z.object({ id, label: z.string().min(1), short: z.string().min(1) }),
  ),
  longitudinalAxes: z.array(z.object({ id, meters: z.number() })).min(2),
  transversalAxes: z.array(z.number().int()),
  systems: z.array(
    z.object({ id, label: z.string().min(1), occupiesSpace: z.boolean() }),
  ),
});

export type ValidProject = z.output<typeof projectSchema>;

import {
  type AutodeskChangeKind,
  type AutodeskResourceKind,
  type AutodeskSource,
  defineAutodeskEvent,
  ELEMENT_DIFF_KINDS,
  MODEL_EXTENSIONS,
} from './AutodeskEvent.ts';

export interface AutodeskResource {
  readonly kind: AutodeskResourceKind;
  readonly urn: string | null;
  readonly lineageUrn: string | null;
  readonly name: string | null;
  readonly extension: string | null;
  readonly version: number | null;
  readonly parentFolderUrn: string | null;
  readonly projectId: string | null;
}

export interface AutodeskChange {
  readonly kind: AutodeskChangeKind;
  readonly event: string;
  readonly source: AutodeskSource;
  readonly description: string;
  readonly hookId: string | null;
  readonly occurredAt: string | null;
  readonly actorId: string | null;
  readonly resource: AutodeskResource;
  readonly needsElementDiff: boolean;
  readonly dedupeKey: string;
}

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordAt = (value: unknown, key: string): Json | null => {
  if (!isRecord(value)) return null;
  const inner = value[key];
  return isRecord(inner) ? inner : null;
};

const textAt = (value: unknown, ...keys: string[]): string | null => {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const found = value[key];
    if (typeof found === 'string' && found.trim() !== '') return found.trim();
    if (typeof found === 'number' && Number.isFinite(found)) {
      return String(found);
    }
  }
  return null;
};

const versionOf = (payload: Json | null): number | null => {
  const direct = textAt(payload, 'version', 'versionNumber');
  const fromSource = textAt(payload, 'source')?.match(/[?&]version=(\d+)/)?.[1];
  const raw = direct ?? fromSource ?? null;
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const extensionOf = (
  payload: Json | null,
  name: string | null,
): string | null => {
  const explicit = textAt(payload, 'ext', 'extension');
  if (explicit) return explicit.replace(/^\./, '').toLowerCase();
  const match = name?.match(/\.([a-z0-9]+)$/i)?.[1];
  return match ? match.toLowerCase() : null;
};

const isoOf = (value: string | null): string | null => {
  if (value === null) return null;
  const numeric = Number(value);
  const date =
    Number.isFinite(numeric) && /^\d+$/.test(value)
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const VERSIONED_OCCURRENCE_EVENTS: readonly string[] = [
  'dm.version.added',
  'dm.version.deleted',
  'model.sync',
  'model.publish',
  'extraction.finished',
];

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64 = 0xffffffffffffffffn;

const fingerprintOf = (value: unknown): string => {
  const text = canonicalJson(value);
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * FNV_PRIME) & UINT64;
  }
  return `h${hash.toString(16).padStart(16, '0')}`;
};

const momentOf = (
  event: string,
  version: number | null,
  occurredAt: string | null,
  body: Json,
): string => {
  if (version !== null && VERSIONED_OCCURRENCE_EVENTS.includes(event)) {
    return `v${version}`;
  }
  const parts = [version !== null ? `v${version}` : null, occurredAt].filter(
    (part) => part !== null,
  );
  return parts.length > 0 ? parts.join('@') : fingerprintOf(body);
};

export class AutodeskEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutodeskEventError';
  }
}

export const parseAutodeskWebhook = (body: unknown): AutodeskChange => {
  if (!isRecord(body)) {
    throw new AutodeskEventError('El cuerpo del webhook no es un objeto');
  }
  const hook = recordAt(body, 'hook');
  const payload = recordAt(body, 'payload');
  const event = textAt(hook, 'event') ?? textAt(body, 'event');
  if (!event) {
    throw new AutodeskEventError('El webhook no dice qué evento es');
  }
  const system = textAt(hook, 'system');
  const definition = defineAutodeskEvent(event, system);
  const name = textAt(payload, 'name', 'title', 'displayName');
  const extension = extensionOf(payload, name);
  const urn =
    textAt(payload, 'source', 'urn', 'id', 'issueId') ??
    textAt(body, 'resourceUrn');
  const lineageUrn = textAt(payload, 'lineageUrn');
  const version = versionOf(payload);
  const isModelFile =
    definition.resource === 'model' ||
    (extension !== null && MODEL_EXTENSIONS.includes(extension));
  const resource: AutodeskResource = {
    kind:
      definition.resource === 'file' && isModelFile
        ? 'model'
        : definition.resource,
    urn,
    lineageUrn,
    name,
    extension,
    version,
    parentFolderUrn: textAt(payload, 'parentFolderUrn', 'folderUrn'),
    projectId: textAt(payload, 'project', 'projectId', 'containerId'),
  };
  const occurredAt = isoOf(
    textAt(payload, 'modifiedTime', 'updatedAt', 'createdTime', 'createdAt'),
  );
  const actorId =
    textAt(recordAt(payload, 'user_info'), 'id') ??
    textAt(payload, 'modifiedBy', 'updatedBy', 'creator', 'createdBy');
  const hookId = textAt(hook, 'hookId');
  const target =
    lineageUrn ?? urn ?? textAt(body, 'resourceUrn') ?? fingerprintOf(body);
  const moment = momentOf(event, version, occurredAt, body);
  return {
    kind: definition.kind,
    event,
    source: definition.source,
    description: definition.description,
    hookId,
    occurredAt,
    actorId,
    resource,
    needsElementDiff:
      isModelFile && ELEMENT_DIFF_KINDS.includes(definition.kind),
    dedupeKey: `${hookId ?? 'sin-hook'}|${event}|${target}|${moment}`,
  };
};

import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { OssClient } from '@aps_sdk/oss';

import { apsErrorStatus, CATALOG_SCOPES, type ApsAuth } from './aps-auth.ts';

export const DISCIPLINES = [
  'architectural',
  'site',
  'structural',
  'plumbing',
  'hvac',
  'electrical',
] as const;

export type Discipline = (typeof DISCIPLINES)[number] | 'other';

export interface ViewerModel {
  readonly file: string;
  readonly discipline: Discipline;
  readonly urn: string;
}

export const CATALOG_TTL_MS = 5 * 60_000;

const REGION = 'US';
const PAGE_SIZE = 100;

export const disciplineOf = (file: string): Discipline => {
  const name = file.toLowerCase();
  if (name.includes('arch')) return 'architectural';
  if (name.includes('site')) return 'site';
  if (name.includes('struct')) return 'structural';
  if (name.includes('plumb')) return 'plumbing';
  if (name.includes('hvac') || name.includes('mech')) return 'hvac';
  if (name.includes('elec')) return 'electrical';
  return 'other';
};

export const toUrn = (objectId: string): string =>
  Buffer.from(objectId).toString('base64url');

const startAtOf = (next: string | undefined): string | null =>
  next
    ? new URL(next, 'https://developer.api.autodesk.com').searchParams.get(
        'startAt',
      )
    : null;

export class ModelsCatalog {
  private readonly bucketKey: string;
  private readonly oss: Pick<OssClient, 'getObjects'>;
  private readonly derivatives: Pick<ModelDerivativeClient, 'getManifest'>;
  private readonly now: () => number;
  private cached: {
    readonly models: readonly ViewerModel[];
    readonly expiresAt: number;
  } | null = null;
  private pending: Promise<readonly ViewerModel[]> | null = null;

  constructor(
    bucketKey: string,
    clients: {
      oss: Pick<OssClient, 'getObjects'>;
      derivatives: Pick<ModelDerivativeClient, 'getManifest'>;
    },
    options: { now?: () => number } = {},
  ) {
    this.bucketKey = bucketKey;
    this.oss = clients.oss;
    this.derivatives = clients.derivatives;
    this.now = options.now ?? Date.now;
  }

  list(): Promise<readonly ViewerModel[]> {
    if (this.cached && this.cached.expiresAt > this.now()) {
      return Promise.resolve(this.cached.models);
    }
    this.pending ??= this.load()
      .then((models) => {
        this.cached = { models, expiresAt: this.now() + CATALOG_TTL_MS };
        return models;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  private async load(): Promise<readonly ViewerModel[]> {
    const objects = await this.objects();
    const models = await Promise.all(
      [...objects].map(async ([file, objectId]) => {
        const urn = toUrn(objectId);
        return (await this.isTranslated(urn))
          ? { file, discipline: disciplineOf(file), urn }
          : null;
      }),
    );
    return models
      .filter((model) => model !== null)
      .sort((a, b) => a.file.localeCompare(b.file));
  }

  private async objects(): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    const visited = new Set<string>();
    let startAt: string | null = null;
    for (;;) {
      const page = await this.oss.getObjects(
        this.bucketKey,
        startAt ? { limit: PAGE_SIZE, startAt } : { limit: PAGE_SIZE },
      );
      for (const { objectKey, objectId } of page.items ?? []) {
        if (objectKey && objectId) found.set(objectKey, objectId);
      }
      startAt = startAtOf(page.next);
      if (!startAt || visited.has(startAt)) return found;
      visited.add(startAt);
    }
  }

  private async isTranslated(urn: string): Promise<boolean> {
    try {
      const manifest = await this.derivatives.getManifest(urn, {
        region: REGION,
      });
      return manifest.status === 'success';
    } catch (error) {
      if (apsErrorStatus(error) === 404) return false;
      throw error;
    }
  }
}

export const createModelsCatalog = (
  auth: ApsAuth,
  bucketKey: string,
): ModelsCatalog => {
  const sdkManager = SdkManagerBuilder.create().build();
  sdkManager.toggleLogging(false);
  const authenticationProvider = auth.asProvider(CATALOG_SCOPES);
  return new ModelsCatalog(bucketKey, {
    oss: new OssClient({ sdkManager, authenticationProvider }),
    derivatives: new ModelDerivativeClient({
      sdkManager,
      authenticationProvider,
    }),
  });
};

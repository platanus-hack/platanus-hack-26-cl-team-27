import { createHash } from 'node:crypto';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  ModelDerivativeClient,
  type Manifest,
  type ManifestResources,
} from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { OssClient } from '@aps_sdk/oss';

import {
  ApsAuth,
  apsErrorStatus,
  INTERNAL_SCOPES,
  readApsCredentials,
} from '../src/modules/aps/aps-auth.ts';
import {
  CATALOG_PATH,
  disciplineOf,
  MODELS_DIR,
  readCatalog,
  toUrn,
  type CatalogModel,
  type TranslationStatus,
} from '../src/modules/aps/models-catalog.ts';

const REGION = 'US';
const POLL_MS = 15_000;
const POLL_LIMIT_MS = 45 * 60_000;

const { values: flags } = parseArgs({
  options: { force: { type: 'boolean', default: false } },
});

const credentials = readApsCredentials(process.env);
if (!credentials) {
  console.error(
    'Faltan APS_CLIENT_ID y APS_CLIENT_SECRET en el .env de la raíz.',
  );
  process.exit(1);
}

const files = (await readdir(MODELS_DIR).catch(() => [] as string[]))
  .filter((file) => file.toLowerCase().endsWith('.rvt'))
  .sort();
if (files.length === 0) {
  console.error(`No hay archivos .rvt en ${MODELS_DIR}.`);
  process.exit(1);
}

const sdkManager = SdkManagerBuilder.create().build();
sdkManager.toggleLogging(false);
const auth = new ApsAuth(credentials);
const provider = auth.asProvider(INTERNAL_SCOPES);
const oss = new OssClient({ sdkManager, authenticationProvider: provider });
const derivatives = new ModelDerivativeClient({
  sdkManager,
  authenticationProvider: provider,
});

const bucketKey =
  process.env['APS_BUCKET_KEY']?.trim() ||
  `vigente-${createHash('sha256').update(credentials.clientId).digest('hex').slice(0, 16)}`;

const describe = (error: unknown): string => {
  const status = apsErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return status ? `HTTP ${status}: ${message}` : message;
};

const ensureBucket = async (): Promise<void> => {
  try {
    await oss.getBucketDetails(bucketKey);
    console.log(`Bucket ${bucketKey}: ya existe.`);
  } catch (error) {
    if (apsErrorStatus(error) !== 404) throw error;
    await oss.createBucket(REGION, { bucketKey, policyKey: 'persistent' });
    console.log(`Bucket ${bucketKey}: creado.`);
  }
};

const remoteObject = async (
  objectKey: string,
): Promise<{ objectId: string; size: number } | null> => {
  try {
    const details = await oss.getObjectDetails(bucketKey, objectKey);
    return details.objectId
      ? { objectId: details.objectId, size: details.size ?? -1 }
      : null;
  } catch (error) {
    if (apsErrorStatus(error) === 404) return null;
    throw error;
  }
};

const manifestOf = async (urn: string): Promise<Manifest | null> => {
  try {
    return await derivatives.getManifest(urn, { region: REGION });
  } catch (error) {
    if (apsErrorStatus(error) === 404) return null;
    throw error;
  }
};

const collectMessages = (manifest: Manifest): string[] => {
  const found: string[] = [];
  const visit = (node: {
    messages?: readonly { type?: string; code?: string; message?: unknown }[];
    children?: readonly ManifestResources[];
  }): void => {
    for (const entry of node.messages ?? []) {
      const text = Array.isArray(entry.message)
        ? entry.message.join(' ')
        : String(entry.message ?? '');
      found.push(`${entry.type ?? 'info'} ${entry.code ?? ''}: ${text}`.trim());
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const derivative of manifest.derivatives ?? []) visit(derivative);
  return [...new Set(found)];
};

const has3dView = (manifest: Manifest): boolean => {
  const visit = (nodes: readonly ManifestResources[] = []): boolean =>
    nodes.some(
      (node) =>
        (node.type === 'geometry' && node.role === '3d') ||
        visit(node.children),
    );
  return (manifest.derivatives ?? []).some((derivative) =>
    visit(derivative.children),
  );
};

const statusOf = (manifest: Manifest | null): TranslationStatus => {
  const status = manifest?.status;
  return status === 'success' ||
    status === 'failed' ||
    status === 'timeout' ||
    status === 'inprogress'
    ? status
    : 'pending';
};

const translate = async (urn: string): Promise<void> => {
  await derivatives.startJob(
    {
      input: { urn },
      output: {
        formats: [
          {
            type: 'svf2',
            views: ['2d', '3d'],
            advanced: { generateMasterViews: true },
          },
        ],
      },
    },
    { region: REGION, xAdsForce: true },
  );
};

const previous = await readCatalog();
const sameBucket = previous?.bucketKey === bucketKey;
const results = new Map<string, CatalogModel>(
  sameBucket ? previous.models.map((model) => [model.file, model]) : [],
);

const save = async (): Promise<void> => {
  const models = [...results.values()].sort((a, b) =>
    a.file.localeCompare(b.file),
  );
  await writeFile(
    CATALOG_PATH,
    `${JSON.stringify({ bucketKey, region: REGION, models }, null, 2)}\n`,
  );
};

const record = (
  file: string,
  fields: Pick<CatalogModel, 'objectKey' | 'size' | 'urn' | 'status'> & {
    messages?: readonly string[];
  },
): CatalogModel => {
  const model: CatalogModel = {
    file,
    discipline: disciplineOf(file),
    messages: [],
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  results.set(file, model);
  return model;
};

const prepare = async (file: string): Promise<string | null> => {
  const objectKey = file;
  const { size } = await stat(join(MODELS_DIR, file));
  const known = results.get(file);
  if (!flags.force && known?.status === 'success' && known.size === size) {
    console.log(`${file}: ya traducido, se salta.`);
    return null;
  }

  let remote = await remoteObject(objectKey);
  let uploaded = false;
  if (!remote || remote.size !== size) {
    console.log(
      `${file}: subiendo ${(size / 1024 / 1024).toFixed(1)} MB a OSS…`,
    );
    const details = await oss.uploadObject(
      bucketKey,
      objectKey,
      join(MODELS_DIR, file),
    );
    if (!details.objectId) throw new Error('OSS no devolvió el objectId');
    remote = { objectId: details.objectId, size: details.size ?? size };
    uploaded = true;
  } else {
    console.log(`${file}: ya está en OSS.`);
  }

  const urn = toUrn(remote.objectId);
  const manifest = uploaded || flags.force ? null : await manifestOf(urn);
  const status = statusOf(manifest);
  if (status === 'success') {
    record(file, { objectKey, size, urn, status });
    console.log(`${file}: ya traducido en Model Derivative.`);
    return null;
  }
  if (status !== 'inprogress') {
    await translate(urn);
    console.log(`${file}: traducción a SVF2 iniciada.`);
  } else {
    console.log(`${file}: traducción en curso, se espera.`);
  }
  record(file, { objectKey, size, urn, status: 'inprogress' });
  return urn;
};

const waitFor = async (file: string, urn: string): Promise<void> => {
  const started = Date.now();
  let lastProgress = '';
  for (;;) {
    const manifest = await manifestOf(urn);
    const status = statusOf(manifest);
    const known = results.get(file);
    if (!known) return;
    if (status === 'success' || status === 'failed' || status === 'timeout') {
      const messages = manifest ? collectMessages(manifest) : [];
      if (status === 'success' && manifest && !has3dView(manifest)) {
        messages.push('warning: el manifiesto no trae una vista 3D');
      }
      record(file, { ...known, status, messages });
      if (status === 'success') {
        console.log(`${file}: traducción lista.`);
      } else {
        console.error(`${file}: traducción ${status}.`);
      }
      for (const message of messages) console.log(`  ${file}: ${message}`);
      await save();
      return;
    }
    if (Date.now() - started > POLL_LIMIT_MS) {
      console.error(
        `${file}: sigue en curso tras ${POLL_LIMIT_MS / 60_000} min; vuelve a correr el script para seguir esperando.`,
      );
      return;
    }
    const progress = manifest?.progress ?? 'pendiente';
    if (progress !== lastProgress) {
      console.log(`${file}: ${progress}`);
      lastProgress = progress;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};

try {
  await ensureBucket();
} catch (error) {
  console.error(`No se pudo preparar el bucket (${describe(error)}).`);
  process.exit(1);
}

const waiting: [string, string][] = [];
const failures: string[] = [];
for (const file of files) {
  try {
    const urn = await prepare(file);
    if (urn) waiting.push([file, urn]);
  } catch (error) {
    failures.push(file);
    console.error(`${file}: error (${describe(error)}), sigue con el resto.`);
  }
  await save();
}

await Promise.all(
  waiting.map(([file, urn]) =>
    waitFor(file, urn).catch((error: unknown) => {
      failures.push(file);
      console.error(
        `${file}: error al consultar el manifiesto (${describe(error)}).`,
      );
    }),
  ),
);
await save();

console.log('\nResumen:');
for (const file of files) {
  const model = results.get(file);
  console.log(
    `  ${(model?.status ?? 'error').padEnd(10)}  ${(model?.discipline ?? disciplineOf(file)).padEnd(13)} ${file}`,
  );
}
console.log(`Catálogo: ${CATALOG_PATH}`);
const failed = files.filter((file) => results.get(file)?.status !== 'success');
process.exit(failed.length > 0 || failures.length > 0 ? 1 : 0);

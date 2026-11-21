import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import {
  ModelDerivativeClient,
  type Manifest,
} from '@aps_sdk/model-derivative';
import { OssClient } from '@aps_sdk/oss';

import { apsErrorStatus, describeError } from './aps-errors.ts';
import type { ApsConfig } from './config.ts';
import type { Output } from './io.ts';
import {
  collectMessages,
  has3dView,
  statusOf,
  type TranslationStatus,
} from './manifest.ts';
import { tokenProvider } from './token.ts';

const REGION = 'US';
const POLL_MS = 15_000;
const POLL_LIMIT_MS = 45 * 60_000;

export const PUBLISH_SCOPES: readonly Scopes[] = [
  'bucket:create',
  'bucket:read',
  'data:read',
  'data:write',
  'data:create',
];

export const toUrn = (objectId: string): string =>
  Buffer.from(objectId).toString('base64url');

export const rvtFiles = async (folder: string): Promise<string[]> =>
  (await readdir(folder).catch(() => [] as string[]))
    .filter((file) => file.toLowerCase().endsWith('.rvt'))
    .sort();

export interface PublishOptions {
  readonly folder: string;
  readonly force: boolean;
}

export const publish = async (
  config: ApsConfig,
  options: PublishOptions,
  io: Output,
): Promise<number> => {
  const files = await rvtFiles(options.folder);
  if (files.length === 0) {
    io.err(`No hay archivos .rvt en ${options.folder}.`);
    return 1;
  }

  const sdkManager = SdkManagerBuilder.create().build();
  sdkManager.toggleLogging(false);
  const authenticationProvider = tokenProvider(config, PUBLISH_SCOPES);
  const oss = new OssClient({ sdkManager, authenticationProvider });
  const derivatives = new ModelDerivativeClient({
    sdkManager,
    authenticationProvider,
  });
  const { bucketKey } = config;
  const results = new Map<string, TranslationStatus>();

  const ensureBucket = async (): Promise<void> => {
    try {
      await oss.getBucketDetails(bucketKey);
      io.out(`Bucket ${bucketKey}: ya existe.`);
    } catch (error) {
      if (apsErrorStatus(error) !== 404) throw error;
      await oss.createBucket(REGION, { bucketKey, policyKey: 'persistent' });
      io.out(`Bucket ${bucketKey}: creado.`);
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

  const prepare = async (file: string): Promise<string | null> => {
    const objectKey = file;
    const { size } = await stat(join(options.folder, file));
    let remote = await remoteObject(objectKey);
    let uploaded = false;
    if (!remote || remote.size !== size) {
      io.out(`${file}: subiendo ${(size / 1024 / 1024).toFixed(1)} MB a OSS…`);
      const details = await oss.uploadObject(
        bucketKey,
        objectKey,
        join(options.folder, file),
      );
      if (!details.objectId) throw new Error('OSS no devolvió el objectId');
      remote = { objectId: details.objectId, size: details.size ?? size };
      uploaded = true;
    } else {
      io.out(`${file}: ya está en OSS.`);
    }

    const urn = toUrn(remote.objectId);
    const status = statusOf(
      uploaded || options.force ? null : await manifestOf(urn),
    );
    if (status === 'success') {
      results.set(file, status);
      io.out(`${file}: ya traducido en Model Derivative.`);
      return null;
    }
    if (status === 'inprogress') {
      io.out(`${file}: traducción en curso, se espera.`);
    } else {
      await translate(urn);
      io.out(`${file}: traducción a SVF2 iniciada.`);
    }
    results.set(file, 'inprogress');
    return urn;
  };

  const waitFor = async (file: string, urn: string): Promise<void> => {
    const started = Date.now();
    let lastProgress = '';
    for (;;) {
      const manifest = await manifestOf(urn);
      const status = statusOf(manifest);
      if (status === 'success' || status === 'failed' || status === 'timeout') {
        const messages = manifest ? collectMessages(manifest) : [];
        if (status === 'success' && manifest && !has3dView(manifest)) {
          messages.push('warning: el manifiesto no trae una vista 3D');
        }
        results.set(file, status);
        if (status === 'success') {
          io.out(`${file}: traducción lista.`);
        } else {
          io.err(`${file}: traducción ${status}.`);
        }
        for (const message of messages) io.out(`  ${file}: ${message}`);
        return;
      }
      if (Date.now() - started > POLL_LIMIT_MS) {
        io.err(
          `${file}: sigue en curso tras ${POLL_LIMIT_MS / 60_000} min; vuelve a correr pnpm aps:models para seguir esperando.`,
        );
        return;
      }
      const progress = manifest?.progress ?? 'pendiente';
      if (progress !== lastProgress) {
        io.out(`${file}: ${progress}`);
        lastProgress = progress;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };

  try {
    await ensureBucket();
  } catch (error) {
    io.err(`No se pudo preparar el bucket (${describeError(error)}).`);
    return 1;
  }

  const waiting: [string, string][] = [];
  for (const file of files) {
    try {
      const urn = await prepare(file);
      if (urn) waiting.push([file, urn]);
    } catch (error) {
      results.delete(file);
      io.err(`${file}: error (${describeError(error)}), sigue con el resto.`);
    }
  }

  await Promise.all(
    waiting.map(([file, urn]) =>
      waitFor(file, urn).catch((error: unknown) => {
        results.delete(file);
        io.err(
          `${file}: error al consultar el manifiesto (${describeError(error)}).`,
        );
      }),
    ),
  );

  io.out('\nResumen:');
  for (const file of files) {
    io.out(`  ${(results.get(file) ?? 'error').padEnd(10)}  ${file}`);
  }
  io.out(
    `La API lista los modelos traducidos del bucket ${bucketKey} en GET /api/aps/models.`,
  );
  return files.every((file) => results.get(file) === 'success') ? 0 : 1;
};

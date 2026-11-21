import { HttpStatus } from '@nestjs/common';
import {
  IntegrationError,
  type IntegrationErrorCode,
  ProviderError,
  type SourceLink,
  type SyncResult,
} from '@team27/context-integrations';

import { fail } from '../coordination/http-errors.ts';
import { documentDef, spaceName } from '../coordination/lookup.ts';

const STATUS: Readonly<Record<IntegrationErrorCode, HttpStatus>> = {
  not_configured: HttpStatus.SERVICE_UNAVAILABLE,
  not_connected: HttpStatus.CONFLICT,
  source_not_found: HttpStatus.NOT_FOUND,
  already_linked: HttpStatus.CONFLICT,
  invalid_sheet_url: HttpStatus.UNPROCESSABLE_ENTITY,
  sheet_empty: HttpStatus.UNPROCESSABLE_ENTITY,
};

export const toHttp = (error: unknown): unknown => {
  if (error instanceof IntegrationError) {
    return fail(STATUS[error.code], error.code, error.message);
  }
  if (error instanceof ProviderError) {
    return fail(HttpStatus.BAD_GATEWAY, 'provider_error', error.message);
  }
  return error;
};

export const guard = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    throw toHttp(error);
  }
};

export const sourceView = (source: SourceLink) => {
  const document = documentDef(source.documentId);
  return {
    id: source.id,
    provider: source.provider,
    documentId: source.documentId,
    documentName: document?.name ?? source.documentId,
    spaceName: document ? spaceName(document.spaceId) : null,
    title: source.title,
    pointer: source.pointer,
    checkedAt: source.checkedAt,
    createdAt: source.createdAt,
    lastRead: source.lastRead && {
      at: source.lastRead.at,
      label: source.lastRead.label,
      ignored: source.lastRead.ignored,
    },
    lastError: source.lastError,
  };
};

export type SourceView = ReturnType<typeof sourceView>;

export const syncView = (result: SyncResult) => ({
  status: result.status,
  message: result.message,
  revisionId: result.receipt?.revisionId ?? null,
  proposals: result.receipt?.proposals ?? 0,
});

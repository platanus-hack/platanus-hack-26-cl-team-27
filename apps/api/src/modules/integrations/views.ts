import { HttpStatus } from '@nestjs/common';
import {
  IntegrationError,
  type IntegrationErrorCode,
  ProviderError,
  type SourceLink,
  type WatchResult,
} from '@team27/context-integrations';

import { fail } from '../coordination/http-errors.ts';

const STATUS: Readonly<Record<IntegrationErrorCode, HttpStatus>> = {
  not_configured: HttpStatus.SERVICE_UNAVAILABLE,
  not_connected: HttpStatus.CONFLICT,
  source_not_found: HttpStatus.NOT_FOUND,
  already_linked: HttpStatus.CONFLICT,
  invalid_sheet_url: HttpStatus.UNPROCESSABLE_ENTITY,
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

export const sourceView = (source: SourceLink) => ({
  id: source.id,
  provider: source.provider,
  title: source.title,
  pointer: source.pointer,
  checkedAt: source.checkedAt,
  changedAt: source.changedAt,
  createdAt: source.createdAt,
  lastError: source.lastError,
});

export type SourceView = ReturnType<typeof sourceView>;

export const checkView = (result: WatchResult) => ({
  status: result.status,
  message: result.message,
  cells: result.cells,
});

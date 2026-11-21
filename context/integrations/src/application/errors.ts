export type IntegrationErrorCode =
  | 'not_configured'
  | 'not_connected'
  | 'source_not_found'
  | 'already_linked'
  | 'invalid_sheet_url'
  | 'sheet_empty';

export class IntegrationError extends Error {
  override readonly name = 'IntegrationError';
  readonly code: IntegrationErrorCode;

  constructor(code: IntegrationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class ProviderError extends Error {
  override readonly name = 'ProviderError';
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export class DeliveryError extends Error {
  override readonly name = 'DeliveryError';
}

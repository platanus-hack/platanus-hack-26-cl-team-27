export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

export class InferenceUnavailableError extends Error {
  override readonly name = 'InferenceUnavailableError';
}

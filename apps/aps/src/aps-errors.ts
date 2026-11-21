export const apsErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as {
    httpStatusCode?: () => number | null;
    axiosError?: { response?: { status?: number } };
  };
  if (typeof candidate.httpStatusCode === 'function') {
    return candidate.httpStatusCode();
  }
  return candidate.axiosError?.response?.status ?? null;
};

export const describeError = (error: unknown): string => {
  const status = apsErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return status ? `HTTP ${status}: ${message}` : message;
};

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

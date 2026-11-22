export const errorDigest = (error: unknown): string | null => {
  if (!error || typeof error !== 'object' || !('digest' in error)) return null;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.length > 0 ? digest : null;
};

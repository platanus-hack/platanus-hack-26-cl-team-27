import type { Manifest, ManifestResources } from '@aps_sdk/model-derivative';

export type TranslationStatus =
  'pending' | 'inprogress' | 'success' | 'failed' | 'timeout';

export const statusOf = (
  manifest: Pick<Manifest, 'status'> | null,
): TranslationStatus => {
  const status = manifest?.status;
  return status === 'success' ||
    status === 'failed' ||
    status === 'timeout' ||
    status === 'inprogress'
    ? status
    : 'pending';
};

export const collectMessages = (
  manifest: Pick<Manifest, 'derivatives'>,
): string[] => {
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

export const has3dView = (manifest: Pick<Manifest, 'derivatives'>): boolean => {
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

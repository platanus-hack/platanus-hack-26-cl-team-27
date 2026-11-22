const FNV_PRIME = 0x01000193;

const fnv1a = (text: string, seed: number): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
};

const SEEDS = [0x811c9dc5, 0x01234567, 0x89abcdef, 0x5bd1e995];

const hex = (value: number): string => value.toString(16).padStart(8, '0');

export const minuteIdFor = (
  modelId: string,
  fromVersion: number,
  toVersion: number,
): string => {
  const key = `aec|${modelId}|${fromVersion}|${toVersion}`;
  const digits = SEEDS.map((seed) => hex(fnv1a(key, seed))).join('');
  const variant = (
    (Number.parseInt(digits.charAt(16), 16) & 0x3) |
    0x8
  ).toString(16);
  return [
    digits.slice(0, 8),
    digits.slice(8, 12),
    `8${digits.slice(13, 16)}`,
    `${variant}${digits.slice(17, 20)}`,
    digits.slice(20, 32),
  ].join('-');
};

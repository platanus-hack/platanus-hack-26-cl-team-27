const MAX_SLUG = 56;

const slugify = (name: string, fallback: string): string => {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
};

export const projectSlug = (name: string): string => slugify(name, 'proyecto');

export const organizationSlug = (name: string): string =>
  slugify(name, 'organizacion');

export const nameKey = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const freeId = (slug: string, taken: readonly string[]): string => {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  let suffix = 2;
  while (used.has(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
};

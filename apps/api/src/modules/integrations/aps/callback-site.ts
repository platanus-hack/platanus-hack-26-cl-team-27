import type { CookieOptions } from 'express';

export const STATE_COOKIE = 'vigente_aps_oauth';

export const RETURN_PATH = '/cuenta';

export const stateCookieOptions = (callbackUrl: string): CookieOptions => {
  const url = new URL(callbackUrl);
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: url.pathname,
  };
};

export const readCookie = (
  header: string | undefined,
  name: string,
): string | null => {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
};

export const returnUrl = (
  callbackUrl: string,
  outcome: { readonly connected: true } | { readonly error: string },
): string => {
  const url = new URL(RETURN_PATH, callbackUrl);
  if ('error' in outcome) {
    url.searchParams.set('autodesk', 'error');
    url.searchParams.set('motivo', outcome.error);
  } else {
    url.searchParams.set('autodesk', 'conectada');
  }
  return url.toString();
};

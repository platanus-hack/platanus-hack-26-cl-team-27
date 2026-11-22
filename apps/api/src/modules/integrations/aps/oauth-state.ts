import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import type { TokenCipher } from './token-cipher.ts';

export const STATE_TTL_MS = 10 * 60_000;

const STATE_CONTEXT = 'aps-oauth-state';

const stateSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  nonce: z.string().min(1),
  expiresAt: z.number(),
});

export type OAuthState = z.output<typeof stateSchema>;

export const newNonce = (): string => randomBytes(32).toString('base64url');

export const sealState = (cipher: TokenCipher, state: OAuthState): string =>
  cipher.encrypt(JSON.stringify(state), STATE_CONTEXT);

export const openState = (
  cipher: TokenCipher,
  sealed: string,
  now: number,
): OAuthState | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cipher.decrypt(sealed, STATE_CONTEXT));
  } catch {
    return null;
  }
  const result = stateSchema.safeParse(parsed);
  if (!result.success || result.data.expiresAt <= now) return null;
  return result.data;
};

export const sameNonce = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
};

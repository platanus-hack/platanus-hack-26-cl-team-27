import { createHmac, timingSafeEqual } from 'node:crypto';

export const APS_SIGNATURE_HEADER = 'x-adsk-signature';

const PREFIX = 'sha1hash=';

export const signApsWebhook = (
  rawBody: string | Buffer,
  secret: string,
): string =>
  `${PREFIX}${createHmac('sha1', secret).update(rawBody).digest('hex')}`;

export const verifyApsWebhook = (
  rawBody: string | Buffer,
  header: string | null | undefined,
  secret: string,
): boolean => {
  if (!header || !secret) return false;
  const received = header.trim().toLowerCase();
  if (!received.startsWith(PREFIX)) return false;
  const expected = Buffer.from(signApsWebhook(rawBody, secret));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

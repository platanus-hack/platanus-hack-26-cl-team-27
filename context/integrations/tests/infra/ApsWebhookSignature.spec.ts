import { createHmac } from 'node:crypto';

import {
  signApsWebhook,
  verifyApsWebhook,
} from '../../src/infra/adapters/ApsWebhookSignature.ts';

const SECRET = 'el-token-secreto-del-webhook';
const BODY = '{"hook":{"event":"dm.version.added"},"payload":{"version":"8"}}';

describe('ApsWebhookSignature', () => {
  it('firma con HMAC-SHA1 del cuerpo crudo, como Autodesk', () => {
    const hex = createHmac('sha1', SECRET).update(BODY).digest('hex');
    expect(signApsWebhook(BODY, SECRET)).toBe(`sha1hash=${hex}`);
  });

  it('acepta la firma correcta, sin importar mayúsculas', () => {
    const header = signApsWebhook(BODY, SECRET);
    expect(verifyApsWebhook(BODY, header, SECRET)).toBe(true);
    expect(
      verifyApsWebhook(
        Buffer.from(BODY),
        header.toUpperCase().replace('SHA1HASH', 'sha1hash'),
        SECRET,
      ),
    ).toBe(true);
  });

  it('rechaza un cuerpo cambiado, otra clave, o una firma ausente o mal formada', () => {
    const header = signApsWebhook(BODY, SECRET);
    expect(verifyApsWebhook(`${BODY} `, header, SECRET)).toBe(false);
    expect(verifyApsWebhook(BODY, header, 'otra-clave')).toBe(false);
    expect(verifyApsWebhook(BODY, undefined, SECRET)).toBe(false);
    expect(verifyApsWebhook(BODY, 'md5=abc', SECRET)).toBe(false);
    expect(verifyApsWebhook(BODY, header, '')).toBe(false);
  });
});

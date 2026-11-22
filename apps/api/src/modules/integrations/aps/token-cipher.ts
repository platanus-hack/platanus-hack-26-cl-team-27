import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export class InvalidCiphertextError extends Error {
  constructor() {
    super('El texto cifrado no es válido para esta clave');
    this.name = 'InvalidCiphertextError';
  }
}

export class TokenCipher {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    if (!HEX_KEY.test(hexKey)) {
      throw new Error('La clave de cifrado son 64 caracteres hexadecimales');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const body = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      body.toString('base64url'),
    ].join('.');
  }

  decrypt(ciphertext: string, context: string): string {
    const [version, iv, tag, body, ...rest] = ciphertext.split('.');
    if (
      version !== VERSION ||
      !iv ||
      !tag ||
      body === undefined ||
      rest.length > 0
    ) {
      throw new InvalidCiphertextError();
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(iv, 'base64url'),
        { authTagLength: TAG_BYTES },
      );
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InvalidCiphertextError();
    }
  }
}

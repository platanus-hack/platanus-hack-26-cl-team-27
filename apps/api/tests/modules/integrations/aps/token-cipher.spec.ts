import {
  InvalidCiphertextError,
  TokenCipher,
} from '../../../../src/modules/integrations/aps/token-cipher.ts';
import {
  newNonce,
  openState,
  sameNonce,
  sealState,
  STATE_TTL_MS,
} from '../../../../src/modules/integrations/aps/oauth-state.ts';
import { cipher, KEY } from './fakes.ts';

describe('TokenCipher', () => {
  it('cifra y descifra con AES-256-GCM, con un IV nuevo cada vez', () => {
    const tokens = cipher();
    const first = tokens.encrypt('eyJ.secreto', 'aps:aromos:access_token');
    const second = tokens.encrypt('eyJ.secreto', 'aps:aromos:access_token');
    expect(first).not.toBe(second);
    expect(first).not.toContain('secreto');
    expect(first.split('.')).toHaveLength(4);
    expect(first.startsWith('v1.')).toBe(true);
    expect(tokens.decrypt(first, 'aps:aromos:access_token')).toBe(
      'eyJ.secreto',
    );
    expect(tokens.decrypt(tokens.encrypt('', 'x'), 'x')).toBe('');
  });

  it('rechaza otro contexto, otra clave o un texto alterado', () => {
    const tokens = cipher();
    const sealed = tokens.encrypt('eyJ.secreto', 'aps:aromos:access_token');
    expect(() => tokens.decrypt(sealed, 'aps:otra:access_token')).toThrow(
      InvalidCiphertextError,
    );
    expect(() =>
      new TokenCipher('b'.repeat(64)).decrypt(
        sealed,
        'aps:aromos:access_token',
      ),
    ).toThrow(InvalidCiphertextError);
    const [version, iv, tag, body] = sealed.split('.');
    const flipped = `${body?.startsWith('A') ? 'B' : 'A'}${body?.slice(1)}`;
    expect(() =>
      tokens.decrypt(
        [version, iv, tag, flipped].join('.'),
        'aps:aromos:access_token',
      ),
    ).toThrow(InvalidCiphertextError);
    expect(() => tokens.decrypt('v1.a.b', 'x')).toThrow(InvalidCiphertextError);
    expect(() => tokens.decrypt('v2.a.b.c', 'x')).toThrow(
      InvalidCiphertextError,
    );
  });

  it('exige una clave de 64 caracteres hexadecimales', () => {
    expect(() => new TokenCipher('corta')).toThrow();
    expect(() => new TokenCipher('z'.repeat(64))).toThrow();
    expect(() => new TokenCipher(KEY.toUpperCase())).not.toThrow();
  });
});

describe('estado de OAuth', () => {
  const state = {
    organizationId: 'aromos',
    userId: 'user-1',
    nonce: newNonce(),
    expiresAt: 1_000 + STATE_TTL_MS,
  };

  it('sella el estado con caracteres que APS acepta y lo abre mientras no vence', () => {
    const sealed = sealState(cipher(), state);
    expect(sealed).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(openState(cipher(), sealed, 1_000)).toEqual(state);
    expect(openState(cipher(), sealed, state.expiresAt)).toBeNull();
  });

  it('no abre un estado alterado, de otra clave o que no es suyo', () => {
    const sealed = sealState(cipher(), state);
    expect(openState(new TokenCipher('c'.repeat(64)), sealed, 0)).toBeNull();
    expect(openState(cipher(), `${sealed}x`, 0)).toBeNull();
    expect(
      openState(cipher(), cipher().encrypt('{}', 'aps-oauth-state'), 0),
    ).toBeNull();
    expect(
      openState(cipher(), cipher().encrypt(JSON.stringify(state), 'otro'), 0),
    ).toBeNull();
  });

  it('compara el nonce sin atajos', () => {
    const nonce = newNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sameNonce(nonce, nonce)).toBe(true);
    expect(sameNonce(nonce, newNonce())).toBe(false);
    expect(sameNonce(nonce, 'corto')).toBe(false);
  });
});

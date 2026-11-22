import { TokenCipher } from '../../src/infra/adapters/TokenCipher.ts';

const SECRET = 'una-clave-larga-de-prueba';

describe('TokenCipher', () => {
  it('cifra y descifra, con un sello distinto cada vez', () => {
    const cipher = new TokenCipher(SECRET);
    const first = cipher.encrypt('1//refresh-token');
    const second = cipher.encrypt('1//refresh-token');

    expect(first).not.toContain('refresh-token');
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe('1//refresh-token');
    expect(cipher.decrypt(second)).toBe('1//refresh-token');
  });

  it('no descifra con otra clave ni un sello alterado', () => {
    const sealed = new TokenCipher(SECRET).encrypt('1//refresh-token');
    const parts = sealed.split('.');
    const tampered = [...parts.slice(0, 3), `x${parts[3]?.slice(1)}`].join('.');

    expect(() =>
      new TokenCipher('otra-clave-larga-distinta').decrypt(sealed),
    ).toThrow();
    expect(() => new TokenCipher(SECRET).decrypt(tampered)).toThrow();
    expect(() => new TokenCipher(SECRET).decrypt('texto plano')).toThrow(
      /formato/,
    );
  });

  it('pide una clave de al menos 16 caracteres', () => {
    expect(() => new TokenCipher('corta')).toThrow(/16/);
  });
});

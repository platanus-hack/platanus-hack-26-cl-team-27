import { describe, expect, it } from 'vitest';

import { errorDigest } from './route-error';

describe('errorDigest', () => {
  it('lee el digest si Next lo entrega', () => {
    expect(errorDigest(Object.assign(new Error('x'), { digest: 'abc' }))).toBe(
      'abc',
    );
  });

  it('devuelve null si no hay', () => {
    expect(errorDigest(new Error('x'))).toBeNull();
    expect(errorDigest(null)).toBeNull();
    expect(errorDigest({ digest: '' })).toBeNull();
  });
});

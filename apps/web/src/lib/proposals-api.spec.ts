import { describe, expect, it } from 'vitest';

import { isActive, statusLabel, toProposalStatus } from './proposals-api';

describe('estados', () => {
  it('traduce los estados, incluido el reemplazo del lago', () => {
    expect(statusLabel('merged')).toBe('Fusionada');
    expect(statusLabel('superseded')).toBe('Reemplazada');
    expect(toProposalStatus('superseded')).toBe('replaced');
    expect(toProposalStatus('desconocido')).toBeNull();
  });

  it('una propuesta abierta o en disputa sigue activa', () => {
    expect(isActive('open')).toBe(true);
    expect(isActive('disputed')).toBe(true);
    expect(isActive('merged')).toBe(false);
    expect(isActive('withdrawn')).toBe(false);
  });
});

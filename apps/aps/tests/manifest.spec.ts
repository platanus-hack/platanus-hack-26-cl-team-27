import type { Manifest } from '@aps_sdk/model-derivative';

import { collectMessages, has3dView, statusOf } from '../src/manifest.ts';

const manifest = (value: unknown): Manifest => value as Manifest;

describe('statusOf', () => {
  it('reconoce los estados del manifiesto y trata lo demás como pendiente', () => {
    expect(statusOf(null)).toBe('pending');
    expect(statusOf(manifest({ status: 'success' }))).toBe('success');
    expect(statusOf(manifest({ status: 'inprogress' }))).toBe('inprogress');
    expect(statusOf(manifest({ status: 'raro' }))).toBe('pending');
  });
});

describe('collectMessages', () => {
  it('junta los mensajes de todo el árbol sin repetirlos', () => {
    expect(
      collectMessages(
        manifest({
          derivatives: [
            {
              messages: [
                { type: 'warning', code: 'W1', message: ['sin', 'vistas'] },
              ],
              children: [
                {
                  messages: [
                    { type: 'warning', code: 'W1', message: ['sin', 'vistas'] },
                    { code: 'I2', message: 'listo' },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toEqual(['warning W1: sin vistas', 'info I2: listo']);
  });
});

describe('has3dView', () => {
  it('encuentra una geometría 3D a cualquier profundidad', () => {
    expect(
      has3dView(
        manifest({
          derivatives: [
            {
              children: [
                { type: 'geometry', role: '2d' },
                {
                  type: 'folder',
                  children: [{ type: 'geometry', role: '3d' }],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      has3dView(
        manifest({
          derivatives: [{ children: [{ type: 'geometry', role: '2d' }] }],
        }),
      ),
    ).toBe(false);
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rvtFiles, toUrn } from '../src/publish.ts';

describe('toUrn', () => {
  it('codifica el objectId de OSS en base64 para URL', () => {
    expect(toUrn('urn:adsk.objects:os.object:b/caso-estructura.rvt')).toBe(
      Buffer.from('urn:adsk.objects:os.object:b/caso-estructura.rvt').toString(
        'base64url',
      ),
    );
    expect(toUrn('urn:adsk.objects:os.object:b/a.rvt')).not.toMatch(/[+/=]/);
  });
});

describe('rvtFiles', () => {
  it('lista solo los .rvt de la carpeta, ordenados', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'aps-'));
    try {
      for (const file of ['b.rvt', 'A.RVT', 'notas.txt', 'a.rvt.bak']) {
        await writeFile(join(folder, file), '');
      }
      expect(await rvtFiles(folder)).toEqual(['A.RVT', 'b.rvt']);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('da una lista vacía si la carpeta no existe', async () => {
    expect(await rvtFiles(join(tmpdir(), 'aps-no-existe-0'))).toEqual([]);
  });
});

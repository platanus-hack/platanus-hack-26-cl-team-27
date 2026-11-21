import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { apiRoot } from '../../src/common/api-root.ts';

describe('apiRoot', () => {
  it('da la carpeta del package.json de la API', () => {
    const manifest = JSON.parse(
      readFileSync(join(apiRoot(), 'package.json'), 'utf8'),
    ) as { name: string };
    expect(manifest.name).toBe('@team27/api');
  });

  it('llega a la misma carpeta desde un archivo compilado en dist', () => {
    const compiled = pathToFileURL(
      join(apiRoot(), 'dist', 'modules', 'aps', 'models-catalog.js'),
    ).href;
    expect(apiRoot(compiled)).toBe(apiRoot());
  });
});

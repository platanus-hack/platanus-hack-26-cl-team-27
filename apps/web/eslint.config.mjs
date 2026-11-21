import nextPlugin from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';

import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  nextPlugin.configs['core-web-vitals'],
  {
    ignores: ['.next/**/*', '**/out-tsc', 'next-env.d.ts'],
  },
];

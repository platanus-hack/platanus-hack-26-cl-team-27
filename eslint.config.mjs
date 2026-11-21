import nx from '@nx/eslint-plugin';

const onlyRelative = (message) => ({ regex: '^(?!\\.{1,2}/)', message });

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/.next',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mts',
      '**/*.mjs',
    ],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:context',
                'type:data',
                'type:package',
                'type:lib',
              ],
            },
            {
              sourceTag: 'type:context',
              onlyDependOnLibsWithTags: ['type:data', 'type:lib'],
            },
            { sourceTag: 'type:data', onlyDependOnLibsWithTags: ['type:lib'] },
            {
              sourceTag: 'type:package',
              onlyDependOnLibsWithTags: ['type:package', 'type:lib'],
            },
            { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            onlyRelative('domain solo importa archivos de domain.'),
            {
              group: ['**/application/**', '**/infra/**'],
              message: 'domain no conoce application ni infra.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            onlyRelative(
              'application solo importa domain y application: lo externo entra por un puerto.',
            ),
            {
              group: ['**/infra/**'],
              message:
                'application no importa infra: define un puerto en application/ports.',
            },
          ],
        },
      ],
    },
  },
];

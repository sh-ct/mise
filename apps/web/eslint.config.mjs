import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'mise',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'mise',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // component → store → repository: only repositories and the client token touch supabase-js.
    files: ['**/*.ts'],
    ignores: [
      '**/app/core/**/*.repository.ts',
      '**/app/core/**/*.repository.spec.ts',
      '**/app/core/supabase/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@supabase/*/**'],
              allowTypeImports: true,
              message: 'Use a repository (component → store → repository).',
            },
            {
              group: ['**/supabase/supabase'],
              message: 'Only repositories inject SUPABASE.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];

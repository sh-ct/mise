import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // core must stay portable (browser, Deno edge functions, a future Node API)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', 'rxjs', 'rxjs/*'],
              message: 'core must not depend on Angular.',
            },
            {
              group: ['@supabase/*'],
              message: 'core must not depend on Supabase.',
            },
          ],
        },
      ],
    },
  },
];

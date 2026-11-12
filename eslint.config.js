// ESLint flat config for Ledgerly (TypeScript, ESM).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output and dependencies are never linted.
    ignores: ['dist/', 'node_modules/', 'drizzle/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // The vulnerable handler intentionally skips an ownership check; it is
      // documented in the code, not an accidental unused var. Keep the ruleset
      // strict otherwise.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/generated/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['src/client/**/*.{ts,tsx}', 'src/shared/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['**/server/**', '@specsentry/server', '@specsentry/server/*'] }] },
  },
  {
    files: ['src/client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', URL: 'readonly', AbortSignal: 'readonly' } } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: { module: 'readonly', require: 'readonly' } }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
);

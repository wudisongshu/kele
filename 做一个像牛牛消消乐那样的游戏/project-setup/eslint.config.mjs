// WHY: Centralizes linting rules to catch type errors and style issues early,
// preventing runtime errors caused by loose typing in game state management.
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import eslintJavaScript from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import eslintPrettierConfig from 'eslint-config-prettier';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export default typescriptEslint.config(
  eslintJavaScript.configs.recommended,
  ...typescriptEslint.configs.strictTypeChecked,
  ...typescriptEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: currentDirectory,
      },
    },
    rules: {
      // Prevent explicit any usage to maintain strict typing guarantees
      '@typescript-eslint/no-explicit-any': 'error',
      // Require return types on exported functions for API clarity
      '@typescript-eslint/explicit-function-return-type': 'warn',
      // Allow underscore prefix for intentionally unused parameters (callbacks, overrides)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  eslintPrettierConfig
);

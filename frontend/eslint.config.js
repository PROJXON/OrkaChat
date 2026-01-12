// ESLint v9+ flat config
// Keep this intentionally light: enforce correctness + unused cleanup without
// introducing risky style churn across the whole repo.

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');
const prettierPlugin = require('eslint-plugin-prettier');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.amplify/**',
      '**/web-build/**',
      '**/coverage/**',
      '**/android/**',
      '**/ios/**',
    ],
  },

  // TypeScript / TSX
  {
    files: ['App.{ts,tsx}', '*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        // Deliberately *not* setting `project` to avoid type-aware lint perf cost.
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
      'unused-imports': unusedImportsPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React Hooks correctness
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // RN: avoid false-positives; keep very light.
      'react-native/no-inline-styles': 'off',
      'react-native/no-raw-text': 'off',

      // Prefer TS's unused-vars checks, but enforced via ESLint for better UX.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Best UX for cleanup: auto-fixable unused imports, and unused vars with '_' escape hatch.
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // `any` policy:
      // - Globally: don't spam the whole repo with legacy warnings.
      // - Scoped override below: enforce (as warn) in actively-refactored app shell + entrypoints.
      '@typescript-eslint/no-explicit-any': 'off',

      // Formatting: keep off for now; can be enabled repo-wide later.
      'prettier/prettier': 'off',
    },
  },

  // Enforce "no explicit any" only in our actively-cleaned surfaces.
  {
    files: [
      'App.{ts,tsx}',
      'src/screens/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/components/InAppCameraModal.tsx',
      'src/features/appShell/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];


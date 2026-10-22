import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['**/node_modules/**', 'client/out/**', 'server/out/**'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  {
    rules: {
      semi: [2, 'always'],
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/no-non-null-assertion': 0
    }
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      // Chai uses property assertions such as expect(value).to.be.true.
      '@typescript-eslint/no-unused-expressions': 0
    }
  }
];

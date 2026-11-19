import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'node',
    env: { TYPESAFE_API_KEY: '' },
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
});

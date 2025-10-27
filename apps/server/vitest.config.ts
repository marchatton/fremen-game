import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resolveFromRoot = (...segments: string[]) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', ...segments);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@fremen/shared': resolveFromRoot('packages', 'shared', 'src', 'index.ts'),
    },
  },
});

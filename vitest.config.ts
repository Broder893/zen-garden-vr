import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure modules only (saving, levels, breathing, seasons, the change
// queue). They import garden-components.ts, which declares ECS components with
// @iwsdk/core: a tiny stand-in keeps the engine (and WebGL) out of Node.
export default defineConfig({
  resolve: {
    alias: { '@iwsdk/core': fileURLToPath(new URL('./test/stubs/iwsdk-core.ts', import.meta.url)) },
  },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});

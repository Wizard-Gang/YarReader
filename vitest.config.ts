import { defineConfig } from "vitest/config";

/*
 * Browser/presentation test boundary.
 *
 * `node:test` keeps ownership of the pipeline, filesystem, archive and export
 * transaction suites under `test/*.test.ts`. Vitest owns only the tests that
 * need a DOM, so the two boundaries never compete for the same files.
 */
export default defineConfig({
  test: {
    include: ["test/browser/**/*.test.ts"],
    environment: "jsdom",
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: "forks",
    server: {
      deps: {
        /*
         * Load the compiled product natively instead of letting Vite transform
         * it. The exporter resolves its portable viewer assets relative to its
         * own `import.meta.url`, which only holds for the real `dist/` layout.
         */
        external: [/[\\/]dist[\\/]/],
      },
    },
  },
});

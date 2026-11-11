/** Compiles shared Node runtime sources to portable ESM JavaScript without changing maintained source extensions. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['packages/runtime-node/src/index.ts', 'packages/runtime-node/src/runner.ts'],
  outdir: 'packages/runtime-node/dist',
  bundle: true,
  // Bundle the shared expression transformer and parser; keep the Node-only compiler external.
  external: ['typescript'],
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
});

/** Compiles Electron TypeScript to CommonJS JavaScript supported by its sandboxed preload. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['apps/desktop/src/main.ts', 'apps/desktop/src/preload.ts'],
  outdir: 'apps/desktop/dist',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
});

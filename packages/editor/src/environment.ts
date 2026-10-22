/** Selects environment-specific Monaco libraries so Node globals do not leak into Browser editing. */
import type { Monaco } from '@monaco-editor/react';
import type { Environment } from '@code-editor/core';

let revision = 0;

/** @param monaco Mounted editor API. @param environment Runtime whose globals and module types should be offered. */
export async function configureEnvironment(monaco: Monaco, environment: Environment) {
  const current = ++revision;
  const definitions = environment === 'node' ? (await import('./nodeDefinitions')).definitions : [];
  if (current !== revision) return;
  for (const defaults of [
    monaco.typescript.typescriptDefaults,
    monaco.typescript.javascriptDefaults,
  ]) {
    defaults.setCompilerOptions({
      ...defaults.getCompilerOptions(),
      target: monaco.typescript.ScriptTarget.ESNext,
      module: monaco.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
      lib: environment === 'node' ? ['lib.esnext.d.ts'] : ['lib.esnext.d.ts', 'lib.webworker.d.ts'],
      types: environment === 'node' ? ['node'] : [],
      typeRoots: ['file:///node_modules/@types'],
      allowNonTsExtensions: true,
      noEmit: false,
    });
    defaults.setExtraLibs(definitions);
  }
}

/** Configures bundled Monaco workers, the local loader, and JavaScript emission settings. */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/languages/features/typescript/ts.worker.js?worker';

self.MonacoEnvironment = {
  /**
   * Supplies a worker for the requested editor service.
   * @param _moduleId Monaco module identifier; the service label selects the implementation here.
   * @param label Requested language/service; JavaScript and TypeScript use the compiler worker.
   */
  getWorker(_moduleId, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new TypeScriptWorker();
    }

    return new EditorWorker();
  },
};

loader.config({ monaco });

monaco.typescript.typescriptDefaults.setCompilerOptions({
  ...monaco.typescript.typescriptDefaults.getCompilerOptions(),
  target: monaco.typescript.ScriptTarget.ESNext,
  module: monaco.typescript.ModuleKind.ESNext,
  noEmit: false,
  sourceMap: false,
});

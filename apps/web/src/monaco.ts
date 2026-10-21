import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import EditorWorker from
  'monaco-editor/esm/vs/editor/editor.worker?worker';
import TypeScriptWorker from
  'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new TypeScriptWorker();
    }

    return new EditorWorker();
  },
};

loader.config({ monaco });

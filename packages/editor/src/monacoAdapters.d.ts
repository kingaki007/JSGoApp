/** Types the pinned Monaco adapter entry point used to own subscription-controlled providers. */
declare module 'monaco-editor/languages/features/typescript/tsMode.js' {
  import type { Uri, languages, typescript } from 'monaco-editor';

  type Worker = (...resources: Uri[]) => Promise<typescript.TypeScriptWorker>;

  export class LibFiles {
    /** @param worker Language worker that supplies library declaration text. */
    constructor(worker: Worker);
  }

  export const DefinitionAdapter: {
    new (libraries: LibFiles, worker: Worker): languages.DefinitionProvider;
  };
  export const SuggestAdapter: {
    new (worker: Worker): languages.CompletionItemProvider;
  };
  export const QuickInfoAdapter: {
    new (worker: Worker): languages.HoverProvider;
  };
  export const SignatureHelpAdapter: {
    new (worker: Worker): languages.SignatureHelpProvider;
  };
}

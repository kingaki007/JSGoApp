import type { Language } from '@code-editor/core';
import type { Monaco } from '@monaco-editor/react';

export async function compileSource(
  monaco: Monaco,
  source: string,
  language: Language,
): Promise<string> {
  if (language === 'javascript') return source;
  const uri = monaco.Uri.parse(`inmemory://execution/${crypto.randomUUID()}.ts`);
  // Compile a snapshot so typing while a run starts cannot change its source.
  const model = monaco.editor.createModel(source, 'typescript', uri);
  try {
    const getWorker = await monaco.typescript.getTypeScriptWorker();
    const worker = await getWorker(uri);
    const diagnostics = await worker.getSyntacticDiagnostics(uri.toString());
    if (diagnostics.length) {
      const diagnostic = diagnostics[0];
      const location = model.getPositionAt(diagnostic.start ?? 0);
      const message =
        typeof diagnostic.messageText === 'string'
          ? diagnostic.messageText
          : diagnostic.messageText?.messageText;
      throw new Error(
        `TypeScript ${location.lineNumber}:${location.column}: ${message ?? 'Syntax error'}`,
      );
    }
    const output = await worker.getEmitOutput(uri.toString());
    const javascript = output.outputFiles.find((file: { name: string; text: string }) =>
      file.name.endsWith('.js'),
    );
    if (!javascript || output.emitSkipped) throw new Error('TypeScript could not be compiled.');
    return javascript.text;
  } finally {
    model.dispose();
  }
}

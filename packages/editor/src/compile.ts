/** Compiles TypeScript snapshots through Monaco and releases temporary models on every exit path. */
import type { Language } from '@code-editor/core';
import type { Monaco } from '@monaco-editor/react';
import { decodeLineMap } from '@code-editor/core/sourceMap';

export interface CompiledSource {
  /** Executable JavaScript. */
  code: string;
  /** Draft line for each line of code (index = code line - 1); absent when lines are unchanged. */
  lineMap?: number[];
}

/**
 * Passes JavaScript through or emits JavaScript from an isolated TypeScript model.
 * @param monaco Initialized Monaco API used to create the snapshot and obtain its language worker.
 * @param source Complete source text captured for this run.
 * @param language Determines whether compilation is necessary.
 * @returns Executable JavaScript and its line mapping; rejects on syntax, emission, or service failures.
 */
export async function compileSource(
  monaco: Monaco,
  source: string,
  language: Language,
): Promise<CompiledSource> {
  if (language === 'javascript') return { code: source };
  const uri = monaco.Uri.parse(`inmemory://execution/${crypto.randomUUID()}.ts`);
  // Compile a snapshot so typing while a run starts cannot change its source.
  // Mark the snapshot as its own module so its declarations cannot collide with the visible draft.
  const model = monaco.editor.createModel(`${source}\nexport {};\n`, 'typescript', uri);
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
      // The line travels with the error so the host can show it beside the draft line.
      throw Object.assign(
        new Error(
          `TypeScript ${location.lineNumber}:${location.column}: ${message ?? 'Syntax error'}`,
        ),
        { line: location.lineNumber },
      );
    }
    const output = await worker.getEmitOutput(uri.toString());
    const files: Array<{ name: string; text: string }> = output.outputFiles;
    const javascript = files.find((file) => file.name.endsWith('.js'));
    if (!javascript || output.emitSkipped) throw new Error('TypeScript could not be compiled.');
    // Remove only the compiler's map reference and our trailing empty-module marker.
    const code = javascript.text
      .replace(/\n?\/\/# sourceMappingURL=\S*\s*$/, '')
      .replace(/\nexport \{\};\s*$/, '');
    return { code, lineMap: readLineMap(files.find((file) => file.name.endsWith('.js.map'))) };
  } finally {
    model.dispose();
  }
}

/**
 * Extracts line origins from the emitted map; type-only lines make emitted lines differ from the draft.
 * @param file Optional `.js.map` output; missing or malformed maps fall back to unchanged lines.
 */
function readLineMap(file: { text: string } | undefined): number[] | undefined {
  if (!file) return undefined;
  try {
    const mappings: unknown = JSON.parse(file.text).mappings;
    return typeof mappings === 'string' ? decodeLineMap(mappings) : undefined;
  } catch {
    return undefined;
  }
}

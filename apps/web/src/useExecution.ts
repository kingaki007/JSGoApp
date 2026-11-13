/** Coordinates source compilation, execution, streamed output, and cancellation for the active draft. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeEditorHandle } from '@code-editor/editor';
import type { Environment, InspectedValue, Language, RunResult } from '@code-editor/core';
import { BrowserRuntime } from './runtime';
import { NodeRuntime } from './nodeRuntime';

export interface ExecutionView extends RunResult {
  /** Draft that produced this output; output is hidden once another draft is shown. */
  documentId: string;
  language: Language;
  /** Draft line for each entry in lines; 0 when the origin is unknown. */
  sourceLines: number[];
  /** Inspected arguments for each entry in lines; null when the text is the whole value. */
  details: Array<InspectedValue[] | null>;
  status: 'running' | 'complete' | 'error' | 'stopped';
}

/**
 * Translates a line of executed JavaScript to the draft line the user sees.
 * @param line 1-based executed-code line reported by a runtime; 0 or undefined when unknown.
 * @param lineMap Compiler line origins, absent when executed and draft lines are identical.
 */
export function toDraftLine(line: number | undefined, lineMap?: number[]): number {
  if (!line) return 0;
  return lineMap ? (lineMap[line - 1] ?? 0) : line;
}

/**
 * Keeps run state separate from the editor and ignores results from canceled runs.
 * @param documentId Active draft; changing it cancels the current run and hides its output.
 * @param language Language of the active draft.
 * @param source Current source code captured when Run is requested.
 * @param environment Sandboxed Browser page or actual Node execution on the host.
 * @param showUndefined Whether undefined expression results are reported.
 * @param inspect Whether runtimes also send expandable trees for objects and collections.
 * @param webMount Web view element that shows the Browser page; null runs pages off screen.
 */
export function useExecution(
  documentId: string,
  language: Language,
  source: string,
  environment: Environment,
  showUndefined = false,
  inspect = false,
  webMount: HTMLElement | null = null,
) {
  const [browser] = useState(() => new BrowserRuntime());
  const [node] = useState(() => new NodeRuntime());
  const runtime = environment === 'node' ? node : browser;
  const requestId = useRef<string | null>(null);
  const [result, setResult] = useState<ExecutionView | null>(null);
  const [isRunning, setRunning] = useState(false);

  useEffect(() => {
    // Moving the page ends its run inside the runtime; release this hook's run as well so a
    // rerun requested for the new location is not ignored.
    if (requestId.current) {
      requestId.current = null;
      setRunning(false);
    }
    browser.setMount(webMount);
  }, [browser, webMount]);

  useEffect(() => {
    setResult(null);
    setRunning(false);
    return () => {
      requestId.current = null;
      runtime.stop();
    };
  }, [documentId, language, runtime]);

  /**
   * Compiles a source snapshot and starts one run in the selected environment.
   * @param editor Ready shared-editor handle; null prevents running before initialization.
   */
  const run = useCallback(
    async (editor: CodeEditorHandle | null) => {
      if (!editor || requestId.current) return;
      const id = crypto.randomUUID();
      requestId.current = id;
      setRunning(true);
      setResult({
        id,
        documentId,
        language,
        lines: [],
        sourceLines: [],
        details: [],
        status: 'running',
      });
      try {
        const { code, lineMap } = await editor.compile(source, language);
        if (requestId.current !== id) return;
        const output = await runtime.run(
          {
            id,
            code,
            environment,
            ...(showUndefined ? { showUndefined } : {}),
            ...(inspect ? { inspect } : {}),
          },
          (line, sourceLine, values) => {
            if (requestId.current !== id) return;
            setResult((current) =>
              current?.id === id
                ? {
                    ...current,
                    lines: [...current.lines, line],
                    sourceLines: [...current.sourceLines, toDraftLine(sourceLine, lineMap)],
                    details: [...current.details, values ?? null],
                  }
                : current,
            );
          },
        );
        if (requestId.current !== id) return;
        setResult({
          ...output,
          sourceLines: output.lines.map((_line, index) =>
            toDraftLine(output.sourceLines?.[index], lineMap),
          ),
          details: output.lines.map((_line, index) => output.details?.[index] ?? null),
          documentId,
          language,
          status: output.error ? 'error' : 'complete',
        });
      } catch (error) {
        if (requestId.current !== id) return;
        setResult({
          id,
          documentId,
          language,
          lines: [],
          sourceLines: [],
          details: [],
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
        });
      } finally {
        if (requestId.current === id) {
          requestId.current = null;
          setRunning(false);
        }
      }
    },
    [documentId, environment, language, runtime, source, showUndefined, inspect],
  );

  /** Cancels compilation results and ends the active run while keeping existing output. */
  const stop = useCallback(() => {
    requestId.current = null;
    runtime.stop();
    setRunning(false);
    setResult((current) =>
      current ? { ...current, error: 'Execution stopped.', status: 'stopped' } : current,
    );
  }, [runtime]);

  /** Cancels active work after an edit without changing already finished output. */
  const cancelActive = useCallback(() => {
    if (requestId.current) stop();
  }, [stop]);

  /** Clears finished output; active runs keep their output until they finish or stop. */
  const clear = useCallback(() => {
    if (!requestId.current) setResult(null);
  }, []);

  return {
    result: result?.documentId === documentId ? result : null,
    isRunning,
    run,
    stop,
    clear,
    cancelActive,
  };
}

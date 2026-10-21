/** Coordinates compilation, worker or DOM execution, streamed output, and draft cancellation. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeEditorHandle } from '@code-editor/editor';
import type { Language, RunResult } from '@code-editor/core';
import { BrowserRuntime } from './runtime';
import { DocumentRuntime } from './documentRuntime';

export type BrowserTarget = 'worker' | 'document';

export interface ExecutionView extends RunResult {
  language: Language;
  status: 'running' | 'complete' | 'error' | 'stopped';
}

/**
 * Keeps run state separate from the editor and ignores results from canceled runs.
 * @param language Active scratchpad language; changing it cancels the current run.
 * @param source Current source code captured when Run is requested.
 * @param target Worker for scripts, or a sandboxed document for DOM code.
 */
export function useExecution(language: Language, source: string, target: BrowserTarget = 'worker') {
  const [worker] = useState(() => new BrowserRuntime());
  const [documentRuntime] = useState(() => new DocumentRuntime());
  const runtime = target === 'document' ? documentRuntime : worker;
  /** @param frame Preview element owned by React; stable callback avoids remount cancellations. */
  const attachPreview = useCallback(
    (frame: HTMLIFrameElement | null) => documentRuntime.attach(frame),
    [documentRuntime],
  );
  const requestId = useRef<string | null>(null);
  const [result, setResult] = useState<ExecutionView | null>(null);
  const [isRunning, setRunning] = useState(false);

  useEffect(() => {
    setResult(null);
    setRunning(false);
    return () => {
      requestId.current = null;
      runtime.stop();
      documentRuntime.stop();
    };
  }, [language, runtime, documentRuntime]);

  /**
   * Compiles a source snapshot and executes it once in the selected browser runtime.
   * @param editor Ready shared-editor handle; null prevents running before initialization.
   */
  async function run(editor: CodeEditorHandle | null) {
    if (!editor || requestId.current) return;
    runtime.stop();
    const id = crypto.randomUUID();
    requestId.current = id;
    setRunning(true);
    setResult({ id, language, lines: [], status: 'running' });
    try {
      const code = await editor.compile(source, language);
      if (requestId.current !== id) return;
      const output = await runtime.run({ id, code, environment: 'browser' }, (line) => {
        if (target === 'worker' && requestId.current !== id) return;
        setResult((current) =>
          current?.id === id ? { ...current, lines: [...current.lines, line] } : current,
        );
      });
      if (requestId.current !== id) return;
      setResult({ ...output, language, status: output.error ? 'error' : 'complete' });
    } catch (error) {
      if (requestId.current !== id) return;
      setResult({
        id,
        language,
        lines: [],
        error: error instanceof Error ? error.message : String(error),
        status: 'error',
      });
    } finally {
      if (requestId.current === id) {
        requestId.current = null;
        setRunning(false);
      }
    }
  }

  /** Cancels compilation and disposes the active worker or preview while keeping existing output. */
  function stop() {
    requestId.current = null;
    runtime.stop();
    setRunning(false);
    setResult((current) =>
      current ? { ...current, error: 'Execution stopped.', status: 'stopped' } : current,
    );
  }

  /** Clears finished output; active runs keep their output until they finish or stop. */
  function clear() {
    if (!requestId.current) {
      setResult((current) =>
        target === 'document' && current ? { ...current, lines: [], error: undefined } : null,
      );
    }
  }

  return {
    result: result?.language === language ? result : null,
    isRunning,
    run,
    stop,
    clear,
    attachPreview,
  };
}

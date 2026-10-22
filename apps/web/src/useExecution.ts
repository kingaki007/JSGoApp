/** Coordinates source compilation, worker execution, streamed output, and cancellation for the active draft. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeEditorHandle } from '@code-editor/editor';
import type { Environment, Language, RunResult } from '@code-editor/core';
import { BrowserRuntime } from './runtime';
import { NodeRuntime } from './nodeRuntime';

export interface ExecutionView extends RunResult {
  language: Language;
  status: 'running' | 'complete' | 'error' | 'stopped';
}

/**
 * Keeps run state separate from the editor and ignores results from canceled runs.
 * @param language Active scratchpad language; changing it cancels the current run.
 * @param source Current source code captured when Run is requested.
 * @param environment Browser worker or actual Node execution on the host.
 */
export function useExecution(language: Language, source: string, environment: Environment) {
  const [browser] = useState(() => new BrowserRuntime());
  const [node] = useState(() => new NodeRuntime());
  const runtime = environment === 'node' ? node : browser;
  const requestId = useRef<string | null>(null);
  const [result, setResult] = useState<ExecutionView | null>(null);
  const [isRunning, setRunning] = useState(false);

  useEffect(() => {
    setResult(null);
    setRunning(false);
    return () => {
      requestId.current = null;
      runtime.stop();
    };
  }, [language, runtime]);

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
      setResult({ id, language, lines: [], status: 'running' });
      try {
        const code = await editor.compile(source, language);
        if (requestId.current !== id) return;
        const output = await runtime.run({ id, code, environment }, (line) => {
          if (requestId.current !== id) return;
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
    },
    [environment, language, runtime, source],
  );

  /** Cancels compilation results and terminates an active worker while keeping existing output. */
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
    result: result?.language === language ? result : null,
    isRunning,
    run,
    stop,
    clear,
    cancelActive,
  };
}

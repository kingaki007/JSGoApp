import { useEffect, useRef, useState } from 'react';
import type { CodeEditorHandle } from '@code-editor/editor';
import type { Language, RunResult } from '@code-editor/core';
import { BrowserRuntime } from './runtime';

export interface ExecutionView extends RunResult {
  language: Language;
  status: 'running' | 'complete' | 'error' | 'stopped';
}

export function useExecution(language: Language, source: string) {
  const [runtime] = useState(() => new BrowserRuntime());
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

  async function run(editor: CodeEditorHandle | null) {
    if (!editor || requestId.current) return;
    const id = crypto.randomUUID();
    requestId.current = id;
    setRunning(true);
    setResult({ id, language, lines: [], status: 'running' });
    try {
      const code = await editor.compile(source, language);
      if (requestId.current !== id) return;
      const output = await runtime.run({ id, code, environment: 'browser' }, (line) => {
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
  }

  function stop() {
    requestId.current = null;
    runtime.stop();
    setRunning(false);
    setResult((current) =>
      current ? { ...current, error: 'Execution stopped.', status: 'stopped' } : current,
    );
  }

  return {
    result: result?.language === language ? result : null,
    isRunning,
    run,
    stop,
    clear: () => {
      if (!requestId.current) setResult(null);
    },
  };
}

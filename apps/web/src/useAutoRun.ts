/** Debounces execution after edits and coordinates manual Run/Stop with the pending automatic run. */
import { useCallback, useEffect, useRef, useState } from 'react';

export const autoRunDelayMs = 2000;

interface AutoRunOptions {
  source: string;
  ready: boolean;
  enabled: boolean;
  /** Executes the current language/environment snapshot; its identity changes when that snapshot changes. */
  run(): void;
  /** Cancels any in-flight execution while preserving finished output. */
  cancelExecution(): void;
  /** Clears stale output when the editor becomes empty. */
  clearOutput(): void;
}

/** @param options Current source, readiness, mode, and stable execution callbacks. */
export function useAutoRun({
  source,
  ready,
  enabled,
  run,
  cancelExecution,
  clearOutput,
}: AutoRunOptions) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, setPending] = useState(false);

  /** Removes a pending timer without state updates during unmount cleanup. */
  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /** Cancels a scheduled run and updates its visible waiting state. */
  const cancelPending = useCallback(() => {
    clearTimer();
    setPending(false);
  }, [clearTimer]);

  useEffect(() => {
    clearTimer();
    cancelExecution();
    if (!source.trim()) clearOutput();
    if (!enabled || !ready || !source.trim()) {
      setPending(false);
      return clearTimer;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPending(false);
      run();
    }, autoRunDelayMs);
    return clearTimer;
  }, [source, ready, enabled, run, cancelExecution, clearOutput, clearTimer]);

  /** Runs immediately and prevents the pending automatic timer from duplicating this execution. */
  const runNow = useCallback(() => {
    cancelPending();
    run();
  }, [cancelPending, run]);

  /** Stops pending and active automatic work; the next edit or context change can schedule another run. */
  const stop = useCallback(() => {
    cancelPending();
    cancelExecution();
  }, [cancelPending, cancelExecution]);

  return { isPending, runNow, stop };
}

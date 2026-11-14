/** Executes compiled JavaScript inside the sandboxed page and formats bounded console output for the app. */
import {
  createCapture,
  type OutputListener,
  type RunRequest,
  type RunResult,
} from '@code-editor/core';
import { createConsole, type ConsoleLevel } from '@code-editor/core/console';
import { traceError } from '@code-editor/core/errors';
import { captureExpressions } from '@code-editor/core/expressions';
import { createInspector, type InspectedValue } from '@code-editor/core/inspect';
import { createTableBuilder } from '@code-editor/core/table';

/** Run request sent to the page, with the limit its loops enforce from inside. */
export type FrameRequest = RunRequest & { timeoutMs: number };

/** Everything the page posts to the app: readiness, streamed output, and completion. */
export type FrameMessage = ExecutionMessage | { type: 'ready' };

// How long a finished run waits for a late rejection or timer error to be reported.
export const failureSettleMs = 25;

// Names the snippet in engine stacks, so its frames can be told apart from the runner's own.
const scriptName = 'jsgoapp-scratchpad.js';

export type ExecutionMessage =
  | {
      type: 'output';
      id: string;
      line: string;
      sourceLine?: number;
      values?: InspectedValue[] | null;
      level?: ConsoleLevel;
    }
  | { type: 'complete'; result: RunResult };

/**
 * Produces display text without failing on bigint values or circular object references.
 * @param value One console argument to represent as plain text.
 */
function format(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  const seen = new WeakSet<object>();
  return (
    JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'bigint') return `${item}n`;
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    }) ?? String(value)
  );
}

export interface FailureWatch {
  /** Rejects with the first uncaught error or unhandled promise rejection. */
  failed: Promise<never>;
  /** Stops listening; later failures are no longer reported. */
  stop(): void;
}

/**
 * Listens for failures that never reach the snippet's top-level code: errors thrown in timers
 * and event handlers, and promises that reject without being awaited or caught.
 * @param target The page's window, or any event target in tests.
 */
export function watchFailures(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
): FailureWatch {
  let report: (reason: unknown) => void = () => {};
  const failed = new Promise<never>((_resolve, reject) => {
    report = reject;
  });
  // Nothing awaits this promise once the run is over, and that must not count as a failure itself.
  failed.catch(() => {});
  /** @param event `error` or `unhandledrejection` event raised by the snippet's code. */
  const onFailure = (event: Event) => {
    const details = event as Event & { reason?: unknown; error?: unknown; message?: unknown };
    event.preventDefault();
    report(
      event.type === 'unhandledrejection'
        ? details.reason
        : (details.error ?? new Error(String(details.message ?? 'Script error'))),
    );
  };
  target.addEventListener('error', onFailure);
  target.addEventListener('unhandledrejection', onFailure);
  return {
    failed,
    /** Detaches both listeners. */
    stop() {
      target.removeEventListener('error', onFailure);
      target.removeEventListener('unhandledrejection', onFailure);
    },
  };
}

export interface ExecutionOptions {
  /** Whether expression statements evaluating to undefined are reported. */
  showUndefined?: boolean;
  /** Whether objects and collections are also sent as expandable trees. */
  inspect?: boolean;
  /** Limit enforced inside loops, because the app cannot interrupt its own thread. */
  timeoutMs?: number;
  /** Reports failures outside the top-level code; without it only top-level errors fail the run. */
  failures?: FailureWatch;
  /** Values exposed to the snippet as `process.env.NAME`. The page has no real `process` otherwise. */
  env?: Record<string, string>;
}

/**
 * Evaluates JavaScript and awaits explicitly awaited asynchronous work inside a disposable page.
 * @param id Run identifier echoed in the final result.
 * @param code JavaScript source; TypeScript must already have been compiled by the editor.
 * @param onOutput Receives each formatted console line and the code line that produced it.
 * @param options Reporting choices, the time limit, and the optional failure watch.
 */
export async function executeCode(
  id: string,
  code: string,
  onOutput: OutputListener,
  {
    showUndefined = false,
    inspect: inspectValues = false,
    timeoutMs,
    failures,
    env,
  }: ExecutionOptions = {},
): Promise<RunResult> {
  const lines: string[] = [];
  const sourceLines: number[] = [];
  const details: Array<InspectedValue[] | null> = [];
  const levels: ConsoleLevel[] = [];
  const inspector = createInspector(inspectValues);
  const buildTable = createTableBuilder();
  let currentLine = 0;
  let size = 0;
  let truncated = false;
  /**
   * Captures one entry subject to line-count and text-size limits.
   * @param level Console level of the entry. @param values Console arguments or one result.
   * @param kind Marks a `console.table` call, whose first argument may be shown as a table.
   */
  const emit = (level: ConsoleLevel, values: unknown[], kind?: 'table') => {
    if (truncated) return;
    if (lines.length >= 499 || size >= 90_000) {
      const notice = '[Output limit reached. Further logs omitted.]';
      lines.push(notice);
      sourceLines.push(0);
      details.push(null);
      levels.push('log');
      onOutput(notice, 0, null, 'log');
      truncated = true;
      return;
    }
    const table = kind === 'table' ? buildTable(values[0], values[1]) : null;
    const line = (table ? table.text : values.map(format).join(' ')).slice(
      0,
      Math.min(10_000, 90_000 - size),
    );
    size += line.length;
    lines.push(line);
    const inspected = table ? [table.value] : inspector(values);
    sourceLines.push(currentLine);
    details.push(inspected);
    levels.push(level);
    onOutput(line, currentLine, inspected, level);
  };
  /** @param value One automatic expression result, reported as a plain log. */
  const log = (value: unknown) => emit('log', [value]);
  try {
    const transformed = captureExpressions(code);
    const capturedConsole = createConsole(emit);
    const capture = createCapture(
      capturedConsole,
      (line) => {
        currentLine = line;
      },
      log,
      showUndefined,
      timeoutMs,
    );
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    // A local parameter named `process` shadows any outer binding of that name, so this never
    // touches a real global `process` — important when this runs inside a Node test process.
    const processShim = { env: { ...env } };
    const finished: Promise<unknown> = new AsyncFunction(
      'console',
      transformed.captureName,
      'process',
      `"use strict";\n${transformed.code}\n//# sourceURL=${scriptName}`,
    )(capturedConsole, capture, processShim);
    if (failures) {
      // A rejection caused by the last statements is only reported after the code returns, and
      // browsers deliver that report on a later turn of the event loop than a zero-delay timer.
      // Wait briefly before calling the run a success.
      const settled = finished.then(
        () => new Promise((resolve) => setTimeout(resolve, failureSettleMs)),
      );
      await Promise.race([settled, failures.failed]);
    } else {
      await finished;
    }
    return { id, lines, sourceLines, details, levels };
  } catch (error) {
    // The snippet follows one line of preamble inside the generated function.
    const trace = traceError(error, scriptName, 1);
    return {
      id,
      lines,
      sourceLines,
      details,
      levels,
      error: error instanceof Error ? error.message : String(error),
      ...(trace.line ? { errorLine: trace.line, errorFrames: trace.frames } : {}),
    };
  } finally {
    failures?.stop();
  }
}

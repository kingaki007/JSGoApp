/** Executes compiled JavaScript inside a worker and formats bounded console output for the host. */
import { createCapture, type OutputListener, type RunResult } from '@code-editor/core';
import { captureExpressions } from '@code-editor/core/expressions';

export type ExecutionMessage =
  | { type: 'output'; id: string; line: string; sourceLine?: number }
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

/**
 * Evaluates JavaScript and awaits explicitly awaited asynchronous work inside a disposable worker.
 * @param id Run identifier echoed in the final result.
 * @param code JavaScript source; TypeScript must already have been compiled by the editor.
 * @param onOutput Receives each formatted console line and the code line that produced it.
 * @param showUndefined Whether expression statements evaluating to undefined are reported.
 */
export async function executeCode(
  id: string,
  code: string,
  onOutput: OutputListener,
  showUndefined = false,
): Promise<RunResult> {
  const lines: string[] = [];
  const sourceLines: number[] = [];
  let currentLine = 0;
  let size = 0;
  let truncated = false;
  /** @param values Console arguments captured subject to line-count and text-size limits. */
  const log = (...values: unknown[]) => {
    if (truncated) return;
    if (lines.length >= 499 || size >= 90_000) {
      const notice = '[Output limit reached. Further logs omitted.]';
      lines.push(notice);
      sourceLines.push(0);
      onOutput(notice, 0);
      truncated = true;
      return;
    }
    const line = values
      .map(format)
      .join(' ')
      .slice(0, Math.min(10_000, 90_000 - size));
    size += line.length;
    lines.push(line);
    sourceLines.push(currentLine);
    onOutput(line, currentLine);
  };
  try {
    const transformed = captureExpressions(code);
    const capturedConsole = { log, info: log, warn: log, error: log, debug: log, table: log };
    const capture = createCapture(
      capturedConsole,
      (line) => {
        currentLine = line;
      },
      log,
      showUndefined,
    );
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(
      'console',
      transformed.captureName,
      `"use strict";\n${transformed.code}\n//# sourceURL=jsgoapp-scratchpad.js`,
    )(capturedConsole, capture);
    return { id, lines, sourceLines };
  } catch (error) {
    return {
      id,
      lines,
      sourceLines,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Presents console output as a list or aligned with editor lines, plus status, errors, and clearing. */
import { useLayoutEffect, useRef, useState } from 'react';
import type { InspectedValue } from '@code-editor/core';
import { summarize } from '@code-editor/core/inspect';
import type { ExecutionView } from './useExecution';
import { ValueList } from './ValueTree';

export interface LineAlignment {
  /** @param line 1-based draft line. @returns Viewport Y of its top edge, or null when unavailable. */
  lineTop(line: number): number | null;
  /** Editor line height in pixels, used for each result row. */
  lineHeight: number;
  /** Editor font size in pixels, so results read as a continuation of the code. */
  fontSize: number;
}

export interface AlignedOutput {
  /** One entry per draft line with output, in line order; values from one line are joined. */
  rows: Array<{ line: number; text: string; values?: InspectedValue[] }>;
  /** Output whose source line is unknown, shown below the aligned rows. */
  unplaced: string[];
}

/**
 * Groups output by the draft line that produced it.
 * @param lines Output entries in execution order.
 * @param sourceLines Draft line per entry; 0 or missing marks an unknown origin.
 * @param details Inspected arguments per entry; a row gains values when any of its entries has them.
 */
export function alignOutput(
  lines: readonly string[],
  sourceLines: readonly number[],
  details: ReadonlyArray<InspectedValue[] | null> = [],
): AlignedOutput {
  const grouped = new Map<
    number,
    { texts: string[]; values: InspectedValue[]; inspectable: boolean }
  >();
  const unplaced: string[] = [];
  lines.forEach((text, index) => {
    const line = sourceLines[index];
    if (!line) {
      unplaced.push(text);
      return;
    }
    const row = grouped.get(line) ?? { texts: [], values: [], inspectable: false };
    row.texts.push(text.replace(/\s*\n\s*/g, ' '));
    const inspected = details[index];
    // Text-only entries join an inspectable row as plain strings so nothing is lost when it opens.
    row.values.push(...(inspected ?? [{ type: 'string' as const, text }]));
    row.inspectable ||= !!inspected;
    grouped.set(line, row);
  });
  return {
    rows: [...grouped]
      .sort(([first], [second]) => first - second)
      .map(([line, row]) => ({
        line,
        // Inspectable rows preview their values the same way the opened tree labels them.
        text: row.inspectable
          ? row.values.map((value) => summarize(value)).join(' ')
          : row.texts.join('  '),
        ...(row.inspectable ? { values: row.values } : {}),
      })),
    unplaced,
  };
}

/**
 * Renders output as text so logged HTML cannot become active page content.
 * @param props.result Output and status of the latest run; null means no run to display.
 * @param props.isRunning Whether the clear action should be disabled during execution.
 * @param props.onClear Callback that clears output without changing source code.
 * @param props.alignment Editor line geometry; when present, results sit beside their source lines.
 */
export default function OutputPanel({
  result,
  isRunning,
  onClear,
  alignment,
}: {
  result: ExecutionView | null;
  isRunning: boolean;
  onClear(): void;
  alignment?: LineAlignment;
}) {
  const statusLabels = {
    running: 'Running…',
    complete: 'Finished',
    stopped: 'Stopped',
    error: 'Error',
  };
  const status = result ? statusLabels[result.status] : 'Ready';
  const content = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<number | null>(null);
  // Rows are positioned relative to this panel, so its own position is measured after each layout.
  useLayoutEffect(() => {
    const top = content.current?.getBoundingClientRect().top ?? null;
    setOrigin((current) => (current === top ? current : top));
  });
  const aligned =
    alignment && result ? alignOutput(result.lines, result.sourceLines, result.details) : null;
  // One aligned row at a time can be opened; it overlays the rows below until closed.
  const [opened, setOpened] = useState<{ run: string; line: number } | null>(null);
  const errorClass = `output-error ${result?.status === 'stopped' ? 'output-stopped' : ''}`;

  return (
    <section className="output-panel" aria-label="Execution output">
      <header className="output-header">
        <h2>
          Output{' '}
          <span className="output-status" role="status">
            {status}
          </span>
        </h2>
        <button
          type="button"
          className="text-button"
          onClick={onClear}
          disabled={isRunning || !result}
        >
          Clear output
        </button>
      </header>
      {alignment && aligned ? (
        <div
          className="output-content output-aligned"
          ref={content}
          tabIndex={0}
          aria-label="Console output aligned with source lines"
        >
          {origin !== null &&
            aligned.rows.map((row) => {
              const top = alignment.lineTop(row.line);
              if (top === null) return null;
              if (row.values && opened?.run === result?.id && opened?.line === row.line)
                return (
                  <div
                    className="output-row output-row-open"
                    key={row.line}
                    style={{ top: top - origin, fontSize: alignment.fontSize }}
                  >
                    <button
                      type="button"
                      className="value-toggle"
                      aria-expanded="true"
                      aria-label={`Collapse result of line ${row.line}`}
                      onClick={() => setOpened(null)}
                    >
                      <span className="value-arrow" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    <ValueList values={row.values} defaultOpen />
                  </div>
                );
              return (
                <pre
                  className="output-row"
                  key={row.line}
                  title={row.text}
                  style={{
                    top: top - origin,
                    height: alignment.lineHeight,
                    lineHeight: `${alignment.lineHeight}px`,
                    fontSize: alignment.fontSize,
                  }}
                >
                  <span className="visually-hidden">Line {row.line}: </span>
                  {row.values ? (
                    <button
                      type="button"
                      className="value-toggle"
                      aria-expanded="false"
                      onClick={() => setOpened({ run: result?.id ?? '', line: row.line })}
                    >
                      <span className="value-arrow" aria-hidden="true">
                        ▸
                      </span>
                      {row.text}
                    </button>
                  ) : (
                    row.text
                  )}
                </pre>
              );
            })}
          {(aligned.unplaced.length > 0 || result?.error) && (
            <div className="output-aligned-footer">
              {aligned.unplaced.map((line, index) => (
                <pre className="output-line" key={index}>
                  {line || ' '}
                </pre>
              ))}
              {result?.error && <pre className={errorClass}>{result.error}</pre>}
            </div>
          )}
        </div>
      ) : (
        <div className="output-content" ref={content} tabIndex={0} aria-label="Console output">
          {!result && (
            <p className="output-placeholder">Start typing or press Run to see output.</p>
          )}
          {result?.lines.map((line, index) => {
            const values = result.details[index];
            return values ? (
              <div className="output-line output-values" key={index}>
                <ValueList values={values} />
              </div>
            ) : (
              <pre className="output-line" key={index}>
                {line || ' '}
              </pre>
            );
          })}
          {result?.error && <pre className={errorClass}>{result.error}</pre>}
          {result?.status === 'complete' && result.lines.length === 0 && (
            <p className="output-placeholder">
              Finished without expression results or console output.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

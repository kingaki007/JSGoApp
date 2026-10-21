/** Presents console output, execution status, errors, and a clear-output action. */
import type { ExecutionView } from './useExecution';

/**
 * Renders output as text so logged HTML cannot become active page content.
 * @param props.result Output and status of the latest run; null means no run to display.
 * @param props.isRunning Whether the clear action should be disabled during execution.
 * @param props.onClear Callback that clears output without changing source code.
 */
export default function OutputPanel({
  result,
  isRunning,
  onClear,
}: {
  result: ExecutionView | null;
  isRunning: boolean;
  onClear(): void;
}) {
  const statusLabels = {
    running: 'Running…',
    complete: 'Finished',
    stopped: 'Stopped',
    error: 'Error',
  };
  const status = result ? statusLabels[result.status] : 'Ready';
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
      <div className="output-content" tabIndex={0} aria-label="Console output">
        {!result && <p className="output-placeholder">Press Run to see console output.</p>}
        {result?.lines.map((line, index) => (
          <pre className="output-line" key={index}>
            {line || '\u00a0'}
          </pre>
        ))}
        {result?.error && (
          <pre className={`output-error ${result.status === 'stopped' ? 'output-stopped' : ''}`}>
            {result.error}
          </pre>
        )}
        {result?.status === 'complete' && result.lines.length === 0 && (
          <p className="output-placeholder">Finished without console output.</p>
        )}
      </div>
    </section>
  );
}

import type { ExecutionView } from './useExecution';

export default function OutputPanel({
  result,
  isRunning,
  onClear,
}: {
  result: ExecutionView | null;
  isRunning: boolean;
  onClear(): void;
}) {
  const status = !result
    ? 'Ready'
    : result.status === 'running'
      ? 'Running…'
      : result.status === 'complete'
        ? 'Finished'
        : result.status === 'stopped'
          ? 'Stopped'
          : 'Error';
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

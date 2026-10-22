/** Keeps future Web/Split controls visible but disabled while console execution is active. */
import { useId } from 'react';
import type { Environment } from '@code-editor/core';
import OutputPanel from './OutputPanel';
import type { ExecutionView } from './useExecution';

const resultViews = [
  { value: 'web', label: 'Web' },
  { value: 'console', label: 'Console' },
  { value: 'split', label: 'Split' },
] as const;

interface ResultsPaneProps {
  environment: Environment;
  result: ExecutionView | null;
  isRunning: boolean;
  /** Clears finished console output without changing drafts or the selected view. */
  onClear(): void;
}

/**
 * Renders Console with reserved Web/Split controls until preview development resumes.
 * @param props.environment Active execution environment, independent of the result view.
 * @param props.result Latest console output and execution state.
 * @param props.isRunning Whether execution is in progress.
 * @param props.onClear Clears console output without modifying the editor draft.
 */
export default function ResultsPane({ environment, result, isRunning, onClear }: ResultsPaneProps) {
  const groupId = useId();
  const view = 'console';

  return (
    <aside
      className="results-pane"
      aria-label={`${environment === 'node' ? 'Node.js' : 'Browser'} results`}
    >
      <header className="results-toolbar">
        <span className="section-label">RESULTS</span>
        <fieldset className="result-view-switch">
          <legend className="visually-hidden">Result view</legend>
          {resultViews.map((option) => (
            <label
              className="result-view-option"
              key={option.value}
              title={option.value !== 'console' ? 'Web preview is deferred' : 'Console output'}
            >
              <input
                className="visually-hidden"
                type="radio"
                name={groupId}
                value={option.value}
                checked={view === option.value}
                disabled={option.value !== 'console'}
                readOnly
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </header>
      <div className={`results-content results-${view}`}>
        <div className="console-slot">
          <OutputPanel result={result} isRunning={isRunning} onClear={onClear} />
        </div>
      </div>
    </aside>
  );
}

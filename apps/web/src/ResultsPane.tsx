/** Displays environment-aware Web, Console, and Split result views beside the editor. */
import { useId, useState } from 'react';
import type { Environment } from '@code-editor/core';
import OutputPanel from './OutputPanel';
import type { ExecutionView } from './useExecution';

type ResultView = 'web' | 'console' | 'split';
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
 * Renders result panels; Node always resolves to Console even after a browser view was selected.
 * @param props.environment Active execution environment; browser allows visual preview views.
 * @param props.result Latest console output and execution state.
 * @param props.isRunning Whether execution is in progress.
 * @param props.onClear Clears console output without modifying the editor draft.
 */
export default function ResultsPane({ environment, result, isRunning, onClear }: ResultsPaneProps) {
  const [preferredView, setPreferredView] = useState<ResultView>('console');
  const groupId = useId();
  const view = environment === 'node' ? 'console' : preferredView;

  return (
    <aside className="results-pane" aria-label="Results">
      <header className="results-toolbar">
        <span className="section-label">RESULTS</span>
        {environment === 'browser' ? (
          <fieldset className="result-view-switch">
            <legend className="visually-hidden">Result view</legend>
            {resultViews.map((option) => (
              <label className="result-view-option" key={option.value}>
                <input
                  className="visually-hidden"
                  type="radio"
                  name={groupId}
                  value={option.value}
                  checked={view === option.value}
                  onChange={() => setPreferredView(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <span className="environment-label">Node · Console</span>
        )}
      </header>
      <div className={`results-content results-${view}`}>
        {environment === 'browser' && (
          <section
            className="web-preview-panel"
            aria-label="Web preview"
            hidden={view === 'console'}
          >
            <header className="preview-toolbar">
              <span className="preview-dot" aria-hidden="true" />
              Web preview
            </header>
            <div className="preview-empty">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
                <rect x="5" y="9" width="38" height="30" rx="4" />
                <path d="M5 18h38M11 14h1m4 0h1m2 12-5 4 5 4m10-8 5 4-5 4" />
              </svg>
              <h2>A space for your web ideas</h2>
              <p>Web preview is coming next. Run your code in Console for now.</p>
              <span className="preview-note">
                JavaScript &amp; TypeScript · no framework setup yet
              </span>
            </div>
          </section>
        )}
        <div className="console-slot" hidden={view === 'web'}>
          <OutputPanel result={result} isRunning={isRunning} onClear={onClear} />
        </div>
      </div>
    </aside>
  );
}

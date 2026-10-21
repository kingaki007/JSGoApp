/** Displays environment-aware Web, Console, and Split result views beside the editor. */
import { useId, useState, type RefCallback } from 'react';
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
  previewRef?: RefCallback<HTMLIFrameElement>;
  /** Disposes the preview document and its remaining event handlers. */
  onResetPreview?(): void;
}

/**
 * Renders result panels; Node always resolves to Console even after a browser view was selected.
 * @param props.environment Active execution environment; browser allows visual preview views.
 * @param props.result Latest console output and execution state.
 * @param props.isRunning Whether execution is in progress.
 * @param props.onClear Clears console output without modifying the editor draft.
 * @param props.previewRef Connects the mounted iframe to the document runner.
 * @param props.onResetPreview Disposes the rendered document.
 */
export default function ResultsPane({
  environment,
  result,
  isRunning,
  onClear,
  previewRef,
  onResetPreview,
}: ResultsPaneProps) {
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
              <button type="button" className="preview-reset" onClick={onResetPreview}>
                Reset preview
              </button>
            </header>
            <p className="preview-hint">
              Select Web document, then Run. Use document.body to build your page.
            </p>
            <iframe
              ref={previewRef}
              className="preview-frame"
              title="Scratchpad web document"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
            />
          </section>
        )}
        <div className="console-slot" hidden={view === 'web'}>
          <OutputPanel result={result} isRunning={isRunning} onClear={onClear} />
        </div>
      </div>
    </aside>
  );
}

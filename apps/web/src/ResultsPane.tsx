/** Shows results as the console, the Browser page (Web view), or both, depending on the environment. */
import { useId } from 'react';
import type { Environment } from '@code-editor/core';
import OutputPanel, { type LineAlignment } from './OutputPanel';
import type { ExecutionView } from './useExecution';

export type ResultView = 'web' | 'console' | 'split';

const resultViews = [
  { value: 'web', label: 'Web', title: 'Page rendered by your code' },
  { value: 'console', label: 'Console', title: 'Console output' },
  { value: 'split', label: 'Split', title: 'Page and console together' },
] as const;

/**
 * Resolves the view that can actually be shown; only Browser code renders a page.
 * @param view View the user selected.
 * @param webAvailable Whether the Web view may be used: Browser environment and plan access.
 */
export function effectiveView(view: ResultView, webAvailable: boolean): ResultView {
  return webAvailable ? view : 'console';
}

interface ResultsPaneProps {
  environment: Environment;
  result: ExecutionView | null;
  isRunning: boolean;
  /** Clears finished console output without changing drafts or the selected view. */
  onClear(): void;
  /** Editor line geometry; present only while results are shown beside their source lines. */
  alignment?: LineAlignment;
  /** Selected view; Console applies whenever the Web view is unavailable. */
  view?: ResultView;
  /** @param view View chosen by the user. */
  onViewChange?(view: ResultView): void;
  /** Whether the Web view can be offered; the switch is hidden otherwise. */
  webAvailable?: boolean;
  /** Whether `console.table` data is drawn as a table. */
  showTables?: boolean;
  /** Whether errors show their source line and call stack. */
  locateErrors?: boolean;
  /** Whether console levels are styled; plans without the feature show every entry alike. */
  styleLevels?: boolean;
  /** @param element Container that displays the Browser page, or null when it is not shown. */
  onWebMount?(element: HTMLElement | null): void;
}

/**
 * Renders the selected result views. Node.js and plans without the Web view show Console only,
 * so no control is offered for a page that cannot be rendered.
 * @param props Environment, console output, alignment, selected view, and Web view wiring.
 */
export default function ResultsPane({
  environment,
  result,
  isRunning,
  onClear,
  alignment,
  view = 'console',
  onViewChange,
  webAvailable = false,
  styleLevels = false,
  locateErrors = false,
  showTables = false,
  onWebMount,
}: ResultsPaneProps) {
  const groupId = useId();
  const shown = effectiveView(view, webAvailable);

  return (
    <aside
      className="results-pane"
      aria-label={`${environment === 'node' ? 'Node.js' : 'Browser'} results`}
    >
      <header className="results-toolbar">
        <span className="section-label">RESULTS</span>
        {webAvailable && (
          <fieldset className="result-view-switch">
            <legend className="visually-hidden">Result view</legend>
            {resultViews.map((option) => (
              <label className="result-view-option" key={option.value} title={option.title}>
                <input
                  className="visually-hidden"
                  type="radio"
                  name={groupId}
                  value={option.value}
                  checked={shown === option.value}
                  onChange={() => onViewChange?.(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        )}
      </header>
      <div className={`results-content results-${shown}`}>
        {shown !== 'console' && (
          <section className="web-preview-panel" aria-label="Web view">
            <p className="web-view-empty">Run your code to render the page here.</p>
            <div className="web-view-mount" ref={onWebMount} />
          </section>
        )}
        {shown !== 'web' && (
          <div className="console-slot">
            <OutputPanel
              result={result}
              isRunning={isRunning}
              onClear={onClear}
              alignment={shown === 'console' ? alignment : undefined}
              styleLevels={styleLevels}
              locateErrors={locateErrors}
              showTables={showTables}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

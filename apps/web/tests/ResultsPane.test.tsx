/** Verifies which result views are offered and rendered for each environment and plan. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultsPane, { effectiveView, type ResultView } from '../src/ResultsPane';

/** @param view Selected view. @param webAvailable Whether the Web view may be used. */
function render(view: ResultView, webAvailable: boolean) {
  return renderToStaticMarkup(
    <ResultsPane
      environment={webAvailable ? 'browser' : 'node'}
      result={null}
      isRunning={false}
      onClear={() => {}}
      view={view}
      webAvailable={webAvailable}
    />,
  );
}

describe('result views', () => {
  it('offers enabled Web, Console, and Split controls when the Web view is available', () => {
    const markup = render('console', true);
    expect(markup).toContain('Result view');
    for (const value of ['web', 'console', 'split']) expect(markup).toContain(`value="${value}"`);
    expect(markup).not.toMatch(/type="radio"[^>]*disabled/);
    expect(markup).toContain('results-console');
    expect(markup).toContain('Execution output');
    expect(markup).not.toContain('web-view-mount');
  });

  it('shows only the page in Web and both tiles in Split', () => {
    const web = render('web', true);
    expect(web).toContain('results-web');
    expect(web).toContain('web-view-mount');
    expect(web).not.toContain('Execution output');
    const split = render('split', true);
    expect(split).toContain('results-split');
    expect(split).toContain('web-view-mount');
    expect(split).toContain('Execution output');
  });

  it('hides the switch and shows Console when no page can be rendered', () => {
    const markup = render('web', false);
    expect(markup).toContain('Node.js results');
    expect(markup).not.toContain('Result view');
    expect(markup).not.toContain('web-view-mount');
    expect(markup).toContain('results-console');
    expect(markup).toContain('Execution output');
  });

  it('falls back to Console only while the Web view is unavailable', () => {
    expect(effectiveView('split', false)).toBe('console');
    expect(effectiveView('split', true)).toBe('split');
  });
});

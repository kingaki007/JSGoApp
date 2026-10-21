/** Verifies that browser result controls are available and Node cannot expose Web preview views. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultsPane from '../src/ResultsPane';

describe('environment-specific result views', () => {
  it('offers Web, Console, and Split controls for the browser environment', () => {
    const markup = renderToStaticMarkup(
      <ResultsPane environment="browser" result={null} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).toContain('Result view');
    expect(markup).toContain('value="web"');
    expect(markup).toContain('value="console"');
    expect(markup).toContain('value="split"');
    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain('allow-same-origin');
  });

  it('keeps Node console-only with no Web pane or view selector', () => {
    const markup = renderToStaticMarkup(
      <ResultsPane environment="node" result={null} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).toContain('Node · Console');
    expect(markup).toContain('results-console');
    expect(markup).toContain('Execution output');
    expect(markup).not.toContain('Result view');
    expect(markup).not.toContain('Web preview');
  });
});

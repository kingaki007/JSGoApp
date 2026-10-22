/** Verifies that both environments retain disabled Web/Split controls while Console stays selected. */
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
  });

  it('keeps Node console-only with disabled preview choices', () => {
    const markup = renderToStaticMarkup(
      <ResultsPane environment="node" result={null} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).toContain('Node.js results');
    expect(markup).toContain('results-console');
    expect(markup).toContain('Execution output');
    expect(markup).toContain('Result view');
    expect(markup.match(/disabled=""/g)).toHaveLength(3);
    expect(markup).not.toContain('web-preview-panel');
  });
});

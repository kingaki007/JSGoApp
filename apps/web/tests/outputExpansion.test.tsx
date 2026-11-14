/** Verifies independent inline expansion of aligned output rows across runs. */
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import OutputPanel from '../src/OutputPanel';
import type { ExecutionView } from '../src/useExecution';

it('keeps other rows open when toggling an object and resets expansion for a new run', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const result: ExecutionView = {
    id: 'first-run',
    documentId: 'tab',
    language: 'javascript',
    status: 'complete',
    lines: ['first', 'second'],
    sourceLines: [1, 2],
    levels: ['log', 'log'],
    details: [1, 2].map((number) => [
      {
        type: 'object',
        text: 'Object',
        entries: [{ key: 'number', value: { type: 'number', text: String(number) } }],
      },
    ]),
  };
  /** @param value Run to render with stable source-line spacing. */
  const render = (value: ExecutionView) =>
    act(() =>
      root.render(
        <OutputPanel
          result={value}
          isRunning={false}
          onClear={() => {}}
          alignment={{ lineTop: (line) => (line - 1) * 24, lineHeight: 24, fontSize: 14 }}
        />,
      ),
    );
  /** @param label Accessible row-toggle label. */
  const click = (label: string) =>
    act(() => {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button).not.toBeNull();
      button!.click();
    });
  try {
    render(result);
    click('Expand result of line 1');
    click('Expand result of line 2');
    expect(container.querySelectorAll('.output-row-open')).toHaveLength(2);
    expect(container.querySelectorAll('.value-children')).toHaveLength(2);
    click('Collapse result of line 1');
    expect(container.querySelectorAll('.output-row-open')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Collapse result of line 2"]')).not.toBeNull();
    render({ ...result, id: 'second-run' });
    expect(container.querySelectorAll('.output-row-open')).toHaveLength(0);
    render({ ...result, id: 'spaced-run', sourceLines: [4, 8] });
    expect(
      [...container.querySelectorAll<HTMLElement>('.output-row')].map((row) => row.style.marginTop),
    ).toEqual(['32px', '32px']);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

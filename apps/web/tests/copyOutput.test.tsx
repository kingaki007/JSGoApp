/** Verifies the clipboard helper, the Copy button's confirmation state, and its wiring into output. */
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyButton, { copyText } from '../src/CopyButton';
import OutputPanel from '../src/OutputPanel';
import type { ExecutionView } from '../src/useExecution';

const result: ExecutionView = {
  id: 'run',
  documentId: 'tab',
  language: 'javascript',
  lines: ['plain line', ''],
  sourceLines: [1, 2],
  details: [null, null],
  levels: ['log', 'log'],
  status: 'complete',
};

const table = {
  type: 'table' as const,
  text: 'Table(1)',
  table: { columns: ['(index)', 'a'], rows: [['0', '1']] },
};

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes the exact text through the Clipboard API and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('exact text')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('exact text');
  });

  it('reports failure without throwing when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    expect(await copyText('x')).toBe(false);
  });
});

describe('CopyButton', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('copies the given text on click and briefly confirms, then reverts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    act(() => root.render(<CopyButton text="row text" label="this entry" />));
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Copy this entry');
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('row text');
    expect(button.getAttribute('aria-label')).toBe('Copied this entry');
    act(() => vi.advanceTimersByTime(1300));
    expect(button.getAttribute('aria-label')).toBe('Copy this entry');
  });

  it('leaves the label unconfirmed when the clipboard write fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    act(() => root.render(<CopyButton text="x" label="this entry" />));
    const button = container.querySelector('button')!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(button.getAttribute('aria-label')).toBe('Copy this entry');
  });
});

describe('copy buttons in the output pane', () => {
  it('adds a copy button to each list-view entry only when the feature is on', () => {
    const off = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} />,
    );
    expect(off).not.toContain('copy-button');
    const on = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} copyOutput />,
    );
    expect(on.match(/copy-button/g)).toHaveLength(1);
  });

  it('skips the copy button for an empty entry, so there is nothing to copy', () => {
    const on = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} copyOutput />,
    );
    // Only "plain line" (index 0) gets a button; the empty second entry does not.
    expect(on).toContain('plain line');
  });

  it('adds a copy button to an inspectable list-view entry', () => {
    const inspectable: ExecutionView = {
      ...result,
      details: [[table], null],
      levels: ['log', 'log'],
    };
    const on = renderToStaticMarkup(
      <OutputPanel
        result={inspectable}
        isRunning={false}
        onClear={() => {}}
        copyOutput
        showTables
      />,
    );
    expect(on).toContain('copy-button');
  });

  it('gives a collapsed aligned row a copy button that copies its raw text, not the preview', async () => {
    // Aligned rows position themselves from a measured layout, so this needs a real DOM render.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const alignment = { lineTop: () => 0, lineHeight: 24, fontSize: 14 };
    await act(async () => {
      root.render(
        <OutputPanel
          result={{ ...result, lines: ['plain line', 'second'], sourceLines: [1, 1] }}
          isRunning={false}
          onClear={() => {}}
          alignment={alignment}
          copyOutput
        />,
      );
    });
    const button = container.querySelector('.copy-button')!;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Copy result of line 1');
    act(() => root.unmount());
    container.remove();
  });

  it('gives an unplaced footer entry a copy button when the feature is on', () => {
    const alignment = { lineTop: () => 0, lineHeight: 24, fontSize: 14 };
    const on = renderToStaticMarkup(
      <OutputPanel
        result={{ ...result, lines: ['stray'], sourceLines: [0] }}
        isRunning={false}
        onClear={() => {}}
        alignment={alignment}
        copyOutput
      />,
    );
    expect(on).toContain('output-aligned-footer');
    expect(on).toContain('copy-button');
  });
});

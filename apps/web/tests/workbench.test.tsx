/** Verifies preferences, line grouping for aligned results, line translation, and expandable values. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OutputPanel, { alignOutput } from '../src/OutputPanel';
import ValueTree from '../src/ValueTree';
import {
  defaultSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  settingsStorageKey,
} from '../src/settings';
import { toDraftLine, type ExecutionView } from '../src/useExecution';

afterEach(() => vi.unstubAllGlobals());

describe('workspace preferences', () => {
  it('keeps valid stored values and replaces damaged ones with defaults', () => {
    expect(
      parseSettings({ autoRun: false, matchLines: 'yes', fontSize: 18.4, wordWrap: true }),
    ).toEqual({ ...defaultSettings, autoRun: false, fontSize: 18, wordWrap: true });
    expect(parseSettings(null)).toEqual(defaultSettings);
  });

  it('limits font size to the supported range', () => {
    expect(parseSettings({ fontSize: 2 }).fontSize).toBe(10);
    expect(parseSettings({ fontSize: 400 }).fontSize).toBe(28);
    expect(parseSettings({ fontSize: Number.NaN }).fontSize).toBe(defaultSettings.fontSize);
  });

  it('round-trips through storage and survives blocked or malformed storage', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    });
    saveSettings({ ...defaultSettings, showUndefined: true });
    expect(loadSettings().showUndefined).toBe(true);
    values.set(settingsStorageKey, '{broken');
    expect(loadSettings()).toEqual(defaultSettings);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadSettings()).toEqual(defaultSettings);
    expect(() => saveSettings(defaultSettings)).not.toThrow();
  });
});

describe('line-aligned results', () => {
  it('groups output by source line, in line order, and keeps unknown origins separate', () => {
    expect(alignOutput(['b', 'a1', 'limit', 'a2', 'multi\n  line'], [3, 1, 0, 1, 2])).toEqual({
      rows: [
        { line: 1, text: 'a1  a2', level: 'log' },
        { line: 2, text: 'multi line', level: 'log' },
        { line: 3, text: 'b', level: 'log' },
      ],
      unplaced: ['limit'],
    });
  });

  it('translates executed lines through a compiler line map and passes JavaScript lines through', () => {
    expect(toDraftLine(2)).toBe(2);
    expect(toDraftLine(2, [1, 5, 6])).toBe(5);
    expect(toDraftLine(9, [1, 5, 6])).toBe(0);
    expect(toDraftLine(0, [1])).toBe(0);
    expect(toDraftLine(undefined)).toBe(0);
  });

  it('renders the plain list without alignment and an aligned region with it', () => {
    const result: ExecutionView = {
      id: 'run',
      documentId: 'tab',
      language: 'javascript',
      lines: ['4'],
      sourceLines: [1],
      details: [null],
      levels: ['log'],
      status: 'complete',
    };
    const list = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} />,
    );
    expect(list).toContain('output-line');
    expect(list).not.toContain('output-aligned');
    const aligned = renderToStaticMarkup(
      <OutputPanel
        result={{
          ...result,
          lines: ['4', 'late'],
          sourceLines: [1, 0],
          details: [null, null],
          levels: ['log', 'log'],
          error: 'Boom',
        }}
        isRunning={false}
        onClear={() => {}}
        alignment={{ lineTop: () => 0, lineHeight: 24, fontSize: 14 }}
      />,
    );
    expect(aligned).toContain('output-aligned');
    // Unplaced output and errors stay readable even before row positions are measured.
    expect(aligned).toContain('late');
    expect(aligned).toContain('Boom');
  });

  it('gives a row values only when one of its entries is inspectable', () => {
    const object = { type: 'object' as const, text: 'Object', entries: [] };
    const output = alignOutput(['label', '{}', 'plain'], [2, 2, 5], [null, [object], null]);
    expect(output.rows).toEqual([
      {
        line: 2,
        text: 'label {}',
        level: 'log',
        values: [{ type: 'string', text: 'label' }, object],
      },
      { line: 5, text: 'plain', level: 'log' },
    ]);
  });
});

describe('console levels', () => {
  const result: ExecutionView = {
    id: 'run',
    documentId: 'tab',
    language: 'javascript',
    lines: ['plain', 'careful', 'broken', 'note', 'detail'],
    sourceLines: [1, 2, 2, 3, 4],
    details: [null, null, null, null, null],
    levels: ['log', 'warn', 'error', 'info', 'debug'],
    status: 'complete',
  };

  it('gives a shared row the most severe level of its entries', () => {
    expect(
      alignOutput(result.lines, result.sourceLines, result.details, result.levels).rows.map(
        (row) => [row.line, row.level],
      ),
    ).toEqual([
      [1, 'log'],
      [2, 'error'],
      [3, 'info'],
      [4, 'debug'],
    ]);
  });

  it('styles and announces levels in the list view when the feature is on', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} styleLevels />,
    );
    expect(markup).toContain('<pre class="output-line">');
    for (const level of ['warn', 'error', 'info', 'debug'])
      expect(markup).toContain(`output-line output-level-${level}`);
    expect(markup).toContain('<span class="visually-hidden">Warning: </span>careful');
    expect(markup).toContain('<span class="visually-hidden">Error: </span>broken');
  });

  it('shows every entry alike when the feature is off', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).not.toContain('output-level-');
    expect(markup).not.toContain('Warning: ');
    expect(markup).toContain('careful');
  });
});

describe('console tables', () => {
  const table = {
    type: 'table' as const,
    text: 'Table(2)',
    table: {
      columns: ['(index)', 'name'],
      rows: [
        ['0', '<b>Ada</b>'],
        ['1', 'Linus'],
      ],
      omitted: 4,
    },
  };
  const result: ExecutionView = {
    id: 'run',
    documentId: 'tab',
    language: 'javascript',
    lines: ['(index) | name'],
    sourceLines: [1],
    details: [[table]],
    levels: ['log'],
    status: 'complete',
  };

  it('draws a table with header and row-index cells, and escapes cell text', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} showTables />,
    );
    expect(markup).toContain('<table class="output-table">');
    expect(markup).toContain('<th scope="col">name</th>');
    expect(markup).toContain('<th scope="row">0</th>');
    expect(markup).toContain('<td>&lt;b&gt;Ada&lt;/b&gt;</td>');
    expect(markup).toContain('4 more rows not shown');
  });

  it('falls back to the text form when the feature is off', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).not.toContain('<table');
    expect(markup).toContain('<pre class="output-line">(index) | name</pre>');
  });

  it('labels an aligned row as a table that can be opened', () => {
    expect(
      alignOutput(result.lines, result.sourceLines, result.details, result.levels).rows,
    ).toEqual([{ line: 1, text: 'Table(2)', level: 'log', values: [table] }]);
  });
});

describe('located errors', () => {
  const failed: ExecutionView = {
    id: 'run',
    documentId: 'tab',
    language: 'javascript',
    lines: ['start'],
    sourceLines: [4],
    details: [null],
    levels: ['log'],
    error: 'Unexpected token o',
    errorLine: 2,
    errorFrames: [
      { name: 'parse', line: 2 },
      { name: '', line: 5 },
    ],
    status: 'error',
  };

  it('shows the line and a call stack in the list view when the feature is on', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={failed} isRunning={false} onClear={() => {}} locateErrors />,
    );
    expect(markup).toContain('<span class="output-error-line">Line 2</span>Unexpected token o');
    expect(markup).toContain('Call stack (2 frames)');
    expect(markup).toContain('parse <span>line 2</span>');
    expect(markup).toContain('(top level) <span>line 5</span>');
  });

  it('shows only the message when the feature is off', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel result={failed} isRunning={false} onClear={() => {}} />,
    );
    expect(markup).toContain('Unexpected token o');
    expect(markup).not.toContain('output-error-line');
    expect(markup).not.toContain('Call stack');
  });

  it('omits the stack when it would only repeat the error line', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel
        result={{ ...failed, errorFrames: [{ name: '', line: 2 }] }}
        isRunning={false}
        onClear={() => {}}
        locateErrors
      />,
    );
    expect(markup).toContain('Line 2');
    expect(markup).not.toContain('Call stack');
  });

  it('keeps the message at the bottom of the aligned view when the line is unknown', () => {
    const alignment = { lineTop: () => 0, lineHeight: 24, fontSize: 14 };
    const unknown = renderToStaticMarkup(
      <OutputPanel
        result={{ ...failed, errorLine: undefined, errorFrames: [] }}
        isRunning={false}
        onClear={() => {}}
        alignment={alignment}
        locateErrors
      />,
    );
    expect(unknown).toContain('output-aligned-footer');
    expect(unknown).toContain('Unexpected token o');
    // With a known line the message moves beside that line; only the stack stays below.
    const located = renderToStaticMarkup(
      <OutputPanel
        result={failed}
        isRunning={false}
        onClear={() => {}}
        alignment={alignment}
        locateErrors
      />,
    );
    expect(located).toContain('Call stack (2 frames)');
    expect(located).not.toContain('output-error-line');
  });
});

describe('expandable values', () => {
  const value = {
    type: 'object' as const,
    text: 'Object',
    entries: [
      { key: 'name', value: { type: 'string' as const, text: '<b>Ada</b>' } },
      { key: 'tags', value: { type: 'array' as const, text: 'Array(2)', omitted: 2 } },
    ],
    omitted: 3,
  };

  it('shows a one-line preview while collapsed and escapes logged markup', () => {
    const markup = renderToStaticMarkup(<ValueTree value={value} />);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('{name: &quot;&lt;b&gt;Ada&lt;/b&gt;&quot;, tags: Array(2) …, …}');
    expect(markup).not.toContain('value-children');
  });

  it('lists entries, nested limits, and omitted counts when open', () => {
    const markup = renderToStaticMarkup(<ValueTree value={value} defaultOpen />);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('value-children');
    expect(markup).toContain('name: ');
    expect(markup).toContain('value-string');
    expect(markup).toContain('Array(2) …');
    expect(markup).toContain('3 more not shown');
  });

  it('renders trees for inspectable entries in the list view and text for the rest', () => {
    const markup = renderToStaticMarkup(
      <OutputPanel
        result={{
          id: 'run',
          documentId: 'tab',
          language: 'javascript',
          lines: ['plain', '{"name":"<b>Ada</b>"}'],
          sourceLines: [1, 2],
          details: [null, [value]],
          levels: ['log', 'log'],
          status: 'complete',
        }}
        isRunning={false}
        onClear={() => {}}
      />,
    );
    expect(markup).toContain('<pre class="output-line">plain</pre>');
    expect(markup).toContain('output-values');
    expect(markup).toContain('value-toggle');
  });
});

/** Verifies preference validation, line grouping for aligned results, and compiled-line translation. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OutputPanel, { alignOutput } from '../src/OutputPanel';
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
        { line: 1, text: 'a1  a2' },
        { line: 2, text: 'multi line' },
        { line: 3, text: 'b' },
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
      status: 'complete',
    };
    const list = renderToStaticMarkup(
      <OutputPanel result={result} isRunning={false} onClear={() => {}} />,
    );
    expect(list).toContain('output-line');
    expect(list).not.toContain('output-aligned');
    const aligned = renderToStaticMarkup(
      <OutputPanel
        result={{ ...result, lines: ['4', 'late'], sourceLines: [1, 0], error: 'Boom' }}
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
});

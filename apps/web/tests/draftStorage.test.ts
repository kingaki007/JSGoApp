/** Verifies tab restoration, version 1 migration, schema validation, and recoverable storage failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorageKey, loadDrafts, saveDrafts, type DraftSnapshot } from '../src/draftStorage';
import { nextTabName, tabTitle } from '../src/useDrafts';

const snapshot: DraftSnapshot = {
  version: 2,
  activeId: 'notes',
  tabs: [
    { id: 'javascript', name: 'scratch.js', language: 'javascript', code: 'console.log("JS");' },
    { id: 'notes', name: 'notes.ts', language: 'typescript', code: 'const count: number = 42;' },
  ],
};
let values: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
  values = new Map();
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('local draft recovery', () => {
  it('restores every tab and the active scratchpad', () => {
    expect(saveDrafts(snapshot)).toBeNull();
    expect(loadDrafts()).toEqual({ snapshot, error: null });
  });

  it('preserves intentionally empty code rather than restoring example code', () => {
    const empty = { ...snapshot, tabs: snapshot.tabs.map((tab) => ({ ...tab, code: '' })) };
    saveDrafts(empty);
    expect(loadDrafts().snapshot).toEqual(empty);
  });

  it('treats a new browser profile as having no saved draft', () => {
    expect(loadDrafts()).toEqual({ snapshot: null, error: null });
  });

  it('migrates the original per-language drafts into two tabs without rewriting storage', () => {
    values.set(
      draftStorageKey,
      JSON.stringify({
        version: 1,
        language: 'javascript',
        drafts: { javascript: 'saved JS', typescript: 'saved TS' },
      }),
    );
    expect(loadDrafts()).toEqual({
      error: null,
      snapshot: {
        version: 2,
        activeId: 'javascript',
        tabs: [
          { id: 'javascript', name: 'scratch.js', language: 'javascript', code: 'saved JS' },
          { id: 'typescript', name: 'scratch.ts', language: 'typescript', code: 'saved TS' },
        ],
      },
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('reports malformed JSON without overwriting the stored entry', () => {
    values.set(draftStorageKey, '{broken');
    expect(loadDrafts().snapshot).toBeNull();
    expect(loadDrafts().error).toBeTruthy();
    expect(values.get(draftStorageKey)).toBe('{broken');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    { ...snapshot, version: 3 },
    { ...snapshot, activeId: 'missing' },
    { ...snapshot, tabs: [] },
    { ...snapshot, tabs: [snapshot.tabs[0], snapshot.tabs[0]] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[1], language: 'python' }] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[1], id: '../escape' }] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[1], code: 42 }] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[1], autoTitled: 'yes' }] },
    { version: 1, language: 'javascript', drafts: { javascript: 42 } },
  ])('rejects unsupported or incomplete snapshot shapes', (invalid) => {
    values.set(draftStorageKey, JSON.stringify(invalid));
    expect(loadDrafts().snapshot).toBeNull();
    expect(loadDrafts().error).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('returns a recoverable error when storage access is blocked', () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    expect(loadDrafts().snapshot).toBeNull();
    expect(loadDrafts().error).toBeTruthy();
  });

  it('reports a failed write while preserving the previous saved draft', () => {
    saveDrafts(snapshot);
    storage.setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(saveDrafts({ ...snapshot, activeId: 'javascript' })).toContain('Could not save');
    expect(loadDrafts().snapshot).toEqual(snapshot);
  });

  it('names new tabs with the first unused untitled number', () => {
    expect(nextTabName(snapshot.tabs, 'typescript')).toBe('untitled-1.ts');
    expect(nextTabName([{ ...snapshot.tabs[0], name: 'untitled-1.js' }], 'javascript')).toBe(
      'untitled-2.js',
    );
  });

  it('round-trips the autoTitled flag', () => {
    const tagged: DraftSnapshot = {
      ...snapshot,
      tabs: [snapshot.tabs[0], { ...snapshot.tabs[1], autoTitled: true }],
    };
    saveDrafts(tagged);
    expect(loadDrafts().snapshot).toEqual(tagged);
  });
});

describe('tab title derivation', () => {
  const base = { id: 'a', name: 'untitled-1.ts', language: 'typescript' as const, code: '' };

  it('shows the name when the tab was never auto-titled, regardless of its code', () => {
    expect(tabTitle({ ...base, code: 'const x = 1;' })).toBe('untitled-1.ts');
    expect(tabTitle({ ...base, autoTitled: false, code: 'const x = 1;' })).toBe('untitled-1.ts');
  });

  it('shows the first non-blank code line while auto-titled', () => {
    expect(
      tabTitle({
        ...base,
        autoTitled: true,
        code: '\n  \nconst total = 1 + 2;\nconsole.log(total);',
      }),
    ).toBe('const total = 1 + 2;');
  });

  it('falls back to the name when auto-titled code is empty or only whitespace', () => {
    expect(tabTitle({ ...base, autoTitled: true, code: '' })).toBe('untitled-1.ts');
    expect(tabTitle({ ...base, autoTitled: true, code: '   \n\t\n' })).toBe('untitled-1.ts');
  });

  it('truncates a long first line with an ellipsis', () => {
    const line = 'x'.repeat(50);
    const title = tabTitle({ ...base, autoTitled: true, code: line });
    expect(title.length).toBe(40);
    expect(title.endsWith('…')).toBe(true);
    expect(title.startsWith('x'.repeat(39))).toBe(true);
  });
});

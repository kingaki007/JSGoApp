/** Verifies tab restoration, version 1 migration, schema validation, and recoverable storage failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorageKey, loadDrafts, saveDrafts, type DraftSnapshot } from '../src/draftStorage';
import { nextTabName } from '../src/useDrafts';

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
});

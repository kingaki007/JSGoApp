/** Verifies draft restoration, empty code, schema validation, and recoverable storage failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorageKey, loadDrafts, saveDrafts, type DraftSnapshot } from '../src/draftStorage';

const snapshot: DraftSnapshot = {
  version: 1,
  language: 'javascript',
  drafts: { javascript: 'console.log("saved JS");', typescript: 'const count: number = 42;' },
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
  it('restores both languages and the selected scratchpad', () => {
    expect(saveDrafts(snapshot)).toBeNull();
    expect(loadDrafts()).toEqual({ snapshot, error: null });
  });

  it('preserves intentionally empty code rather than restoring example code', () => {
    const empty = { ...snapshot, drafts: { javascript: '', typescript: '' } };
    saveDrafts(empty);
    expect(loadDrafts().snapshot).toEqual(empty);
  });

  it('treats a new browser profile as having no saved draft', () => {
    expect(loadDrafts()).toEqual({ snapshot: null, error: null });
  });

  it('reports malformed JSON without overwriting the stored entry', () => {
    values.set(draftStorageKey, '{broken');
    expect(loadDrafts().snapshot).toBeNull();
    expect(loadDrafts().error).toBeTruthy();
    expect(values.get(draftStorageKey)).toBe('{broken');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    { ...snapshot, version: 2 },
    { ...snapshot, language: 'python' },
    { ...snapshot, drafts: { javascript: 42 } },
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
    expect(
      saveDrafts({ ...snapshot, drafts: { javascript: 'new unsaved code', typescript: '' } }),
    ).toContain('Could not save');
    expect(loadDrafts().snapshot).toEqual(snapshot);
  });
});

/** Validates, loads, and saves versioned scratchpad snapshots in browser-local storage. */
import type { Language } from '@code-editor/core';

export const draftStorageKey = 'jsgoapp.drafts';

export interface DraftSnapshot {
  version: 1;
  language: Language;
  drafts: Record<Language, string>;
}

/**
 * Validates persisted data before the app uses it as editor state.
 * @param value Untrusted parsed JSON from local storage.
 */
function isSnapshot(value: unknown): value is DraftSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<DraftSnapshot>;
  return (
    snapshot.version === 1 &&
    (snapshot.language === 'javascript' || snapshot.language === 'typescript') &&
    !!snapshot.drafts &&
    typeof snapshot.drafts === 'object' &&
    typeof snapshot.drafts.javascript === 'string' &&
    typeof snapshot.drafts.typescript === 'string'
  );
}

/** Loads both drafts and language; returns a recovery message rather than throwing on storage failure. */
export function loadDrafts(): { snapshot: DraftSnapshot | null; error: string | null } {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (raw === null) return { snapshot: null, error: null };
    const value: unknown = JSON.parse(raw);
    if (!isSnapshot(value)) throw new Error('Invalid draft snapshot');
    return { snapshot: value, error: null };
  } catch {
    return {
      snapshot: null,
      error: 'Could not restore saved drafts. Editing starts a new local draft.',
    };
  }
}

/**
 * Saves one complete snapshot atomically to a single storage entry.
 * @param snapshot Valid current drafts and selected language.
 * @returns Null on success, otherwise a user-facing message explaining that code is still unsaved.
 */
export function saveDrafts(snapshot: DraftSnapshot): string | null {
  try {
    localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    return null;
  } catch {
    return 'Could not save on this device. Keep this tab open or copy your code.';
  }
}

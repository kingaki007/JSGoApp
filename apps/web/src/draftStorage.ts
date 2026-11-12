/** Validates, loads, migrates, and saves versioned scratchpad tabs in browser-local storage. */
import { languages, type Language } from '@code-editor/core';

export const draftStorageKey = 'jsgoapp.drafts';
export const maxTabs = 30;
export const maxTabNameLength = 40;

export interface ScratchTab {
  /** Stable identifier, also used in the editor model path. */
  id: string;
  /** Display name chosen by the user. */
  name: string;
  language: Language;
  code: string;
}

export interface DraftSnapshot {
  version: 2;
  activeId: string;
  tabs: ScratchTab[];
}

/** @param value Untrusted value. @returns Whether it names a supported language. */
function isLanguage(value: unknown): value is Language {
  return value === 'javascript' || value === 'typescript';
}

/**
 * Validates persisted data before the app uses it as editor state.
 * @param value Untrusted parsed JSON from local storage.
 */
function isSnapshot(value: unknown): value is DraftSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<DraftSnapshot>;
  if (snapshot.version !== 2 || !Array.isArray(snapshot.tabs)) return false;
  const tabs: unknown[] = snapshot.tabs;
  const ids = new Set<string>();
  for (const item of tabs) {
    const tab = item as Partial<ScratchTab> | null;
    if (
      !tab ||
      typeof tab !== 'object' ||
      typeof tab.id !== 'string' ||
      !/^[\w-]{1,64}$/.test(tab.id) ||
      ids.has(tab.id) ||
      typeof tab.name !== 'string' ||
      !tab.name ||
      tab.name.length > maxTabNameLength ||
      !isLanguage(tab.language) ||
      typeof tab.code !== 'string'
    )
      return false;
    ids.add(tab.id);
  }
  return (
    tabs.length > 0 &&
    tabs.length <= maxTabs &&
    typeof snapshot.activeId === 'string' &&
    ids.has(snapshot.activeId)
  );
}

/**
 * Converts the original one-draft-per-language format into two tabs without losing code.
 * @param value Untrusted parsed JSON that may be a version 1 snapshot.
 * @returns Equivalent tab snapshot, or null when the value is not a valid version 1 snapshot.
 */
function migrate(value: unknown): DraftSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const old = value as { version?: unknown; language?: unknown; drafts?: Record<string, unknown> };
  if (
    old.version !== 1 ||
    !isLanguage(old.language) ||
    !old.drafts ||
    typeof old.drafts !== 'object' ||
    typeof old.drafts.javascript !== 'string' ||
    typeof old.drafts.typescript !== 'string'
  )
    return null;
  return {
    version: 2,
    activeId: old.language,
    tabs: (['javascript', 'typescript'] as const).map((language) => ({
      id: language,
      name: `scratch.${languages[language].extension}`,
      language,
      code: old.drafts![language] as string,
    })),
  };
}

/** Loads all tabs and the active one; returns a recovery message rather than throwing on storage failure. */
export function loadDrafts(): { snapshot: DraftSnapshot | null; error: string | null } {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (raw === null) return { snapshot: null, error: null };
    const value: unknown = JSON.parse(raw);
    const snapshot = isSnapshot(value) ? value : migrate(value);
    if (!snapshot) throw new Error('Invalid draft snapshot');
    return { snapshot, error: null };
  } catch {
    return {
      snapshot: null,
      error: 'Could not restore saved drafts. Editing starts a new local draft.',
    };
  }
}

/**
 * Saves one complete snapshot atomically to a single storage entry.
 * @param snapshot Valid current tabs and active tab.
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

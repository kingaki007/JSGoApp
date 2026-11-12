/** Validates, stores, and exposes workspace preferences shared by the web and desktop UI. */
import { useCallback, useState } from 'react';

export const settingsStorageKey = 'jsgoapp.settings';
export const fontSizeRange = { min: 10, max: 28 } as const;

export interface WorkspaceSettings {
  /** Runs the draft after a pause in typing. */
  autoRun: boolean;
  /** Shows each result beside the source line that produced it. */
  matchLines: boolean;
  /** Reports expression statements that evaluate to undefined. */
  showUndefined: boolean;
  /** Editor and aligned-result font size in pixels. */
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
}

export const defaultSettings: WorkspaceSettings = {
  autoRun: true,
  matchLines: true,
  showUndefined: false,
  fontSize: 14,
  wordWrap: false,
  lineNumbers: true,
};

/**
 * Merges stored preferences over defaults so unknown or damaged fields never reach the UI.
 * @param value Untrusted parsed JSON from local storage.
 */
export function parseSettings(value: unknown): WorkspaceSettings {
  const settings = { ...defaultSettings };
  if (!value || typeof value !== 'object') return settings;
  const stored = value as Record<string, unknown>;
  for (const key of ['autoRun', 'matchLines', 'showUndefined', 'wordWrap', 'lineNumbers'] as const)
    if (typeof stored[key] === 'boolean') settings[key] = stored[key];
  const size = stored.fontSize;
  if (typeof size === 'number' && Number.isFinite(size))
    settings.fontSize = Math.min(fontSizeRange.max, Math.max(fontSizeRange.min, Math.round(size)));
  return settings;
}

/** Loads saved preferences; blocked or malformed storage yields the defaults. */
export function loadSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    return raw === null ? { ...defaultSettings } : parseSettings(JSON.parse(raw));
  } catch {
    return { ...defaultSettings };
  }
}

/** @param settings Complete preferences to store; failures keep the in-memory values. */
export function saveSettings(settings: WorkspaceSettings): void {
  try {
    localStorage.setItem(settingsStorageKey, JSON.stringify({ version: 1, ...settings }));
  } catch {
    // Preferences are a convenience; the session continues with its in-memory values.
  }
}

/**
 * Holds preferences for the session and persists them when the account may keep preferences.
 * @param persist Whether stored preferences are restored and updated; defaults apply otherwise.
 */
export function useSettings(persist: boolean) {
  const [settings, setSettings] = useState(() =>
    persist ? loadSettings() : { ...defaultSettings },
  );
  /** @param patch Changed preferences; other values are kept. */
  const update = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      setSettings((current) => {
        const next = parseSettings({ ...current, ...patch });
        if (persist) saveSettings(next);
        return next;
      });
    },
    [persist],
  );
  return { settings, update };
}

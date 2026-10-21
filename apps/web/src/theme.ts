/** Persists the host's theme preference and resolves System to a light or dark editor theme. */
import { useLayoutEffect, useState } from 'react';
import type { EditorTheme } from '@code-editor/editor';

export type ThemePreference = 'system' | EditorTheme;
const storageKey = 'jsgoapp.theme';

/** Reads a valid stored preference, falling back to System when storage is unavailable or invalid. */
function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // The editor still works if the browser blocks local storage.
  }
  return 'system';
}

/** Synchronizes the resolved document theme with the saved preference and operating-system changes. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<EditorTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const resolved = preference === 'system' ? systemTheme : preference;

  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem(storageKey, preference);
    } catch {
      // Persisting the theme is optional, unlike changing it for this session.
    }
  }, [preference, resolved]);

  return { preference, setPreference, resolved };
}

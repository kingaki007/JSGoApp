/** Persists the selected editor theme and recolors the whole app chrome to match it. */
import { useLayoutEffect, useState } from 'react';
import { themeCatalog, defaultThemeId, type NamedTheme } from '@code-editor/editor';

const storageKey = 'jsgoapp.theme';

/** Reads a valid stored theme id, falling back to the default when storage is unavailable or invalid. */
function readThemeId(): string {
  try {
    const value = localStorage.getItem(storageKey);
    if (value && themeCatalog.some((theme) => theme.id === value)) return value;
  } catch {
    // The editor still works if the browser blocks local storage.
  }
  return defaultThemeId;
}

/** Looks up a catalog entry by id, falling back to the first theme for an unknown id. */
function findTheme(themeId: string): NamedTheme {
  return themeCatalog.find((theme) => theme.id === themeId) ?? themeCatalog[0];
}

/** @param token Monaco token name. @returns Its color as a CSS hex string, or a visible fallback. */
function ruleColor(theme: NamedTheme, token: string): string {
  const foreground = theme.rules.find((rule) => rule.token === token)?.foreground;
  return foreground ? `#${foreground}` : (theme.colors['editor.foreground'] ?? '#888888');
}

/**
 * Applies the chosen theme's colors directly to the document, so every shell surface derived
 * from them in `themes.css` follows this specific theme instead of a shared dark/light palette.
 * @param theme Theme whose colors drive the CSS custom properties.
 */
function applyShellColors(theme: NamedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme.appChrome;
  const set = (name: string, value: string | undefined) => {
    if (value) root.style.setProperty(name, value);
  };
  set('--color-background', theme.colors['editor.background']);
  set('--color-text', theme.colors['editor.foreground']);
  set('--editor-background', theme.colors['editor.background']);
  set('--editor-foreground', theme.colors['editor.foreground']);
  set('--editor-line-number', theme.colors['editorLineNumber.foreground']);
  set('--editor-line-number-active', theme.colors['editorLineNumber.activeForeground']);
  set('--editor-selection', theme.colors['editor.selectionBackground']);
  set('--syntax-comment', ruleColor(theme, 'comment'));
  set('--syntax-keyword', ruleColor(theme, 'keyword'));
  set('--syntax-string', ruleColor(theme, 'string'));
  set('--syntax-number', ruleColor(theme, 'number'));
  set('--syntax-type', ruleColor(theme, 'type'));
}

/** Synchronizes the selected editor theme with storage and the document's shell colors. */
export function useTheme() {
  const [themeId, setThemeId] = useState<string>(readThemeId);
  const theme = findTheme(themeId);

  useLayoutEffect(() => {
    applyShellColors(theme);
    try {
      localStorage.setItem(storageKey, themeId);
    } catch {
      // Persisting the theme is optional, unlike changing it for this session.
    }
  }, [themeId, theme]);

  return { themeId, setThemeId, theme };
}

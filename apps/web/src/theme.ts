import { useLayoutEffect, useState } from 'react';
import type { Monaco } from '@monaco-editor/react';

export type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;
const storageKey = 'jsgoapp.theme';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // The editor still works if the browser blocks local storage.
  }
  return 'system';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
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

// CSS semantic tokens are the source of truth for both the shell and Monaco.
export function applyEditorTheme(monaco: Monaco, theme: ResolvedTheme) {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  monaco.editor.defineTheme('jsgoapp', {
    base: theme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: token('--syntax-comment').slice(1) },
      { token: 'keyword', foreground: token('--syntax-keyword').slice(1) },
      { token: 'string', foreground: token('--syntax-string').slice(1) },
      { token: 'number', foreground: token('--syntax-number').slice(1) },
      { token: 'type', foreground: token('--syntax-type').slice(1) },
    ],
    colors: {
      'editor.background': token('--editor-background'),
      'editor.foreground': token('--editor-foreground'),
      'editorLineNumber.foreground': token('--editor-line-number'),
      'editorLineNumber.activeForeground': token('--editor-line-number-active'),
      'editor.lineHighlightBackground': token('--editor-line-highlight'),
      'editor.selectionBackground': token('--editor-selection'),
      'editor.inactiveSelectionBackground': token('--editor-selection-inactive'),
      'editorCursor.foreground': token('--color-focus'),
      'editorError.foreground': token('--editor-error'),
      'editorWarning.foreground': token('--editor-warning'),
      focusBorder: token('--color-focus'),
    },
  });
  monaco.editor.setTheme('jsgoapp');
}

export function readEditorTypography() {
  const styles = getComputedStyle(document.documentElement);
  // Font-size primitives use rem; resolve them against the actual root size.
  const fontSize =
    parseFloat(styles.fontSize) * parseFloat(styles.getPropertyValue('--font-size-body'));
  return {
    fontFamily: styles.getPropertyValue('--font-family-code').trim(),
    fontSize,
    lineHeight: Math.round(fontSize * parseFloat(styles.getPropertyValue('--line-height-code'))),
  };
}

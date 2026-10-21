/** Maps host CSS tokens to Monaco colors and resolves editor font settings from shared typography. */
import type { Monaco } from '@monaco-editor/react';

export type EditorTheme = 'light' | 'dark';

/**
 * Activates the document-wide editor theme from the host's semantic CSS tokens.
 * @param monaco Monaco API whose theme registry will be updated.
 * @param theme Resolved light/dark appearance used for inherited widget colors.
 */
export function applyEditorTheme(monaco: Monaco, theme: EditorTheme) {
  const styles = getComputedStyle(document.documentElement);
  /** @param name Semantic custom-property name to read from the host document. */
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

/** Resolves the host's rem-based font-size and line-height tokens into Monaco pixel settings. */
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

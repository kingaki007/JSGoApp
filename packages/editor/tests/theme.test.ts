/** Verifies production-minified CSS colors remain valid in Monaco's strict theme color map. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import { applyEditorTheme } from '../src/theme';

afterEach(() => vi.unstubAllGlobals());

describe('editor theme colors', () => {
  it('expands shorthand colors from production CSS before defining a light theme', () => {
    const colors: Record<string, string> = {
      '--editor-background': ' #fff ',
      '--editor-line-highlight': '#abcd',
      '--syntax-comment': '#abc',
      '--syntax-keyword': '#ABC',
    };
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => colors[name] ?? '#123456',
    }));
    const defineTheme = vi.fn();
    const setTheme = vi.fn();
    const monaco = { editor: { defineTheme, setTheme } } as unknown as Monaco;
    applyEditorTheme(monaco, 'light');
    const theme = defineTheme.mock.calls[0][1];
    expect(theme.base).toBe('vs');
    expect(theme.colors['editor.background']).toBe('#ffffff');
    expect(theme.colors['editor.lineHighlightBackground']).toBe('#aabbccdd');
    expect(theme.colors['editor.foreground']).toBe('#123456');
    expect(theme.rules[0].foreground).toBe('aabbcc');
    expect(theme.rules[1].foreground).toBe('AABBCC');
    expect(setTheme).toHaveBeenCalledWith('jsgoapp');
    applyEditorTheme(monaco, 'dark');
    expect(defineTheme.mock.calls[1][1].base).toBe('vs-dark');
  });
});

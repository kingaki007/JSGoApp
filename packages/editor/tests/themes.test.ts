/** Verifies the named theme catalog's shape and that applying one defines and sets it on Monaco. */
import { describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import { applyNamedTheme, defaultThemeId, themeCatalog } from '../src/themes';

describe('named theme catalog', () => {
  it('lists all 16 RunJS theme names, 12 free and 4 premium, with unique ids', () => {
    expect(themeCatalog).toHaveLength(16);
    expect(new Set(themeCatalog.map((theme) => theme.id)).size).toBe(16);
    expect(themeCatalog.filter((theme) => theme.premium)).toHaveLength(4);
    expect(themeCatalog.filter((theme) => !theme.premium)).toHaveLength(12);
  });

  it('matches each theme base to its app-chrome appearance', () => {
    for (const theme of themeCatalog)
      expect(theme.base).toBe(theme.appChrome === 'dark' ? 'vs-dark' : 'vs');
  });

  it('includes the default theme in the catalog', () => {
    expect(themeCatalog.some((theme) => theme.id === defaultThemeId)).toBe(true);
  });
});

describe('applyNamedTheme', () => {
  it('defines and activates the requested theme by id', () => {
    const defineTheme = vi.fn();
    const setTheme = vi.fn();
    const monaco = { editor: { defineTheme, setTheme } } as unknown as Monaco;
    const theme = applyNamedTheme(monaco, 'monokai');
    expect(theme.id).toBe('monokai');
    expect(defineTheme).toHaveBeenCalledWith(
      'monokai',
      expect.objectContaining({ base: 'vs-dark' }),
    );
    expect(setTheme).toHaveBeenCalledWith('monokai');
  });

  it('falls back to the first catalog entry for an unknown id', () => {
    const defineTheme = vi.fn();
    const setTheme = vi.fn();
    const monaco = { editor: { defineTheme, setTheme } } as unknown as Monaco;
    const theme = applyNamedTheme(monaco, 'not-a-theme');
    expect(theme.id).toBe(themeCatalog[0].id);
  });
});

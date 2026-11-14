/** Defines RunJS's named editor color themes and applies one of them to Monaco. */
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export interface NamedTheme {
  id: string;
  label: string;
  /** Whether the overall app chrome (header, sidebar, results pane) should look light or dark. */
  appChrome: 'light' | 'dark';
  /** Locked behind a paid plan on RunJS; open on every plan here until that changes. */
  premium: boolean;
  base: 'vs' | 'vs-dark';
  rules: editor.ITokenThemeRule[];
  colors: editor.IStandaloneThemeData['colors'];
}

/** @param base Fallback theme. @param colors Comment, keyword, string, number, and type colors. */
function tokenRules(colors: {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
}): editor.ITokenThemeRule[] {
  return [
    { token: 'comment', foreground: colors.comment },
    { token: 'keyword', foreground: colors.keyword },
    { token: 'string', foreground: colors.string },
    { token: 'number', foreground: colors.number },
    { token: 'type', foreground: colors.type },
  ];
}

/** @param editorColors Core editor surface colors shared by every theme's UI chrome. */
function editorColors(editorColors: {
  background: string;
  foreground: string;
  lineNumber: string;
  lineNumberActive: string;
  selection: string;
  cursor: string;
}): editor.IStandaloneThemeData['colors'] {
  return {
    'editor.background': editorColors.background,
    'editor.foreground': editorColors.foreground,
    'editorLineNumber.foreground': editorColors.lineNumber,
    'editorLineNumber.activeForeground': editorColors.lineNumberActive,
    'editor.selectionBackground': editorColors.selection,
    'editorCursor.foreground': editorColors.cursor,
  };
}

/**
 * The 16 themes RunJS lists in its Themes menu, verified by name from its menu screenshots on
 * 2026-11-14. Colors below are each theme's well-known public palette, reproduced from memory
 * rather than pixel-matched against RunJS's own rendering — treat them as close approximations.
 * `appChrome` is this project's own judgment call (RunJS's chrome is fixed; ours now follows the
 * selected theme), defaulting to dark except for the handful of clearly light palettes.
 */
export const themeCatalog: NamedTheme[] = [
  {
    id: 'bespin',
    label: 'Bespin',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '937121',
      keyword: '5872b7',
      string: '54be0d',
      number: '35a236',
      type: '9b859d',
    }),
    colors: editorColors({
      background: '#28211c',
      foreground: '#baae9e',
      lineNumber: '#937121',
      lineNumberActive: '#baae9e',
      selection: '#4b4940',
      cursor: '#a7a7a7',
    }),
  },
  {
    id: 'blackboard',
    label: 'Blackboard',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: 'aeaeae',
      keyword: 'fbde2d',
      string: 'd8fa3c',
      number: 'ff6400',
      type: '8da6ce',
    }),
    colors: editorColors({
      background: '#0c1021',
      foreground: '#f8f8f8',
      lineNumber: '#aeaeae',
      lineNumberActive: '#f8f8f8',
      selection: '#253b76',
      cursor: '#fffdf6',
    }),
  },
  {
    id: 'colorcode',
    label: 'ColorCode',
    appChrome: 'light',
    premium: false,
    base: 'vs',
    rules: tokenRules({
      comment: '808080',
      keyword: '0000ff',
      string: 'a31515',
      number: '098658',
      type: '267f99',
    }),
    colors: editorColors({
      background: '#ffffff',
      foreground: '#000000',
      lineNumber: '#808080',
      lineNumberActive: '#000000',
      selection: '#add6ff',
      cursor: '#000000',
    }),
  },
  {
    id: 'dracula',
    label: 'Dracula',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '6272a4',
      keyword: 'ff79c6',
      string: 'f1fa8c',
      number: 'bd93f9',
      type: '8be9fd',
    }),
    colors: editorColors({
      background: '#282a36',
      foreground: '#f8f8f2',
      lineNumber: '#6272a4',
      lineNumberActive: '#f8f8f2',
      selection: '#44475a',
      cursor: '#f8f8f0',
    }),
  },
  {
    id: 'duotone-dark',
    label: 'Duotone Dark',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '6c6783',
      keyword: '9a86fd',
      string: 'ffcc95',
      number: '9a86fd',
      type: 'e09142',
    }),
    colors: editorColors({
      background: '#2a2734',
      foreground: '#e3dfff',
      lineNumber: '#6c6783',
      lineNumberActive: '#e3dfff',
      selection: '#4a4359',
      cursor: '#e3dfff',
    }),
  },
  {
    id: 'lesser-dark',
    label: 'Lesser Dark',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '7f7f7f',
      keyword: 'cda869',
      string: '8f9d6a',
      number: 'a5c261',
      type: 'cda869',
    }),
    colors: editorColors({
      background: '#262626',
      foreground: '#eeeeee',
      lineNumber: '#7f7f7f',
      lineNumberActive: '#eeeeee',
      selection: '#45443b',
      cursor: '#ffffff',
    }),
  },
  {
    id: 'lucario',
    label: 'Lucario',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '5c98cd',
      keyword: 'ff6b68',
      string: 'b4fa72',
      number: 'd65bff',
      type: '5cd6d6',
    }),
    colors: editorColors({
      background: '#2b3e50',
      foreground: '#f8f8f2',
      lineNumber: '#5c98cd',
      lineNumberActive: '#f8f8f2',
      selection: '#1d2e3c',
      cursor: '#ffffff',
    }),
  },
  {
    id: 'material',
    label: 'Material',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '546e7a',
      keyword: 'c792ea',
      string: 'c3e88d',
      number: 'f78c6c',
      type: 'ffcb6b',
    }),
    colors: editorColors({
      background: '#263238',
      foreground: '#eeffff',
      lineNumber: '#546e7a',
      lineNumberActive: '#eeffff',
      selection: '#314549',
      cursor: '#ffcc00',
    }),
  },
  {
    id: 'monokai',
    label: 'Monokai',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '75715e',
      keyword: 'f92672',
      string: 'e6db74',
      number: 'ae81ff',
      type: '66d9ef',
    }),
    colors: editorColors({
      background: '#272822',
      foreground: '#f8f8f2',
      lineNumber: '#75715e',
      lineNumberActive: '#f8f8f2',
      selection: '#49483e',
      cursor: '#f8f8f0',
    }),
  },
  {
    id: 'neo',
    label: 'Neo',
    appChrome: 'light',
    premium: false,
    base: 'vs',
    rules: tokenRules({
      comment: '75968f',
      keyword: '2974a1',
      string: '22a2c9',
      number: '92a75c',
      type: '003d99',
    }),
    colors: editorColors({
      background: '#f2f2f2',
      foreground: '#2e383c',
      lineNumber: '#75968f',
      lineNumberActive: '#2e383c',
      selection: '#d9edff',
      cursor: '#000000',
    }),
  },
  {
    id: 'tomorrow-night-bright',
    label: 'Tomorrow Night Bright',
    appChrome: 'dark',
    premium: false,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '969896',
      keyword: 'd54e53',
      string: 'b9ca4a',
      number: 'e78c45',
      type: '7aa6da',
    }),
    colors: editorColors({
      background: '#000000',
      foreground: '#eaeaea',
      lineNumber: '#969896',
      lineNumberActive: '#eaeaea',
      selection: '#424242',
      cursor: '#ffffff',
    }),
  },
  {
    id: 'visual-studio',
    label: 'Visual Studio',
    appChrome: 'light',
    premium: false,
    base: 'vs',
    rules: tokenRules({
      comment: '008000',
      keyword: '0000ff',
      string: 'a31515',
      number: '098658',
      type: '2b91af',
    }),
    colors: editorColors({
      background: '#ffffff',
      foreground: '#000000',
      lineNumber: '#237893',
      lineNumberActive: '#000000',
      selection: '#add6ff',
      cursor: '#000000',
    }),
  },
  {
    id: 'ayu',
    label: 'Ayu',
    appChrome: 'dark',
    premium: true,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '626a73',
      keyword: 'ff8f40',
      string: 'c2d94c',
      number: 'd2a6ff',
      type: '39bae6',
    }),
    colors: editorColors({
      background: '#0a0e14',
      foreground: '#b3b1ad',
      lineNumber: '#626a73',
      lineNumberActive: '#b3b1ad',
      selection: '#273747',
      cursor: '#e6b450',
    }),
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    appChrome: 'dark',
    premium: true,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '5c6370',
      keyword: 'c678dd',
      string: '98c379',
      number: 'd19a66',
      type: 'e5c07b',
    }),
    colors: editorColors({
      background: '#282c34',
      foreground: '#abb2bf',
      lineNumber: '#5c6370',
      lineNumberActive: '#abb2bf',
      selection: '#3e4451',
      cursor: '#528bff',
    }),
  },
  {
    id: 'shades-of-purple',
    label: 'Shades of Purple',
    appChrome: 'dark',
    premium: true,
    base: 'vs-dark',
    rules: tokenRules({
      comment: 'b362ff',
      keyword: 'ff9d00',
      string: 'a5ff90',
      number: 'ff628c',
      type: '9effff',
    }),
    colors: editorColors({
      background: '#2d2b55',
      foreground: '#e3dfff',
      lineNumber: '#b362ff',
      lineNumberActive: '#e3dfff',
      selection: '#453a7c',
      cursor: '#fad000',
    }),
  },
  {
    id: 'synthwave-84',
    label: "SynthWave '84",
    appChrome: 'dark',
    premium: true,
    base: 'vs-dark',
    rules: tokenRules({
      comment: '848bbd',
      keyword: 'ff7edb',
      string: '36f9f6',
      number: 'fede5d',
      type: 'c792ea',
    }),
    colors: editorColors({
      background: '#262335',
      foreground: '#f8f8f2',
      lineNumber: '#848bbd',
      lineNumberActive: '#f8f8f2',
      selection: '#423a6b',
      cursor: '#ff7edb',
    }),
  },
];

export const defaultThemeId = 'dracula';

/**
 * Defines (idempotent) and activates a named theme on Monaco.
 * @param monaco Monaco API whose theme registry will be updated.
 * @param id Theme id from `themeCatalog`; falls back to the default when unknown.
 */
export function applyNamedTheme(monaco: Monaco, id: string): NamedTheme {
  const theme = themeCatalog.find((candidate) => candidate.id === id) ?? themeCatalog[0];
  monaco.editor.defineTheme(theme.id, {
    base: theme.base,
    inherit: true,
    rules: theme.rules,
    colors: theme.colors,
  });
  monaco.editor.setTheme(theme.id);
  return theme;
}

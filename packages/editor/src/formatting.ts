/** Formats JavaScript and TypeScript drafts with Prettier, loaded only when formatting is requested. */
import type { Monaco } from '@monaco-editor/react';
import type { editor, IDisposable } from 'monaco-editor';
import type { Language } from '@code-editor/core';

/**
 * Formats one source snapshot with Prettier's default style.
 * @param source Complete draft text.
 * @param language Selects the Babel or TypeScript parser.
 * @returns Formatted text; rejects with Prettier's message when the draft has a syntax error.
 */
export async function formatSource(source: string, language: Language): Promise<string> {
  const [prettier, estree, parser] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/estree'),
    language === 'typescript'
      ? import('prettier/plugins/typescript')
      : import('prettier/plugins/babel'),
  ]);
  return prettier.format(source, {
    parser: language === 'typescript' ? 'typescript' : 'babel',
    plugins: [estree, parser],
  });
}

/**
 * Connects Prettier to Monaco's Format Document command and its Shift+Alt+F shortcut.
 * @param monaco Shared Monaco API; its built-in TypeScript formatter is reserved during setup.
 * @returns Cleanup that removes the formatter when access is revoked.
 */
export function registerFormatting(monaco: Monaco): IDisposable {
  const registrations = (['javascript', 'typescript'] as const).map((language) =>
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      displayName: 'Prettier',
      /** @param model Draft to format; syntax errors leave it unchanged. */
      async provideDocumentFormattingEdits(model: editor.ITextModel) {
        try {
          const text = await formatSource(model.getValue(), language);
          return [{ range: model.getFullModelRange(), text }];
        } catch {
          return [];
        }
      },
    }),
  );
  return {
    /** Unregisters both language formatters. */
    dispose() {
      for (const registration of registrations) registration.dispose();
    },
  };
}

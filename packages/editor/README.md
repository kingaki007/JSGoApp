# Shared editor

`@code-editor/editor` owns the JSGoApp editor integration. It is a private,
source-based workspace package for React applications built with Vite, including
the planned Electron renderer.

## Public API

- `CodeEditor`: controlled component accepting `value`, `language`, `path`,
  `theme`, `onChange`, optional `onReady`, and optional `loading` content.
- `CodeEditorHandle`: the ref exposes `compile(source, language)`, returning
  JavaScript from a source snapshot. JavaScript passes through; TypeScript
  uses the editor's language worker. Call after `onReady`.
- `EditorTheme`: `'light' | 'dark'`.

The application owns its drafts, project paths, layout, theme preference,
execution lifecycle, output panel, and storage. It should import the public
package instead of accessing Monaco or this package's internal files.

## Internals

| File                    | Responsibility                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `src/CodeEditor.tsx`    | Component lifecycle, editor defaults, and public handle           |
| `src/setup.ts`          | Local worker factory, loader, and compiler configuration          |
| `src/theme.ts`          | Semantic CSS token mapping and typography                         |
| `src/compile.ts`        | Source snapshots, syntax errors, TypeScript emission, and cleanup |
| `tests/compile.test.ts` | Compiler boundary and snapshot lifecycle checks                   |

The host loads the JSGoApp CSS token definitions before mounting the editor
and applies the resolved theme to the document. `theme.ts` reads `--editor-*`,
`--syntax-*`, `--color-focus`, `--font-family-code`, `--font-size-body`, and
`--line-height-code`. It does not maintain a second palette.

Vite's `?worker` imports bundle Monaco workers locally. No CDN or service
worker registration is involved. Execution workers belong to the app runtime,
not to this package. Adding another bundler will require a compatible worker
setup adapter.

The current custom theme is document-wide: multiple editor instances share
the same resolved theme. Mounting editors with conflicting themes in one
document is not supported.

Run `pnpm test packages/editor/tests` from the repository root.

<!-- Documents the reusable editor API, host responsibilities, and internal module boundaries. -->

# Shared editor

`@code-editor/editor` owns the JSGoApp editor integration. It is a private,
source-based workspace package for React applications built with Vite, including
the planned Electron renderer.

## Public API

- `CodeEditor`: controlled component accepting `value`, `language`, `path`,
  `theme`, `onChange`, optional `environment` (Browser by default), optional
  `onReady`, optional `preferences` (font size, word wrap, line numbers, font
  ligatures, invisibles),
  optional `onViewportChange`, optional `errorMarker` (line, message, and run
  identifier of the latest failure), and optional `loading` content.
- `CodeEditorHandle`: the ref exposes `compile(source, language)`, returning
  `{ code, lineMap }` from a source snapshot. JavaScript passes through;
  TypeScript uses the editor's language worker, and `lineMap` gives the draft
  line of each emitted line. `format()` runs Format Document. `lineTop(line)`
  and `lineHeight()` report document line geometry, unaffected by editor scroll,
  so the host can preserve source-line spacing in an independently scrollable
  pane. `onViewportChange` reports layout, content-size, and configuration changes,
  not scrolling. Call after `onReady`.
- `themeCatalog`: the 16 named Monaco themes (`NamedTheme[]`), each with an
  `id`, `label`, `premium` flag, and the `appChrome` ('light' or 'dark') the
  host should show while it is selected. `defaultThemeId` names the initial
  theme. `theme` on `CodeEditor` takes one of these ids.

The application owns its drafts, project paths, layout, theme selection,
execution lifecycle, output panel, and storage. It should import the public
package instead of accessing Monaco or this package's internal files.

## Internals

| File                     | Responsibility                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| `src/CodeEditor.tsx`     | Component lifecycle, editor defaults, and public handle           |
| `src/setup.ts`           | Local worker factory, loader, and compiler configuration          |
| `src/theme.ts`           | Editor typography resolved from the host's font tokens            |
| `src/themes.ts`          | Named theme catalog and Monaco theme activation                   |
| `src/compile.ts`         | Source snapshots, syntax errors, TypeScript emission, and cleanup |
| `src/formatting.ts`      | Gated Prettier formatter for Format Document                      |
| `src/errorLine.ts`       | Decoration that marks the line where a run failed                 |
| `src/environment.ts`     | Environment-specific compiler libraries and declarations          |
| `src/nodeDefinitions.ts` | Lazy Node and fetch declaration bundle                            |
| `tests/compile.test.ts`  | Compiler boundary and snapshot lifecycle checks                   |
| `tests/themes.test.ts`   | Named theme catalog shape and Monaco activation checks            |

The package ships no stylesheet. The host styles the error marker's classes,
`editor-error-line` (whole line) and `editor-error-line-marker` (gutter strip).

Named themes are self-contained: `themes.ts` defines each one's own Monaco
colors and does not read CSS custom properties. `theme.ts` still reads
`--font-family-code`, `--font-size-body`, and `--line-height-code` from the
host for typography, independent of which named theme is active.

Vite's `?worker` imports bundle Monaco workers locally. No CDN or service
worker registration is involved. Execution workers belong to the app runtime,
not to this package. Adding another bundler will require a compatible worker
setup adapter.

The current custom theme is document-wide: multiple editor instances share
the same resolved theme. Mounting editors with conflicting themes in one
document is not supported.

Run `pnpm test packages/editor/tests` from the repository root.

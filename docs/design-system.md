<!-- Defines design tokens, theme behavior, component conventions, and formatting rules. -->

# JSGoApp design system

We use plain CSS with custom properties. No CSS framework or component library
is required. This is a small foundation that will grow with the editor.

## Layers

`apps/web/src/styles/workspace.css` is loaded after the base stylesheet and
owns the explorer/editor/results composition and result-view controls. The
panes are side by side above 1000px; smaller layouts stack results below the
editor and then collapse the explorer into a compact language strip below 700px.

| File                              | Responsibility                                                     |
| --------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/styles/tokens.css`  | Theme-independent spacing, typography, radii, sizing, and motion   |
| `apps/web/src/styles/themes.css`  | Per-theme colors plus `color-mix()` shell tokens derived from them |
| `apps/web/src/styles/popover.css` | Shared trigger/menu popover styling (env-picker, theme gallery)    |
| `apps/web/src/style.css`          | Base styles, component rules, and responsive layout                |
| `apps/web/src/theme.ts`           | Named theme selection, persistence, and shell color application    |
| `packages/editor/src/themes.ts`   | The 16 named Monaco themes and their activation                    |
| `packages/editor/src/theme.ts`    | Editor typography mapping                                          |

## Tokens

- Use `--space-*` for spacing and `--radius-*` for corner radii.
- Use `--font-*`, `--line-height-*`, and `--letter-spacing-*` for typography.
- Use semantic colors such as `--color-text-muted` and `--color-surface-selected`.
- Keep color literals in the theme definitions instead of component styles.
- Keep editor-specific colors in `--editor-*` and syntax colors in `--syntax-*`.
- Use `--color-focus` for keyboard focus and retain visible focus indicators.
- Use the motion tokens and respect `prefers-reduced-motion`.

The current spacing scale uses multiples of 4px at the default root size.
Font sizes use rem. Monaco font settings are resolved from these tokens when
the editor mounts.

## Themes

The header's Theme gallery lists the 16 named themes in `packages/editor/src/themes.ts`
(RunJS's own theme names, each with its own editor colors). Selecting one sets
Monaco's colors and, through `apps/web/src/theme.ts`, writes `--color-background`,
`--color-text`, and the matching `--editor-*`/`--syntax-*` custom properties
straight onto `document.documentElement`. `themes.css` derives the rest of the
shell's surfaces (`--color-surface`, `--color-border`, `--color-text-muted`, …)
from just those two colors with `color-mix()`, so every theme recolors the
whole app, not only the editor, without needing its own full token set.

Brand-identity colors (`--color-accent`, `--color-focus`, `--color-success-*`,
the language badges, switch colors) stay fixed per `appChrome` ('light' or
'dark', one of `NamedTheme`'s own fields) rather than following each theme,
so JSGoApp's own accent stays recognizable across all 16. `theme.ts` still sets
`document.documentElement.dataset.theme` to `appChrome` for this.

The choice is saved under `jsgoapp.theme` in local storage, as the theme's
`id`. If storage is blocked, theme switching still works for the session. Code
drafts are not saved. Adding a theme means adding an entry to `themeCatalog`
with its own `base`, `appChrome`, `rules`, and `colors`; no other file changes.

## Components and responsiveness

Current components are the brand, language navigation, theme gallery, editor
surface, notice, and status bar. Extract reusable React components when
another screen needs them; avoid building an unused component catalog.

The compact layout starts at 700px. Native CSS media-query conditions cannot
use CSS custom properties, so this breakpoint is documented here and appears
as a literal in the stylesheet. Intrinsic layout values such as `0`, `auto`,
`100%`, and `1fr` remain local to their layout rules.

Check a light and a dark theme, keyboard focus, and a compact viewport when
changing UI. Changing a theme must preserve the active language, draft,
selection, and undo history. Named themes inherit unspecified Monaco widget
colors from their `base` ('vs' or 'vs-dark').

## Formatting

Prettier formats maintained source, configuration, and Markdown files with
2-space indentation, single quotes, semicolons, and LF line endings.
EditorConfig supplies the matching defaults for other editors.
Generated output, dependencies, and the pnpm-managed lockfile are excluded.

```sh
pnpm format
pnpm format:check
```

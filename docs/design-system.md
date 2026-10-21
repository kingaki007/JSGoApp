# JSGoApp design system

We use plain CSS with custom properties. No CSS framework or component library
is required. This is a small foundation that will grow with the editor.

## Layers

| File                             | Responsibility                                                         |
| -------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/styles/tokens.css` | Theme-independent spacing, typography, radii, sizing, and motion       |
| `apps/web/src/styles/themes.css` | Semantic colors for the app shell, status indicators, and editor       |
| `apps/web/src/style.css`         | Base styles, component rules, and responsive layout                    |
| `apps/web/src/theme.ts`          | System preference detection, theme persistence, and Monaco integration |

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
the editor mounts. Monaco theme colors are read from CSS whenever the theme
changes, so its color values do not need a second copy in TypeScript.

## Themes

The segmented theme switch supports System, Light, and Dark, with matching icons
and an animated selection indicator. Native radio inputs provide Tab and arrow-key
navigation. Compact screens show icons with accessible labels; reduced-motion
preferences disable animation. System follows the operating
system and reacts when its preference changes. An explicit choice overrides it.
The preference is saved under `jsgoapp.theme` in local storage. If storage is
blocked, theme switching still works for the session. Code drafts are not saved.

The resolved theme is applied to `document.documentElement.dataset.theme`.
Both shell and Monaco switch together. Additional themes should supply every
semantic token and declare the appropriate CSS color scheme.

## Components and responsiveness

Current components are the brand, language navigation, theme selector,
editor surface, notice, and status bar. Extract reusable React components
when another screen needs them; avoid building an unused component catalog.

The compact layout starts at 700px. Native CSS media-query conditions cannot
use CSS custom properties, so this breakpoint is documented here and appears
as a literal in the stylesheet. Intrinsic layout values such as `0`, `auto`,
`100%`, and `1fr` remain local to their layout rules.

Check both themes, keyboard focus, and a compact viewport when changing UI.
Changing a theme must preserve the active language, draft, selection, and undo
history. Custom Monaco themes inherit unspecified widget and syntax colors
from Monaco's matching light or dark base.

## Formatting

Prettier formats maintained source, configuration, and Markdown files with
2-space indentation, single quotes, semicolons, and LF line endings.
EditorConfig supplies the matching defaults for other editors.
Generated output, dependencies, and the pnpm-managed lockfile are excluded.

```sh
pnpm format
pnpm format:check
```

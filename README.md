<!-- Explains the product scope, workspace architecture, local commands, and development conventions. -->

# JSGoApp

A JavaScript and TypeScript playground for web and desktop,
planned for Windows, macOS, and Linux.

## Status

Early development. The web app now includes a runnable Monaco editor
with JavaScript and TypeScript scratchpads. Each language retains its
draft while switching. Auto run is enabled by default and executes after a
two-second pause in typing. Run executes immediately; Stop cancels active work.
Disable the Auto run checkbox for manual execution. The active scratchpad runs in a
disposable sandboxed browser page or a disposable Node process, selected through the
editor's Env dropdown, with console output, Stop, and a five-second timeout.
TypeScript is compiled using Monaco's bundled TypeScript language worker.
JavaScript and TypeScript drafts and the selected language are automatically
saved on this device and restored after a refresh, without an account.

An initial Electron shell reuses the web UI and shared Node runner. npm imports, project file saving, cloud accounts, and desktop installers are not
connected yet. Await asynchronous work explicitly; the runner ends when the
top-level async function completes. Type annotations
are stripped before running; semantic type errors remain visible in Monaco
and do not block execution. Node supports built-in module imports; browser module
imports and third-party package installation remain deferred.

This is a local scratchpad for code you trust. Browser snippets run in a sandboxed
page with an opaque origin, so they cannot read the app's storage or DOM. The
browser decides whether that page gets its own process; where it shares the app's
thread, heavy synchronous work makes the app unresponsive until it finishes or
the five-second limit stops it. A separate execution origin
and stricter isolation are required before running untrusted shared projects or
adding accounts.

Hosting and deployment decisions are deferred.

## Definition navigation

Definition navigation, autocomplete, and hover documentation are controlled by
the shared Free/Plus/Max feature policy. All visitors currently receive Max.
See [subscription feature configuration](docs/feature-access.md) for plan lists,
global on/off switches, and the future user subscription contract.

Built-in definitions are available through Ctrl+click on Windows/Linux or
Cmd+click on macOS, and through F12 (Go to Definition). External declarations
open in a read-only inline peek view; the editable scratchpad stays in place.
Monaco also provides hover signatures and documentation for recognized symbols.
Browser and Node environments use their respective library declarations.

## Automatic execution

Top-level expressions now produce results without `console.log` in Browser and
Node environments. For example, `2 + 2` displays `4`, and
`[1, 2, 3].map(n => n * 2)` displays the resulting array. JavaScript and compiled
TypeScript use the same expression transform. Expressions run once, in source
order, interleaved with explicit console output. Undefined results are omitted.
Declarations and expressions inside functions/loops are not automatically printed.
Use `await` to inspect an asynchronous result.

Once the editor is ready, non-empty code runs after two seconds without edits.
Every edit cancels an in-flight run and replaces the pending timer. Changing
language or environment schedules the selected draft after the same delay.
The latest source is compiled at execution time. Empty drafts clear output
without launching a page or Node process.

Manual Run cancels the pending timer and executes immediately, without a second
automatic run. Stop remains effective until the next edit or context change;
finishing, errors, output updates, theme changes, and Clear output do not create
new runs. Turning Auto run off cancels pending and active work. The preference
is saved with the other settings and applies equally to the web and Electron UI.

## RunJS-style workbench

These capabilities follow RunJS and are shared by the web and desktop apps. Each
has its own feature flag in `packages/core/src/features.ts` and is currently open
on every plan; see [subscription feature configuration](docs/feature-access.md).

- **Match lines** (`matchLines`): each expression result and console call appears
  in the results pane beside the source line that produced it, and scrolls with
  the editor. Several values from one line share its row. TypeScript results are
  mapped back to draft lines through the compiler's source map, so type-only lines
  do not shift them. Errors and output without a known line are listed at the
  bottom of the pane. The list view is used when Match lines is off or when the
  panes are stacked on narrow windows.
- **Settings** (`workspaceSettings`): Auto run, Match lines, Show undefined, Word
  wrap, Line numbers, and Font size. Preferences persist on this device in the
  `jsgoapp.settings` local-storage entry. Show undefined reports expression
  statements that evaluate to `undefined`; console calls are never reported twice.
- **Format** (`codeFormatting`): the Format button and Shift+Alt+F format the draft
  with Prettier's default style as one undoable edit. Prettier loads on first use.
  A draft with a syntax error is left unchanged.
- **Tabs** (`multipleTabs`): create JavaScript or TypeScript tabs with +JS and
  +TS, double-click a name to rename it, and close a tab with ×. Closing a tab
  that contains code asks for confirmation because its code is discarded. Up to
  30 tabs are stored. Existing two-scratchpad drafts are migrated automatically.

- **Expandable values** (`objectInspection`): objects, arrays, Maps, Sets, class
  instances, and errors appear as a one-line preview that opens into a tree of
  their entries. In the list view each value expands in place; with Match lines
  on, clicking a row opens it over the rows below until it is closed. Values are
  captured when they are logged, so later mutations do not change them. Getters
  are shown as `[Getter]` and never invoked. Trees keep 5 levels and 100 entries
  per value; larger values state how many entries are not shown. Strings and
  other primitives stay plain text.

- **Web view** (`webView`): in the Browser environment the results pane offers
  Web, Console, and Split. Web shows the page your code renders (`document`,
  canvas, event handlers, animation loops); Split shows the page above the
  console. The page stays live after the run finishes, until the next run, Stop,
  or a change of tab, environment, or view. Choosing a view that adds or removes
  the page reruns the code when Auto run is on, because a page cannot move
  between containers. Node.js has no page, so the switch is hidden there and the
  console is shown. Match lines applies to the Console view only.

RunJS capabilities not yet implemented: npm package installation, environment
variables, a snippet library, opening and saving
files, Vim keybindings, loop protection, and the combined Browser + Node runtime.

## Workspace layout

The home page at `/` introduces JSGoApp and links to `/playground`. The playground
loads the editor on demand, so the landing page does not load Monaco. Desktop
starts directly at `/playground` and uses the same page routing.

The home page includes Windows, macOS, and Linux download options. Installer
builds have not been published, so these options show Coming soon and are
disabled. Set the release URLs in `apps/web/src/desktopDownloads.ts` when actual
installers are available. No placeholder links pretend to download an app.

The explorer, editor, and results appear side by side on wide screens, with
stacked panes on compact screens. In the Browser environment the right pane has
Web, Console, and Split controls; Console is selected by default and the choice
lasts for the session. Node.js shows the console without the switch.

The Env dropdown selects Browser or Node.js independently of output views and
language. Browser provides a real `document` and `window` in a hidden page; Node runs
through Electron IPC on desktop or the local HTTP runner for the web app.
See [execution environments](docs/execution-environments.md) for the shared
architecture, RunJS reference, startup commands, and current limitations.

## Local draft recovery

The web app stores every scratchpad tab and the active tab in a versioned
`jsgoapp.drafts` local-storage entry after 500ms without edits. Snapshots saved
in the earlier one-draft-per-language format are read as two tabs. It also attempts
to flush pending edits when the page is hidden or closed. The save message
reports success or storage failures. Empty drafts are preserved.

Invalid or inaccessible stored data does not prevent the app from opening.
It shows a recovery message and leaves stored data untouched until a user
edits or changes language. Storage errors leave the current code in memory.

This is browser recovery, not file export or cloud backup. Clearing browser
data can remove drafts. Only tabs and the active tab are persisted; console
output and undo history are not. Switching between tabs of the same language
resets that tab's undo history. Multiple tabs use the same entry, so the
last successful save wins; cross-tab merging is not implemented.

## Planned capabilities

- JavaScript and TypeScript editing with Monaco.
- Browser and Node.js execution environments.
- Install, load, and import npm modules in supported execution environments,
  with package version and dependency management.
- JavaScript framework support, starting with React,
  then Vue, Svelte, and others through framework adapters.
- Projects with files and nested folders.
- Local saving without registration.
- Optional accounts for cloud saving and cross-device sync.
- Social login and email registration.
- Extensible language services and execution adapters.
- Configurable Free/Plus/Max feature access, with Max enabled for all current users.
- Desktop downloads accessible from the web app.

## Agreed technology stack

- UI: React, TypeScript, Vite, Monaco Editor.
- Desktop: Electron.
- Backend: NestJS with the Fastify adapter.
- Data: PostgreSQL and S3-compatible object storage.
- Authentication: social and email login through an auth provider.
- Workspace: pnpm monorepo.
- Testing: Vitest and Playwright.

## Current structure

- apps/web: application layout, drafts, theme selection, and browser execution.
- packages/editor: reusable editor component, Monaco configuration, language
  workers, theme mapping, and TypeScript compilation.
- packages/core: shared project types, runtime contracts,
  and feature policy.
- packages/runtime-node: shared Node runner and disposable snippet entrypoint.
- apps/runner: loopback HTTP transport for Node execution from the web app.
- apps/desktop: Electron shell, preload bridge, and utility-process adapter.

The accounts backend and desktop installer packaging remain planned.

Applications are runnable products; packages are libraries imported by them.
`pnpm-workspace.yaml` links `@code-editor/core` and `@code-editor/editor` to their
local source folders. `pnpm dev` starts Vite for `apps/web`; Vite bundles the
shared packages into the app and emits worker scripts separately. The packages
do not run as separate servers. `pnpm typecheck` checks every workspace package,
`pnpm test` discovers their test folders, and `pnpm build` builds the web app.

## Development requirements

- Node.js 22.14 or newer.
- pnpm 12.3.4.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173 for the landing page, or
http://127.0.0.1:5173/playground for the editor. Dependencies and workers are bundled
locally; Monaco does not load from a CDN.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Automated tests cover shared project validation, feature policy, output capture,
source-line tracking, source-map decoding, value inspection, preferences, tab storage and migration,
execution failures, output limits, timeout, cancellation, local draft recovery, and compiler snapshot
cleanup. Editor typing and
draft retention have also been checked in the browser.

Each application or package keeps its tests in a `tests/` folder alongside
`src/`. Mirror source subdirectories inside `tests/` as modules grow:

```text
apps/web/
  src/
  tests/
    execution.test.ts
    runtime.test.ts
packages/core/
  src/
  tests/
    index.test.ts
packages/editor/
  src/
  tests/
    compile.test.ts
```

The root `vitest.config.ts` discovers `.test.ts`, `.test.tsx`, `.spec.ts`, and
`.spec.tsx` files recursively under these per-module test folders. Type checks
include the test folders. Run all suites with `pnpm test`, or one module's tests
with `pnpm test apps/web/tests` or `pnpm test packages/core/tests`.

The production build currently reports a large Monaco bundle. Loading only
needed language features and splitting the editor bundle are follow-up work.

## Styling and formatting

The app uses plain CSS and its own token-based design system, with System,
Light, and Dark themes shared by the shell and Monaco. The theme preference
persists locally. See [the design system guide](docs/design-system.md).

Run `pnpm format` to format maintained files. Prettier and EditorConfig define
the shared style, and VS Code formats on save when the recommended Prettier
extension is installed.

## Contribution workflow

Every new commit updates [CHANGELOG.md](CHANGELOG.md), increments the synchronized
root/app/package version, and receives an annotated Git tag `v<version>`.
Earlier commits remain unchanged. Prepare a version with:

```sh
pnpm version:next patch "Describe the change"
pnpm version:check
```

Use `patch` for fixes, documentation, tests, and refactors; use `minor` for new
capabilities and `major` for a deliberate major release. Review the generated
changelog entry and run `pnpm check`. Version preparation does not commit, tag,
or push automatically. Git tags connect each version's changelog to its exact
commit; GitHub release publication and deployment are separate decisions.

Start source files with a short purpose comment. Document named functions,
classes, and methods with intent and parameter descriptions; use JSDoc for
TypeScript APIs. Keep callback names and test descriptions expressive rather
than explaining every syntax detail. Document non-obvious lifecycle and
cancellation behavior where it happens.

Maintained code uses `.tsx` for React components and `.ts` for non-React code,
scripts, and configuration. Root scripts run through `tsx`. Esbuild generates
the shared Node runtime as ESM `.js` and Electron main/preload as CommonJS `.js`
in ignored `dist/` folders. Package metadata selects the module format; no
maintained CJS/MJS source or separate handwritten declaration shim is needed.
Node, Electron, HTTP service, build scripts, and UI sources are all type-checked.

JSON files must remain valid JSON. Their purposes are documented here instead
of inserting unsupported comments:

| File                                           | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `package.json` and workspace package manifests | Package identity, scripts, and dependency boundaries        |
| `tsconfig.base.json`                           | Shared TypeScript and JSX compiler settings                 |
| `tsconfig.scripts.json`                        | Type checks for root build, version, and test configuration |
| Each module's `tsconfig.json`                  | Source and test files included in that module's type checks |
| `.prettierrc.json`                             | Shared formatting rules                                     |
| `.vscode/settings.json`                        | Workspace editor settings and format-on-save                |
| `.vscode/extensions.json`                      | Recommended development extensions                          |

Generated files such as `pnpm-lock.yaml` are maintained by their tools.

Develop one small capability at a time and verify it before expanding.
Keep changes uncommitted until the owner requests a milestone commit
and push. Hosting decisions remain deferred.

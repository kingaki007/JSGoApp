<!-- Explains the product scope, workspace architecture, local commands, and development conventions. -->

# JSGoApp

A JavaScript and TypeScript playground for web and desktop,
planned for Windows, macOS, and Linux.

## Status

Early development. The web app now includes a runnable Monaco editor
with JavaScript and TypeScript scratchpads. Each language retains its
draft while switching. Run executes the active scratchpad in a disposable
browser worker or a disposable Node process, selected through the editor's Env
dropdown, with console output, Stop, and a five-second timeout.
TypeScript is compiled using Monaco's bundled TypeScript language worker.
JavaScript and TypeScript drafts and the selected language are automatically
saved on this device and restored after a refresh, without an account.

An initial Electron shell reuses the web UI and shared Node runner. DOM previews,
npm imports, project file saving, cloud accounts, and desktop installers are not
connected yet. Await asynchronous work explicitly; the runner ends when the
top-level async function completes. Type annotations
are stripped before running; semantic type errors remain visible in Monaco
and do not block execution. Node supports built-in module imports; browser module
imports and third-party package installation remain deferred.

This is a local scratchpad for code you trust. A Web Worker keeps code off the
UI thread and can be terminated, but it is not a security sandbox. A separate
execution origin and stricter isolation are required before running untrusted
shared projects or adding accounts.

Hosting and deployment decisions are deferred.

## Workspace layout

The home page at `/` introduces JSGoApp and links to `/playground`. The playground
loads the editor on demand, so the landing page does not load Monaco. Desktop
starts directly at `/playground` and uses the same page routing.

The home page includes Windows, macOS, and Linux download options. Installer
builds have not been published, so these options show Coming soon and are
disabled. Set the release URLs in `apps/web/src/desktopDownloads.ts` when actual
installers are available. No placeholder links pretend to download an app.

The explorer, editor, and results appear side by side on wide screens, with
stacked panes on compact screens. The right pane has Web, Console, and Split
controls in both environments. Web and Split remain visible but disabled while
preview development is deferred; Console stays selected.

The Env dropdown selects Browser or Node.js independently of output views and
language. Browser currently provides worker APIs without DOM access. Node runs
through Electron IPC on desktop or the local HTTP runner for the web app.
See [execution environments](docs/execution-environments.md) for the shared
architecture, RunJS reference, startup commands, and current limitations.

## Local draft recovery

The web app stores both scratchpads and the selected language in a versioned
`jsgoapp.drafts` local-storage entry after 500ms without edits. It also attempts
to flush pending edits when the page is hidden or closed. The save message
reports success or storage failures. Empty drafts are preserved.

Invalid or inaccessible stored data does not prevent the app from opening.
It shows a recovery message and leaves stored data untouched until a user
edits or changes language. Storage errors leave the current code in memory.

This is browser recovery, not file export or cloud backup. Clearing browser
data can remove drafts. Only drafts and language are persisted; console
output and undo history are not. Multiple tabs use the same entry, so the
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
- Owner-controlled paywall configuration, initially open.
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

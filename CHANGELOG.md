<!-- Records versioned repository milestones; annotated Git tags map each entry to its exact commit. -->

# JSGoApp changelog

Every new milestone commit updates this file and the workspace version. Earlier
commits are grouped under the original baseline without rewriting Git history.

## [0.9.0] - 2026-11-13

- Add a RunJS-style workbench shared by the web and desktop apps. Each capability
  has its own feature flag and is open on every plan; removing a flag's name from
  a plan list paywalls it.
- Match lines (`matchLines`): show each expression result and console call beside
  the source line that produced it, scrolling with the editor. Source lines travel
  through the browser worker, Node runner, HTTP stream, and Electron IPC; TypeScript
  results map back to draft lines through the compiler source map.
- Settings (`workspaceSettings`): Auto run, Match lines, Show undefined, Word wrap,
  Line numbers, and Font size, saved on the device. Auto run is no longer session-only.
- Format (`codeFormatting`): format the draft with Prettier from the Format button
  or Shift+Alt+F. Monaco's built-in formatter is reserved, so formatting is
  unavailable when this flag is off.
- Tabs (`multipleTabs`): create, rename, and close JavaScript and TypeScript tabs.
  Saved two-scratchpad drafts migrate to tabs. Switching between tabs of one
  language resets that tab's undo history.
- Console statements are no longer wrapped as expression results, so Show undefined
  never reports them twice.
- Record the small-PR, documentation, and changelog working agreements in AGENTS.md.
- Add source-line, source-map, preference, tab-storage, and migration coverage,
  bringing the automated suite to 96 tests; verify source lines in Electron's
  Node utility process.

## [0.8.0] - 2026-11-11

- Display top-level expression results automatically in Browser and Node execution,
  including compiled TypeScript, without requiring console.log.
- Preserve single evaluation, source order, explicit logs, and awaited results;
  keep existing output limits and cancellation behavior.
- Pin the existing Vite, React build-plugin, and Vitest versions to prevent
  unrelated tool upgrades when adding dependencies.
- Add expression regression coverage, bringing the automated suite to 72 tests,
  and verify automatic values in Electron's Node utility process.

## [0.7.1] - 2026-10-23

- Fix Light theme crashing the built desktop renderer when minified CSS uses
  shorthand hex colors. Normalize colors before passing them to Monaco.
- Cover theme switching and reopening with a saved Light preference in an
  isolated Electron renderer smoke test, plus shorthand-color regression coverage.

## [0.7.0] - 2026-10-22

- Add shared Free/Plus/Max feature lists, independent feature off switches, and
  a paywall bypass switch. Anonymous visitors retain Max access by default.
- Gate editor definitions, autocomplete, and hover/signature documentation at
  the Monaco provider level in web and desktop.
- Define future account subscription data and Free fallback for inactive or
  expired authenticated subscriptions.
- Verify plan membership, expiry, global switches, and provider cleanup,
  bringing the automated suite to 63 tests.

## [0.6.0] - 2026-10-22

- Automatically execute non-empty drafts after two seconds without edits in
  Browser and Node environments. Auto run is enabled by default and can be
  disabled for manual execution.
- Cancel stale execution when source, language, or environment changes; preserve
  immediate Run and Stop without duplicate automatic runs.
- Open built-in JavaScript/TypeScript and Node library declarations in a
  read-only inline peek through Ctrl/Cmd+click or F12, keeping the scratchpad intact.
- Add nine automatic-execution regression tests, bringing the suite to 45 tests.

## [0.5.0] - 2026-10-22

### Added

- A responsive landing page at `/` with a short introduction, shared themes,
  playground links, and Windows/macOS/Linux desktop download sections.
- A dedicated `/playground` route with lazy editor loading and direct-refresh
  support. Desktop opens the playground directly.
- Central installer URL configuration; download options remain disabled and
  show Coming soon until actual installers are published.
- Route coverage, bringing the automated suite to 36 tests.

### Changed

- Migrated maintained Electron, Node runner, HTTP service, version scripts, and
  test configuration from CJS/MJS variants to TypeScript. React components use
  TSX; non-React sources use TS.
- Added type checks for desktop, service, and build scripts. Build tools emit
  ESM or CommonJS JavaScript into ignored `dist/` directories as each host needs.
- Updated desktop asset handling and allowed navigation for the home and
  playground routes, while keeping external navigation blocked.
- Documented source conventions, routes, build steps, and installer availability.

### Validation and limitations

- Formatting, type checks, 36 tests, production builds, and Electron's execution,
  timeout, and asset smoke checks pass. Browser checks covered both environments,
  direct refresh, home navigation, themes, and mobile layout.
- Desktop installers remain unpublished; hosting remains deferred. Existing
  Monaco and Node declaration bundle-size warnings remain follow-up work.

## [0.4.0] - 2026-10-22

### Added

- An animated, keyboard-accessible Env dropdown in the editor toolbar for
  Browser and Node.js, independent of JavaScript/TypeScript language selection.
- A shared Node execution package with disposable processes, bounded console
  output, cancellation, request validation, and a five-second execution deadline.
- A loopback HTTP execution service for the web app, using JSON requests and
  streamed newline-delimited JSON responses. Disconnecting cancels the run.
- An initial Electron shell reusing the web UI, with a sandboxed renderer,
  narrow preload IPC bridge, and a Node utility-process adapter.
- A standard app protocol for built desktop assets and a smoke check covering
  actual Node execution, infinite-loop termination, and asset loading.
- Environment-specific Monaco libraries and lazy Node type definitions.
- Execution architecture, startup instructions, and RunJS UI reference notes in
  `docs/execution-environments.md`.

### Changed

- Kept Web/Console/Split visible in both environments, with Web and Split disabled
  while the separate DOM preview experiment remains parked.
- Switching language or environment cancels execution and clears stale output
  while preserving drafts. Node availability failures do not fall back to Browser.
- Isolated temporary TypeScript compilation models to prevent duplicate-variable
  diagnostics from leaking into the visible editor.
- Added Node process and HTTP integration coverage; the suite now has 34 tests.

### Scope and version notes

- This is trusted local console execution and an Electron development shell.
  Hosted isolation, installers, signing, npm management, frameworks, and DOM
  preview remain future milestones. macOS and Linux have not been verified.
- `v0.3.0` identifies the separate parked preview snapshot, not a main-branch
  release. This milestone uses `v0.4.0` without moving that existing tag.
- Existing Monaco bundle warnings remain; the Node declaration bundle is loaded
  only when Node.js is selected.

## [0.2.0] - 2026-10-22

### Added

- Local recovery for JavaScript/TypeScript drafts and the selected language,
  including debounced saves, page lifecycle flushes, and storage failure messages.
- An explorer/editor/results workbench with a responsive stacked layout.
- Browser result views for Web, Console, and Split; Node result logic stays console-only.
- Tests for draft restoration and environment-specific result controls, bringing
  the suite to 24 tests.
- Synchronized workspace versioning, a changelog consistency check, and a
  version preparation command. Annotated version tags identify future commits.

### Changed

- Moved console output into the right-hand results pane without losing output
  when switching views.
- Added purpose headers and function/method parameter documentation throughout
  maintained source files. Documented strict JSON configuration in the README.
- Recorded development, documentation, testing, and versioning conventions in `AGENTS.md`.

### Current limitations

- Web preview is a labeled placeholder; DOM rendering and Node execution are not connected yet.
- Browser draft recovery is local storage, not file export or a cloud backup.
- Monaco bundle size optimization remains follow-up work.

## [0.1.0] - 2026-10-22

Historical baseline through commit `a92268b`:

- Created the workspace scaffold, roadmap, and editor settings.
- Added a Monaco editor with JavaScript and TypeScript scratchpads.
- Added browser-worker execution, console output, Stop, timeouts, and output limits.
- Added the token-based design system, persistent themes, and animated theme switcher.
- Configured Prettier, EditorConfig, and per-module Vitest test folders.
- Extracted Monaco configuration, compilation, and customization into `packages/editor`.

This baseline predates per-commit versioning and has no retroactive release tag.

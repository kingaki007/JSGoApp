<!-- Records versioned repository milestones; annotated Git tags map each entry to its exact commit. -->

# JSGoApp changelog

Every new milestone commit updates this file and the workspace version. Earlier
commits are grouped under the original baseline without rewriting Git history.

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

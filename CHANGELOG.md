<!-- Records versioned repository milestones; annotated Git tags map each entry to its exact commit. -->

# JSGoApp changelog

Every new milestone commit updates this file and the workspace version. Earlier
commits are grouped under the original baseline without rewriting Git history.

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

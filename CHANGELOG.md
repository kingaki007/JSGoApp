<!-- Records versioned repository milestones; annotated Git tags map each entry to its exact commit. -->

# JSGoApp changelog

Every new milestone commit updates this file and the workspace version. Earlier
commits are grouped under the original baseline without rewriting Git history.

## [0.27.0] - 2026-11-15

- Let multiple Match lines result rows stay expanded independently. Show expanded
  objects and tables inline without bordered boxes or separate row scrollbars.
- Add on-demand Browser object inspection with run-scoped handles, expandable
  property ranges, prototype navigation, and cleanup on run replacement or Clear/Stop.
  Only requested branches are read; Node and console.table retain bounded snapshots.
- Cap aligned-result gaps at 32px and add bottom padding so the final table border
  remains visible.

## [0.26.2] - 2026-11-15

- Decouple results scrolling from the editor while retaining Match lines spacing.
  Make aligned results independently scrollable, with unplaced output and errors
  following the results instead of overlaying the bottom of the pane.
- Expand aligned tables and objects in the results layout so they push subsequent
  output down instead of covering it.
- Watch all sandbox-runner source dependencies in development so changes to
  console formatting invalidate Vite's cached runner bundle.

## [0.26.1] - 2026-11-15

- Fix Browser console output failing on `console.log(window)` by formatting safe
  inspection snapshots without invoking custom getters or `toJSON` hooks.
- Show `Window` properties and expandable DOM markup for `document` and elements;
  keep readable properties when a sibling is inaccessible. Add regression tests
  and a real Chromium sandbox console check to the desktop smoke suite.

## [0.26.0] - 2026-11-15

- Replace the System/Light/Dark switch with RunJS's 16 named editor themes
  (`packages/editor/src/themes.ts`), verified by name from its menu screenshots:
  12 open to everyone, 4 gated by the new `premiumThemes` flag (open on every
  plan for now, reserved for pricing parity with RunJS's own paywalled themes).
- Selecting a theme now recolors the whole app, not only the editor: the
  header, sidebar, and results pane derive their colors from that theme's own
  background and text via `color-mix()`, instead of a single shared dark/light
  palette. Brand accent/focus/success colors still follow a light/dark bucket
  so JSGoApp's own identity stays recognizable across all 16 themes.
- Extract the shared trigger/menu popover styling into `popover.css` so the
  landing page's Theme control can use it without pulling in the workbench's
  own grid layout, which had been collapsing the Results pane's column.

## [0.25.1] - 2026-11-15

- Refactor: split App.tsx (405 lines) into smaller pieces with no behavior change —
  `AppHeader.tsx` and `EditorToolbar.tsx` for the header and editor toolbar markup,
  and `useWorkbenchShortcuts.ts` / `useLineAlignment.ts` for the tab-action and
  line-alignment logic. App.tsx is now 265 lines, focused on composition.

## [0.25.0] - 2026-11-15

- Add Ctrl+T and Ctrl+W keyboard shortcuts (`tabShortcuts`, open on every plan).
  Ctrl+T creates a new tab in the active tab's language, same as +JS/+TS; Ctrl+W
  closes the active tab, with the same Confirm close behavior as the × button.

## [0.24.0] - 2026-11-15

- Add a Reopen closed tab button (↺) and Ctrl+Shift+T shortcut (`reopenClosedTab`,
  open on every plan). Restores the most recently closed tab with its original
  code, name, and id; up to 10 closed tabs are kept in memory for the session,
  never persisted to disk.
- Add `openFile`, `saveFile`, and `saveFileAs` feature flags, reserved for when
  file-system Open/Save/Save As is built. Paywalled off Free, matching RunJS's
  own paid Open/Save/Save As; no UI exists yet, so they currently do nothing.

## [0.23.0] - 2026-11-15

- Add a Clear button and Ctrl+Shift+K shortcut (`clearEditor`, open on every plan)
  that empty the active tab's code. Confirms first under the same Confirm close
  setting as closing a tab, since both discard the code.

## [0.22.0] - 2026-11-15

- Add a Confirm close setting (under `workspaceSettings`, open on every plan).
  Closing a tab that has code in it still asks for confirmation by default;
  turning the setting off closes it immediately instead.

## [0.21.2] - 2026-11-14

- Rename the execution-environments doc's environment-selection section and tidy
  its wording; update the two historical changelog entries and two source comments
  that referenced it.

## [0.21.1] - 2026-11-14

- Rename the README's workbench-capabilities section and tidy its surrounding text.
- Remove environment variables from the README's "not yet implemented" list; it has
  been implemented since v0.18.0 and was left there by mistake.
- Fix the Env vars and Settings popovers rendering behind the editor toolbar's own
  Env dropdown and Format button, instead of above them. The header now keeps its
  own popovers on top regardless of where the overlapping control sits in the page.

## [0.21.0] - 2026-11-14

- Name untitled tabs from their first code line (`autoTabTitles`, open on every plan),
  live, until the tab is explicitly renamed, which locks the name permanently.
- Add an `autoTitled` flag to each saved tab; existing saved tabs and the two example
  scratchpads keep their current names unaffected.
- Add tabTitle derivation, storage validation, and rename-locking coverage, bringing
  the suite to 211 tests.

## [0.20.1] - 2026-11-14

- Fix the header logo navigating to the landing page when clicked in the desktop app,
  which had no way back into the workbench. The logo is now inert there; the web app
  is unaffected.

## [0.20.0] - 2026-11-14

- Add a copy action to each output entry (`copyOutput`, open on every plan). Shown on
  hover or focus in both the list and Match-lines views, it copies the entry's exact
  text, even for an expandable value or a table, with a brief confirmation.
- Add a `rawText` field to each aligned row, holding its original per-entry text
  (newline-joined) separately from its summarized preview, so Copy never writes a
  truncated or merged preview.
- Add CopyButton, clipboard, and output-pane coverage, bringing the suite to 201 tests.

## [0.19.0] - 2026-11-14

- Add Ctrl+R (Run) and Ctrl+Shift+R (Stop) keyboard shortcuts (`runShortcuts`, open on
  every plan; Cmd on macOS), overriding the browser's own reload and hard-reload keys
  while the app has focus. The Run and Stop buttons show the shortcut in their tooltip.
- Fix the subscription-policy test missing two workbench features (`environmentVariables`,
  `runShortcuts`) from its all-plans access check, caught while adding this feature.
- Add shortcut-handling coverage, bringing the suite to 192 tests.

## [0.18.0] - 2026-11-14

- Add an Env vars panel (`environmentVariables`, open on every plan) in the header,
  where custom key/value pairs are added, edited, and removed. They persist on this
  device and are shared by every tab.
- Expose custom variables to executed code as `process.env.NAME` in both environments.
  In Node, variables are merged onto the real `process.env` of the disposable
  per-run process, so `process.versions` and other built-ins keep working. In the
  Browser page, which has no real `process`, a minimal `process.env` object is
  provided as a local function parameter, never touching any global.
- Validate variable keys (conventional identifiers) and bound their count, key
  length, value length, and total size in a shared module, reused by storage, the
  wire protocol, and both runtimes.
- Add validation, transport, and storage coverage, bringing the suite to 187 tests.

## [0.17.0] - 2026-11-14

- Draw `console.table` data as a real table (`consoleTable`, open on every plan): array,
  Map, Set, and plain-object data get a header row and a row-index column. Non-tabular
  data is logged normally.
- Build the table in a shared module used by the Browser page and the Node runner. Getters
  in cells are named, not invoked. Tables keep 50 rows and 12 data columns; long cells are
  shortened, and nested values are summarized.
- With Match lines, a table opens the same way any expandable value does, completing
  the console-output work started earlier.
- Add table-building, transport, and rendering coverage, bringing the suite to 171 tests.

## [0.16.1] - 2026-11-14

- Fail a Browser run when its code throws in a timer or event handler, or rejects a promise
  without `await` or `catch`. These previously passed silently and the run showed Finished.
- Report rejections caused by the last statements in both runtimes. Engines report them
  only after the code returns, so the page waits 25 ms and the Node runner one turn of the
  event loop before reporting success. Node previously missed this case.
- Give the Browser executor an options object in place of positional flags.
- Failures after a run has been reported, such as in a page kept in the Web view, are
  still not shown.
- Add background-failure coverage in both runtimes, bringing the suite to 157 tests.

## [0.16.0] - 2026-11-14

- Highlight the line where the latest run failed in the editor, with a gutter marker and
  the error message on hover. Part of `errorLocations`; web and desktop share it.
- The highlight follows its line while the draft is edited, is replaced by the next run,
  and is removed when the run succeeds or another tab is shown.
- Error text in the hover is escaped so it cannot render as Markdown or HTML.
- Add decoration coverage, bringing the suite to 152 tests.

## [0.15.0] - 2026-11-14

- Show where a failed run's error originated (`errorLocations`, open on every plan). With
  Match lines the message appears beside that line; the list view prefixes the line
  number. Errors that came through function calls get a collapsible call stack.
- Locate errors from the engine's stack using only the snippet's own frames, in the
  Browser page and the Node runner. The line offset of generated functions is measured
  per engine. Syntax errors use the parser's position, and TypeScript syntax errors
  carry their draft line.
- Map Node.js error lines back through the CommonJS compile step, so code with imports
  reports the right line.
- Move the source-map decoder from the editor package to the shared core package so the
  Node runner can use it.
- Add tracing, transport, and rendering coverage, bringing the suite to 149 tests.

## [0.14.0] - 2026-11-14

- Style console levels in the results pane (`consoleLevels`, open on every plan): warnings
  and errors are coloured and marked, info is marked, debug is dimmed, and screen readers
  hear "Warning" or "Error". A line-aligned row takes the most severe level of its entries.
- Send each entry's level through the Browser page, the Node runner, the HTTP stream, and
  Electron IPC; hosts treat unknown levels as plain logs.
- Build the console given to snippets in one shared module. `console.dir`, `assert`,
  `count`, `countReset`, `time`, `timeLog`, `timeEnd`, `trace`, `group`, `groupEnd`, and
  `clear` now work in both runtimes; calling them previously threw an error.
- `console.table` still prints its data as a value, and groups are not indented.
- Add console and level coverage, bringing the suite to 135 tests.

## [0.13.2] - 2026-11-14

- Make `pnpm package:desktop` build into a staging folder and swap it in at the end. If
  JSGoApp is open, the command stops with a clear message and leaves the existing app
  unchanged; previously it deleted the app folder in place, which could fail part-way.

## [0.13.1] - 2026-11-14

- Fix hover documentation, suggestions, and signature help being cut off at the top and
  sides of the editor, most visibly on the first lines. These popups are now positioned
  relative to the window and may extend past the editor, in the web and desktop apps.

## [0.13.0] - 2026-11-13

- Add `pnpm package:desktop`, which builds the workspace and assembles a runnable,
  unsigned desktop app folder for the current Windows or Linux machine in
  `release/JSGoApp-<platform>-<arch>/`. It needs no dev server, runner service, or network.
- Rerunning the command replaces the folder; drafts and settings persist in Electron's
  user-data folder.
- Installers, icons, signing, automatic updates, and macOS remain future work.

## [0.12.0] - 2026-11-13

- Enable the Web and Split result views in the Browser environment (`webView`, open on
  every plan). Web shows the page the code renders; Split shows it above the console.
  Node.js has no page, so the switch is hidden there.
- Keep the page live after its run while the Web view shows it, so rendered content,
  event handlers, and animation loops keep working until the next run, Stop, or a change
  of tab, environment, or view. Changing to or from a view with the page starts a fresh
  run when Auto run is on.
- Change the in-page loop limit from an absolute deadline to five seconds of uninterrupted
  work, so long-lived animations are not stopped while runaway loops still are.
- Wait for the new page to report its window size before running, so code that sizes a
  canvas from `window.innerWidth` works on its first line.
- Apply Match lines to the Console view only.
- Cover view selection, page keep-alive, and the per-task limit, bringing the suite to
  124 tests.

## [0.11.0] - 2026-11-13

- Run Browser code in a fresh, hidden, sandboxed page with a real `document` and
  `window` instead of a worker. Browser always uses the page; there is no execution
  mechanism selector. The page has a `#root` element and is removed after each run.
- Give the page an opaque origin (`sandbox="allow-scripts"`), so snippets cannot read
  the app's storage or DOM. Bundle its runner into one inline script at build time,
  because such a page cannot load module scripts from the app.
- Stop runaway loops from inside the page: every loop body now starts with a deadline
  check, since the page shares the app's thread and cannot be interrupted from outside.
  The app is unresponsive for up to five seconds while a tight loop runs.
- Offer DOM types in the editor for the Browser environment.
- Fix top-level comma expressions reporting their first value instead of their last.
- Web and Split stay disabled; showing the page is a separate change.
- Replace worker lifecycle tests with page lifecycle tests and add loop-guard coverage,
  bringing the suite to 119 tests.

## [0.10.0] - 2026-11-13

- Add expandable values in results (`objectInspection`, open on every plan): objects,
  arrays, Maps, Sets, class instances, and errors show a one-line preview that opens
  into a tree. List entries expand in place; a line-aligned row opens over the rows below.
- Build the trees in a shared inspector used by the browser worker and the Node runner.
  Values are captured when logged, getters are not invoked, cycles are marked, and
  depth, entry, and size limits report what was left out. Hosts validate trees again
  before they reach the UI. Runtimes inspect only when the request asks for it.
- Fix the Node snippet process sometimes exiting before queued output was delivered,
  which truncated large outputs. The process now stays alive until its host ends it.
- Raise the web Node transport's unparsed-buffer limit to fit inspected values.
- Add inspector, transport, and tree-rendering coverage, bringing the suite to 110 tests.

## [0.9.0] - 2026-11-13

- Add a workbench shared by the web and desktop apps. Each capability
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
- Execution architecture, startup instructions, and environment-selection notes
  in `docs/execution-environments.md`.

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

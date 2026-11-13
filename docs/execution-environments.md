<!-- Explains environment selection, shared Node execution, and the limits of the first desktop milestone. -->

# Browser and Node.js execution

The editor toolbar has one **Env** dropdown: Browser or Node.js. Language remains
JavaScript or TypeScript. Changing environment cancels active work and clears its
output without changing either language's draft. Environment selection is
session-only; drafts continue to persist locally.

In the Browser environment the results pane offers Web, Console, and Split. Node.js
has no page to show, so the switch is hidden there and the console is displayed.
The selected view lasts for the session and is kept while Node.js is selected.

## Browser page

Browser runs every snippet in a fresh, hidden, sandboxed page. There is no
separate worker mode and no mechanism selector: Browser always means a real
`document` and `window`, as in RunJS.

```text
App -> creates <iframe sandbox="allow-scripts" srcdoc=...> -> page posts "ready"
App -> posts { id, code, showUndefined, inspect, timeoutMs }
Page -> posts output messages, then completion -> App removes the page
```

- The page contains `<div id="root"></div>`, so UI libraries have a mount point.
  In the Console view it is laid out at 1024 by 768 off screen. In the Web and
  Split views it is created inside the Web view and fills it.
- `sandbox="allow-scripts"` gives the page an opaque origin. Snippets cannot
  read the app's local storage, cookies, or DOM, cannot navigate the app, and
  cannot open windows. `localStorage` inside the page throws, and `fetch` sends
  `Origin: null`, so only APIs that allow any origin respond.
- An opaque-origin page cannot load module scripts from the app. The runner
  (`apps/web/src/frame.ts`) is therefore bundled into one script by the
  `jsgoapp-frame-runner` plugin in `apps/web/vite.config.ts` and placed inline in
  the page. It loads on the first Browser run.
- Off screen, the page is removed when the run completes, fails, times out, or
  is stopped, which also ends its timers, listeners, and animation loops.
- Shown in the Web view, the page is kept after its top-level code finishes,
  even when that code threw, so what it rendered stays visible and its event
  handlers and animation loops keep working. It is removed by the next run,
  Stop, a change of tab, language, or environment, or leaving the Web view. A
  run ended by the host (time limit or Stop) never keeps its page. Console output
  produced after the top-level code finished is not shown.
- A page cannot move between containers without reloading. Entering or leaving
  a view that shows the page therefore ends the current page and, when Auto run
  is on, starts a fresh run in the new place.
- The runner waits (at most one second) until the new page reports a non-zero
  window size, so code such as `canvas.width = window.innerWidth` works on its
  first line.
- The app cannot rely on interrupting the page from outside: the browser decides
  whether a sandboxed page gets its own process, and where it does not, the page
  shares the app's thread. The expression transform adds a check at the start of
  every loop body. When code has run for more than five seconds without yielding
  to the event loop, the loop throws `Execution exceeded 5 seconds.` from inside
  the page. The clock restarts whenever the code yields, so timers and animation
  frames may run indefinitely. A host timer covers top-level code that never
  finishes, such as a promise that never settles. Long synchronous work without
  loops (for example deep recursion) is not interrupted by this check.
- The editor offers DOM types (`lib.dom.d.ts`) for Browser.

## RunJS reference

RunJS separates runtime selection from output layout. Its environment choice
changes runtime globals and editor types. It offers Browser, Node.js, and a
combined mode; JSGoApp currently implements only the first two. RunJS places
environment selection in its status bar; our owner requested the Env dropdown
in the editor toolbar.

- [RunJS interface](https://runjs.app/docs/introduction/user-interface)
- [RunJS runtime environments](https://runjs.app/docs/features/running-code)

Auto run now executes non-empty drafts after a two-second editing pause, once
the editor is ready. It works with both environments and both languages through
the shared UI. Every edit cancels active work and resets the deadline. The
checkbox switches to manual execution; Run bypasses the delay and Stop prevents
rescheduling until another edit or context change. Empty drafts clear output.
Errors and completed executions are not automatically retried.

Package installation and showing the Browser page remain separate capabilities.

## One runner, two transports

```text
Web UI → HTTP POST + streamed response → local runner service → Node child process
Desktop UI → preload IPC → Electron main → Node utility process
                                             ↓
                         shared runner entrypoint and execution protocol
```

`packages/runtime-node` owns request validation, per-run process lifecycle,
bounded output, cancellation, and a five-second execution deadline. Both hosts
use its same snippet entrypoint and output protocol. A fresh process is created
for every run and is terminated on completion, error, timeout, or cancellation.
Code never executes inside the HTTP server or Electron's main/UI process.

The local web service uses Node's `child_process.fork`. Electron uses
[`utilityProcess.fork`](https://www.electronjs.org/docs/latest/api/utility-process/),
which supplies Node from the Electron distribution; desktop users will not need
a separately installed Node runtime. The two hosts may report different Node
versions: the web service uses installed Node, and desktop uses Electron's Node.

## Web transport

Run sends JSON containing `id`, `environment`, and compiled `code` to
`POST /__runner/runs`. Vite proxies this development-only route to
`http://127.0.0.1:5180/runs`. The response streams newline-delimited JSON:

```json
{"type":"output","id":"run-id","line":"Hello"}
{"type":"complete","result":{"id":"run-id"}}
```

Output messages also carry `sourceLine`, the 1-based line of the executed code
that produced the entry (0 when unknown). The Browser page, the HTTP stream,
and Electron IPC all use this field, so line-aligned results behave the same in
every host. A request may set `showUndefined: true` to report undefined results.

An output message from `console.info`, `warn`, `error`, or `debug` carries `level`;
plain logs and expression results omit it. Hosts treat unknown levels as plain
logs. `packages/core/src/console.ts` builds the console given to snippets, so the
Browser page and the Node runner support the same methods.

When a run fails, its completion carries `errorLine` and `errorFrames` alongside
the message when the origin is known. `packages/core/src/errors.ts` reads the
engine's stack for frames of the snippet's own script (named through a
`sourceURL` comment), so the runner's frames are left out. Engines count the
header of a generated function differently, so the line offset is measured once
with a probe function, not assumed. Syntax errors use the parser's position.
The Node runner compiles module syntax to CommonJS before running, which moves
lines, so it maps frames back through that step's source map. All of these are
lines of the executed code; the UI translates them to draft lines the same way
it does for output. TypeScript syntax errors found by the editor carry their
draft line directly.

With `inspect: true` in the request, an output message whose arguments include an
object or collection also carries `values`: one bounded, JSON-serializable tree
per console argument (`type`, `text`, optional `entries` and `omitted`). `line`
is always present as the plain-text form. `packages/core/src/inspect.ts` builds
the trees inside the snippet process and validates them again in each host before
they reach the UI. A run may send about 400,000 characters of trees; after that,
entries carry text only.

The Node snippet process now stays alive until its host ends it. Previously it
could exit as soon as the snippet finished, before queued output was delivered,
which truncated large outputs.

Errors are reported in the completion result. Stop aborts the fetch connection;
the service disposes its process when that connection closes. Environment and
language changes do the same. The deadline is enforced by the runner host.
No WebSocket is necessary for this request/stream/cancel workflow. Interactive
terminal sessions may justify one in a future milestone.

The service binds to loopback, validates the Host and Origin, requires a custom
request header, grants no cross-origin permission, and limits source size and
concurrent runs. It is a local development transport, not the planned NestJS /
Fastify accounts API. That API can reuse the runner later without copying it.

## Execution scope

- JavaScript and TypeScript run in both environments. Monaco compiles TypeScript
  before execution; Node's runner additionally transforms module syntax to
  CommonJS. Its compiler API dependency is pinned to TypeScript 6 because the
  installed TypeScript 7 CLI package does not expose that legacy API.
- Node supports built-ins through `require` and ES import syntax, `process`,
  `Buffer`, and top-level `await`. npm/package and project-relative imports are
  deferred. Await asynchronous work explicitly; successful top-level completion
  disposes the process, including detached timers or servers.
- Console output is capped at 500 lines and bounded in size. Error output is
  bounded as well. This is console capture, not yet a full stdout/stderr terminal.
- Monaco uses browser-worker libraries for Browser and bundled Node declarations
  for Node.js. Declaration files load on demand and do not require a CDN. Node
  declarations target the supported Node 22 baseline; newer host-specific APIs
  may need an updated declaration set later.
- The UI does not silently fall back to Browser when Node is unavailable. It
  displays an error with the local runner start command.

These are **trusted local snippets**. Node built-ins can access local files and
network resources. Clearing the working directory or removing inherited secrets
does not create a security sandbox. The runner does not provide OS memory quotas
or containment of child processes launched by snippets. Do not deploy this local
service for untrusted public users; hosted execution will require an isolated
execution service. Hosting remains deferred.

## Desktop startup

For live development, use two terminals:

```sh
pnpm dev
pnpm dev:desktop
```

Electron loads the same Vite application with a sandboxed renderer,
`nodeIntegration: false`, `contextIsolation: true`, and a small preload API for
run, stop, and output subscription. Main validates IPC requests and only accepts
calls from its own top-level frame. Navigation and new-window creation are blocked.
It does not expose generic IPC or unrestricted Electron APIs to the UI.

Maintained desktop and runner files are TypeScript. `scripts/build-node.ts`
generates the runtime's ESM JavaScript, while `scripts/build-desktop.ts` generates
CommonJS JavaScript for Electron main and its sandboxed preload. Output is in
ignored `dist/` directories. Source extensions remain `.ts`; package metadata
sets the runtime module format. Desktop development builds these entries before
launching. `pnpm build` builds all workspace entries in dependency order.

Desktop opens `/playground` directly in development and from its built app
origin. Home and playground links work within that window; other navigation
remains blocked. The web app's root `/` is the landing page. When hosting is
revisited, its static host must serve `index.html` for the `/playground` route.

To exercise the built UI locally:

```sh
pnpm build
pnpm --filter @code-editor/desktop start
```

To check utility-process execution without opening the workbench:

```sh
pnpm --filter @code-editor/desktop smoke
```

For Node execution in the browser, start the helper alongside Vite:

```sh
pnpm dev:runner
```

The desktop app does not need this HTTP helper. Built assets use the standard
`jsgoapp://app` origin so module workers
and local storage work without disabling web security. The utility-process
smoke test also checks the deadline and built asset loading; run `pnpm build`
before invoking it.

## Local desktop package

```sh
pnpm package:desktop
```

This builds every workspace entry and assembles a runnable app folder for the
current machine in `release/JSGoApp-<platform>-<arch>/` (ignored by Git). Start
it with `JSGoApp.exe` on Windows or `jsgoapp` on Linux. It needs no dev server,
no local runner service, and no network connection: the UI is loaded from the
`jsgoapp://app` origin and Node.js snippets run in Electron's own Node.

`scripts/package-desktop.ts` copies the Electron runtime from
`apps/desktop/node_modules/electron/dist`, renames its executable, and adds
`resources/app` with the built main and preload scripts, the built web UI, the
Node runner, and the TypeScript compiler entry the runner loads. The folder
layout inside `resources/app` mirrors the repository so the main process finds
the UI at the same relative path.

To update the app, close it, pull or merge the new code, and run the command
again. The new app is built beside the old one and swapped in at the end. If the
app is still open, the command stops and leaves the existing app unchanged. Drafts and settings are kept because Electron
stores them in the user-data folder (`%APPDATA%\JSGoApp` on Windows,
`~/.config/JSGoApp` on Linux), not in the app folder. The packaged app keeps its
own drafts, separate from `pnpm dev:desktop` and from the web app.

This is an unsigned folder with the stock Electron icon, not an installer.
Windows may show a SmartScreen prompt if the folder is copied to another
machine. macOS is not supported by this script because it needs an app bundle.
Installers, icons, signing, and automatic updates remain future milestones;
macOS and Linux have not yet been verified.

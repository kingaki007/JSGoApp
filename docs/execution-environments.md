<!-- Explains environment selection, shared Node execution, and the limits of the first desktop milestone. -->

# Browser and Node.js execution

The editor toolbar has one **Env** dropdown: Browser or Node.js. Language remains
JavaScript or TypeScript. Changing environment cancels active work and clears its
output without changing either language's draft. Environment selection is
session-only; drafts continue to persist locally.

Web, Console, and Split remain visible in both environments. Web and Split are
disabled with a tooltip because DOM preview is parked in a separate draft PR.
Browser currently means browser-worker APIs and console output; it does not
promise access to `window` or `document`.

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

Expression-value inspection, package installation, and DOM rendering remain
separate capabilities.

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

This is an Electron development shell, not an installer release. Windows/macOS/Linux packaging, signing, and
updates remain future milestones; macOS and Linux have not yet been verified.

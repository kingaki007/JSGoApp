# JSGoApp

A JavaScript and TypeScript playground for web and desktop,
planned for Windows, macOS, and Linux.

## Status

Early development. The web app now includes a runnable Monaco editor
with JavaScript and TypeScript scratchpads. Each language retains its
draft while switching. Run executes the active scratchpad in a disposable
browser worker, with console output, Stop, and a five-second timeout.
TypeScript is compiled using Monaco's bundled TypeScript language worker.
Refreshing the page clears the drafts.

DOM previews, Node execution, npm imports, local saving, cloud accounts,
and desktop packaging are not connected yet. Await asynchronous work explicitly;
the worker ends when the top-level async function completes. Type annotations
are stripped before running; semantic type errors remain visible in Monaco
and do not block execution. ES module imports and exports are not supported yet.

This is a local scratchpad for code you trust. A Web Worker keeps code off the
UI thread and can be terminated, but it is not a security sandbox. A separate
execution origin and stricter isolation are required before running untrusted
shared projects or adding accounts.

Hosting and deployment decisions are deferred.

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

- apps/web: web editor and local Monaco language workers.
- packages/core: shared project types, runtime contracts,
  and feature policy.

Desktop and backend applications are planned but not scaffolded.

## Development requirements

- Node.js 22.14 or newer.
- pnpm 12.3.4.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173. Dependencies and editor workers are bundled
locally; Monaco does not load from a CDN.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Automated tests cover shared project validation, feature policy, output capture,
execution failures, output limits, timeout, and cancellation. Editor typing and
draft retention have also been checked in the browser.

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

Develop one small capability at a time and verify it before expanding.
Keep changes uncommitted until the owner requests a milestone commit
and push. Hosting decisions remain deferred.

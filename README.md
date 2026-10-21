# JSGoApp

A JavaScript and TypeScript playground for web and desktop,
planned for Windows, macOS, and Linux.

## Status

Early development. The repository contains a partial scaffold,
not a runnable application yet.

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

- apps/web: partial web editor scaffold.
- packages/core: shared project types, runtime contracts,
  and feature policy.

Desktop and backend applications are planned but not scaffolded.

## Development requirements

- Node.js 22.14 or newer.
- pnpm 12.3.4.

Dependencies and development commands have not yet been validated.

## Contribution workflow

Review and approve files individually before creating or
modifying them. Keep changes small and verify each milestone.

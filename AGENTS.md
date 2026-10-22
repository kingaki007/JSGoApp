<!-- Preserves the owner's repository conventions for future development sessions. -->

# Repository working agreements

- Build one small capability at a time. Do not expand the active feature without a clear reason.
- Keep changes uncommitted until the owner explicitly requests a commit and push.
- Before every new commit, update `CHANGELOG.md` and increment the synchronized root/app/package version.
  Use `pnpm version:next patch "Summary"` for fixes, tests, docs, and refactors;
  use `minor` for new capabilities and `major` for a deliberate major release.
  Expand the generated changelog bullet when the milestone needs more detail.
- Run `pnpm check` before committing. Add an annotated `v<version>` tag to each
  new versioned commit and push that exact tag along with the branch when authorized.
- Historical commits before this policy retain their original identities and versions.
- Start maintained source files with a short purpose comment. Document named
  functions, classes, methods, and parameters with concise intent-focused comments.
  JSON must remain valid; explain JSON configuration in the README instead.
- Use `.tsx` for React components and `.ts` for maintained non-React source,
  scripts, and configuration. Do not introduce `.cjs`, `.mjs`, `.cts`, or `.mts`
  source files. Electron and Node build outputs are generated `.js` files in
  ignored `dist/` directories; keep their module format explicit in package metadata.
- Keep tests in each app/package's `tests/` folder alongside `src/`.
- Use the shared design tokens and plain CSS. Keep Monaco integration in `packages/editor`.
- Hosting and deployment are deferred until the owner asks to revisit them.

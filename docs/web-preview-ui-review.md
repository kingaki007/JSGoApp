<!-- Records the owner's concerns and the decisions required before resuming the parked preview experiment. -->

# Web preview: parked UI review

Status: deferred on `parked/web-document-preview`. The draft PR preserves the
experiment for later discussion. It is not approved for merging or further
feature development.

## Owner feedback

- The current UI is confusing, and its intended behavior is not yet clear.
- The results pane always offers Web, Console, and Split in the browser
  environment, even when the selected worker runner cannot produce a Web page.
- The additional Worker script / Web document selector is unclear. It can be
  mistaken for the planned Node / Web environment selector.
- Park this functionality in a separate branch and PR; revisit it later.

## What the experimental controls actually mean

| Concept                     | Current implementation                                                            | Concern                                                                                |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Environment                 | Browser only; Node is not implemented                                             | The UI must not suggest that choosing Worker script selects Node.                      |
| Browser execution mechanism | Worker script executes without a DOM; Web document executes in a sandboxed iframe | These are internal execution choices whose product names and placement are unresolved. |
| Result view                 | Web, Console, or Split                                                            | Availability does not currently reflect whether the chosen mechanism produces a page.  |

Both experimental runners execute browser JavaScript after optional TypeScript
compilation. A Web Worker is not a Node.js runtime. The results controls change
what is visible; they do not select an environment or rerun source.

## Decisions to make before resuming

1. Define a clear environment model for Web and the future Node runtime.
2. Decide whether users need an explicit browser execution mechanism selector,
   or whether the application should choose the mechanism through another flow.
3. Decide when Web and Split are available and how an unavailable preview is
   communicated. Do not present a Web view as usable when the selected execution
   path cannot render a document.
4. Define the relationship between environment selection, Run, visible results,
   console output, preview reset, and language switching.
5. Review a small UI proposal with the owner before implementing a replacement.

These are open questions, not an approved redesign. Do not add Node execution,
frameworks, or npm support as part of resolving this UI discussion.

## Behavior and constraints preserved for later review

- The experiment supports DOM rendering for JavaScript and compiled TypeScript,
  interactive event handlers, bounded console output, and preview reset.
- Runs execute once in the selected mechanism. Switching result views retains
  the existing preview and output without rerunning source.
- The document frame lacks same-origin access; its CSP restricts resource loads.
  It is an early local experiment, not a complete untrusted-code execution service.
- The worker can be terminated reliably. Document execution cannot guarantee
  termination of synchronous infinite loops; its asynchronous deadline does not
  provide equivalent CPU isolation. Any future execution UX must account for this
  difference without making the environment labels misleading.
- The preceding main-branch UI already has Web/Console/Split controls and a Web
  placeholder. Returning to main removes this experiment's actual DOM runner
  and extra mechanism selector; it does not resolve the earlier results UI.

## Validation at parking time

The implementation passed formatting, type checks, 28 automated tests, and a
production build before parking. Manual browser checks covered TypeScript DOM
rendering, click-handler logs, Clear output, view switching, Reset preview,
blocked access to the host DOM, and the existing worker path. The existing
Monaco bundle-size warning remains unrelated follow-up work.

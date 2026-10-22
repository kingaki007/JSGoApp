<!-- Describes editable subscription policy and the future authenticated account boundary. -->

# Subscription features

Web and Electron share the configuration in `packages/core/src/features.ts`.
All current users are anonymous and receive **Max** by default. Login is not
required. This change provides feature gates, without adding billing or checkout.

| Feature name           | Display name                                | Free | Plus | Max |
| ---------------------- | ------------------------------------------- | ---- | ---- | --- |
| `definitionNavigation` | Built-in definition navigation              | Off  | Off  | On  |
| `autocomplete`         | Autocomplete                                | Off  | On   | On  |
| `hoverDocumentation`   | Function signatures and hover documentation | Off  | On   | On  |

## Changing access

- Change `featurePolicy.anonymousTier` to `free`, `plus`, or `max` to select the
  default visitor plan. It currently remains `max`.
- Add or remove feature names in `featurePolicy.plans.free`, `.plus`, and `.max`.
  Each list is independent; Max does not automatically inherit Plus's list.
- Set a feature's `enabled` value to `false` in `featureCatalog` to disable it for
  every plan. For example, `autocomplete: { label: 'Autocomplete', enabled: false }`.
- Set `featurePolicy.paywallEnabled` to `false` to grant every globally enabled
  feature to everyone. Global off switches still apply. Set it to `true` to
  enforce each plan's feature list; it is already true, with Max visitor access.

These are application configuration values, applied by rebuilding the shared
app. They are not browser-local subscription settings. During development, Vite
reloads configuration changes.

To introduce another capability, add its stable key and label to `featureCatalog`,
add that name to the desired plan lists, and connect its resolved flag to the
implementation. The `Feature` type is derived from the catalog; invalid names in
plan lists fail type checking. Existing features move between plans by name only.

## Future user data

`UserProfile`, `UserSubscription`, and `AccessSubject` in the same module provide
the account contract. The playground accepts an optional `subject` prop. Until
authentication exists it uses `anonymousSubject`; a future session provider can
pass an authenticated account:

```tsx
<Playground
  subject={{
    kind: 'authenticated',
    user: {
      id: 'account-id-from-api',
      email: 'person@example.com',
      displayName: 'Person',
      subscription: {
        tier: 'plus',
        status: 'active',
        expiresAt: '2026-12-01T00:00:00Z',
      },
    },
  }}
/>
```

The API owns the user ID and subscription. `expiresAt` is an ISO 8601 timestamp,
or `null` for a grant without expiry. Active and trialing subscriptions grant
their plan until expiry; missing, inactive, invalid, or expired subscriptions
resolve to Free. Authenticated accounts never inherit the anonymous Max default.
For a canceled subscription that remains paid through a period end, the future
billing adapter should return active access until that timestamp.

No passwords or billing secrets belong in this profile, and subscription grants
are not stored in editable local storage. The future session provider must refresh
the subject on login, logout, subscription changes, and expiry. Access is resolved
from the current subject whenever the playground renders.

The same resolver is usable by a future backend, which must obtain subscription
data from its trusted store and authorize protected API operations there. Browser
and desktop feature gates control product behavior; client code alone cannot
secure a paid service against a modified client.

## Editor behavior

Gates apply to JavaScript and TypeScript in Browser and Node environments.
Restricted features disable Monaco's language providers, including manual
commands such as F12 and Ctrl+Space. Autocomplete also disables word and snippet
fallbacks. Hover access controls documentation and signature/parameter hints.
Definition access controls Go to Definition, Peek Definition, and modifier-click
navigation. An access change closes restricted widgets already open in the editor.

Editing, execution, syntax diagnostics, compilation, and draft storage continue
to work on every tier. The current app has one account per Monaco instance;
provider configuration is shared by editors in that instance.

Monaco 0.57 does not dynamically re-register its providers when mode defaults
change. The editor reserves the four gated built-in providers during setup,
then owns their disposable registrations. This reuses Monaco's adapters through
its pinned `languages/features/typescript/tsMode.js` entry point; the small
`monacoAdapters.d.ts` declaration documents that integration. This adapter entry
point is internal to Monaco, so verify its exports and rerun the tier and editor
checks when upgrading Monaco. Compiler settings and diagnostics remain separate.

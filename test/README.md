# Tests

Three suites, all run against local emulators (no cloud project is touched). Java 21+ is required by the Firestore emulator.

```sh
npm run test:rules      # test/rules.test.mjs
npm run test:unfriend   # test/unfriend.test.mjs
npm run test:delete     # test/delete-account.test.mjs
```

| Suite | Emulators | Covers |
|---|---|---|
| `rules.test.mjs` | Firestore | `firestore.rules`: who can create / read / update / delete shares (one recipient, expiry cap, note edits, nudges, revoke), chat, friends, trust, spots, contacts (users can't write their own email), nicknames, push tokens |
| `delete-account.test.mjs` | Auth, Firestore, Functions, Storage | calls the real `deleteAccount` callable with an emulator ID token and checks the sign-in account, profile, phone / email, spot, push token, notifications, nicknames, avatar, friendships, trust, every share (owned / received / asked) with chat and photos, and notifications about the user in other inboxes are gone, while other people's data stays |
| `unfriend.test.mjs` | Firestore, Functions, Storage | unfriending removes the trust, both nicknames, every share between the two people with its chat and photos, and the related notifications, while unrelated data stays; declining a *pending* request keeps shared history |

The rules tests use `assertSucceeds` / `assertFails`: **when you change a rule, add a case for both the allowed and the
denied path.** The emulator prints `PERMISSION_DENIED` lines for the denied cases; that is expected. A run ends with
`all N passed`.

Type checking and translations are separate: `npm run typecheck`, `npm run check:i18n`. `npm test` runs everything.

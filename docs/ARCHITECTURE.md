# Architecture

How the app is put together, the conventions every change should follow, and the data and security model.

## Layers

```
app/  (routes)  →  features/*  →  lib/*
components/  (shared UI)  ←  used by app/ and features/
```

- **`src/app`**: expo-router routes only. A screen wires hooks to components; it holds no Firestore code.
- **`src/features/<area>`**: one folder per area (`account`, `directions`, `inbox`, `parking`, `sharing`, `social`). Hooks that read (`useShare`, `useFriends`…) and functions that write live here. Features may import each other's public functions but not each other's internals.
- **`src/lib`**: infrastructure with no knowledge of features (`firebase`, `i18n`, `live`, `feedback`, `errors`, `time`, `geo`, `image`, `theme`). `lib/` imports no feature.
- **`src/components`**: UI shared by several screens. If a pattern shows up a second time, it becomes a component here.
- **`src/widgets`**: the iOS widget and Live Activity. They run in an isolated JS runtime and only receive props: no module-scope constants, no imports of app state.

## Conventions

### One shared listener per query (`lib/live.ts`)
Every Firestore listener goes through `useLive(key, subscribe, initial)`. Components that ask for the same key share one
listener (started by the first subscriber, stopped 5 s after the last). `refresh()` powers pull-to-refresh; `restartLive(key)`
re-reads after a write that must show up at once.

### Talking back to the person (`lib/feedback.tsx`)
Nothing calls `Alert` or builds its own toast. Use:

| Helper | For |
|---|---|
| `confirm({ title, message, action, destructive?, onConfirm })` | asking before something that can't be undone |
| `perform(work, done?, overlay?)` | run an action: busy overlay while it runs, `showDone(done)` on success, `showError` on failure. Resolves to whether it worked |
| `showDone(text)` | a top-of-screen confirmation with a check mark. Use it when the result isn't obvious on screen (a share was sent, a time changed, a friend was removed) |
| `showError(e)` | something failed; `errors.ts` maps Firebase codes to friendly translated text |
| `trackBusy(promise)` | the "working…" overlay for a slow action that starts from an alert or menu |

`Button`, `CircleButton`, `ActionButton` and `Pill` show their own spinner and ignore taps while `onPress` returns a pending
promise. Pass `overlay = false` to `perform` there so the two spinners don't stack.

### Loading states
First loads use `Skeleton`, screens with nothing yet use `Loading`, inline waits use the button spinner, everything else
slow uses `trackBusy`. No screen should ever render an empty page or a wrong state (for example "no car" or "Add friend")
while data is still loading: check the `loading` flag from `useLive`.

### Shared components
`Screen` (safe area, header, scroll, footer), `Sheet` (bottom sheet), `PersonRow` / `UserAvatar` (anyone's row and avatar),
`Pill` (status badge or small button), `SignInPrompt` (what a guest sees), `ImageViewer` (full-screen, zoomable photo),
`Loading`, `Skeleton`, `ErrorNote`, `Button`, `Chip`. Add to these instead of re-styling in a screen.

### Translations
Text goes through `t()`. `vi.json` and `en.json` must define the same keys and every `{{placeholder}}` must be passed:
`npm run check:i18n` enforces it. iOS permission texts live in `locales/ios-*.json`.

### Retention
Every piece of server data has an expiry (see the README table). The client twins are in `src/config.ts`, the server
twins at the top of `functions/index.js`: change both.

## Data model (Firestore)

| Collection | Holds | Who reads |
|---|---|---|
| `profiles/{uid}` | name, avatar URL, optional gender / about | any signed-in user |
| `contacts/{uid}` | phone (written by the user) and email (copied by a Cloud Function) | the user and their friends |
| `friends/{a_b}` | members, requester, status (`pending` / `accepted`) | the two members |
| `trusts/{a_b}` | same, for "see each other's car" | the two members |
| `spots/{uid}` | the published current parking (thumbnail + position) | people who trust the owner |
| `shares/{id}` | one share: owner, optional recipient / invitee, status, expiry, note, place, position, timeline | see below |
| `shares/{id}/messages/{mid}` | chat messages (text and / or photo path) | the owner and the recipient |
| `users/{uid}` | push token, language, last contacts-sync time | the user only |
| `users/{uid}/notifications/{id}` | in-app notifications (created by Cloud Functions) | the user only |
| `users/{uid}/aliases/{other}` | the user's private nickname for someone | the user only |

**Share lifecycle.** `open` → `accepted` → `pickedUp`, or `declined` / `closed` (owner took the car) / `revoked` (owner
stopped sharing). A link works for **one person**: accepting needs `status == 'open'` and no recipient yet, and once
accepted only the owner and that recipient can read it. A share to a friend (`invitee`) can only be read and accepted by
that friend; `pickup: true` marks a "please pick my car up" request. The timeline (`timeline`, `endedAt`, `deleteAt`) is
written **only by Cloud Functions**: rules forbid clients from setting it.

**Storage.** `avatars/{uid}.jpg`, `shares/{id}/photo.jpg`, `shares/{id}/msgs/*.jpg`. Deleted with their share.

## Security model

- The Firebase web config in the app is an identifier, not a secret. **Access control is `firestore.rules` and `storage.rules`.** Both are covered by tests (`test/rules.test.mjs`); change a rule, add a test.
- Anything that must not be forged (timeline, emails, notifications, matching, deletion) is written by **Cloud Functions** with the Admin SDK.
- Callables (`findUser`, `matchContacts`, `unfriend`, `deleteAccount`) require sign-in. `findUser` and `matchContacts` return only public profile data, and `matchContacts` is throttled and stores nothing.
- Users can't be listed: finding someone needs their exact email or phone number.
- Personal data is minimal and expires (see the README).
- Deleting an account is done by the `deleteAccount` callable (Admin SDK), not by the client, so it works for every sign-in method and needs no recent login. `test/delete-account.test.mjs` checks it removes everything.

## Adding things

- **A screen:** a route in `src/app`, data through a feature hook, UI from `components/`, text through `t()`, feedback through `lib/feedback.tsx`.
- **A collection:** rules + a rules test, an entry in the table above, its retention, and cleanup in `deleteAccount` (and `wipePair` if it links two people).
- **A native module or plugin:** needs a new development build (`npx expo run:ios --device`).

# My Parking

Snap a photo of where you parked. The photo, the nearest place name and your position show up on the **home-screen
widget**, the **lock screen** and the **Dynamic Island**, with the distance back to the car. Share the spot with someone
you trust, chat with them, or ask a friend to pick your car up.

iOS first (Android builds, but the widget and Live Activity are iOS only). Vietnamese and English.

- **Stack:** Expo SDK 57 · expo-router · React 19 + React Compiler · Firebase (Auth, Firestore, Storage, Functions, Hosting) · `expo-widgets` · i18next
- **Needs a development build.** Expo Go can't run widgets, Google / Apple sign-in or the background location task.
- **Open source, free-tier friendly.** Almost every piece of data expires on its own (see [Data retention](#data-retention)).

## Features

| | |
|---|---|
| **Park** | Camera shot + GPS + nearest place name (Apple geocoder) + a short note. Forgotten after 7 days unless you tap "still parked". |
| **Surfaces** | Home-screen widget (small / medium / lock-screen), lock-screen Live Activity, Dynamic Island. Distance updates in the background while a car is parked. |
| **Share** | A link that works for **one person**, or send it straight to a friend. 1 hour, up to 12 hours, or "until the car is gone". Countdown, change the time, nudge, or stop sharing at any time. Notes stay in sync. |
| **Chat** | One conversation per share, with photos, an event timeline (shared → accepted → picked up), and a "here it is" photo when the car is picked up. |
| **Pick-up request** | Ask a friend to fetch your car. They get a notification and must agree. |
| **Friends** | Find people by exact email or phone, invite link, or **contacts sync** (matched on the server, nothing stored). Private nicknames. |
| **Trust** | Trusted friends see each other's current parking and get a notification when the other parks. |
| **History** | The last 30 days of parkings (on the phone), photos for 3 days. |
| **Account** | Google / Apple sign-in, profile, **in-app account deletion**, Privacy Policy and Terms. |

## Quick start

Prerequisites: macOS with Xcode (iOS), Node 22, a Firebase project, an Apple Developer account for device builds.

```sh
git clone <your-fork-url> my-parking && cd my-parking
npm install

cp .env.example .env                       # fill it in (see "Configuration")
# Firebase native config files (git-ignored, see "Firebase setup"):
#   GoogleService-Info.plist   google-services.json

npx expo run:ios --device                  # first run / after any native change (new module, plugin, widget list)
npx expo start --dev-client                # JS-only changes afterwards
```

`GoogleService-Info.plist.example` and `google-services.json.example` show the shape of the files you have to download.

## Configuration

Nothing secret lives in this repository.

| What | Where | Committed? |
|---|---|---|
| Firebase web config, Google web client ID, public site URL | `.env` (`EXPO_PUBLIC_*`, see `.env.example`) | No |
| Firebase native config | `GoogleService-Info.plist`, `google-services.json` | No |
| App identity (bundle id, team id, EAS project, associated domains) | `app.json` | Yes (public information) |
| Site contact, operator name, store links | `web/site.js` (`CONFIG`) | Yes |
| Firebase project | `.firebaserc` | Yes |

`EXPO_PUBLIC_*` values are compiled into the app and are public by design: the Firebase web config is an identifier, and
access is enforced by `firestore.rules` and `storage.rules`. Still, restrict the API key to your bundle ids in
Google Cloud console → APIs & Services → Credentials.

Real secrets (APNs key, signing certificates, service accounts) belong in EAS credentials or your password manager,
never in the repo. `.gitignore` blocks the usual suspects; run `git status` before committing anyway.

## Firebase setup

1. Create a Firebase project. Enable **Google** and **Apple** sign-in, **Firestore** (Standard, a region close to your users, this project uses `asia-southeast1`) and **Storage**. Upgrade to **Blaze** (Cloud Functions need it; a small app stays inside the free quota).
2. Register an iOS app (your bundle id) and download `GoogleService-Info.plist`, then an Android app for `google-services.json`. Add a **Web app** and copy its config into `.env`.
3. Put the Google **web client ID** (Authentication → Google → Web SDK configuration) in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Point the CLI at your project: edit `.firebaserc`, then **always pass `--project`** so a stale active project can't be deployed to by mistake:

   ```sh
   npm i -g firebase-tools && firebase login
   firebase deploy --project <your-project-id>                       # rules, indexes, functions, hosting
   firebase deploy --project <your-project-id> --only firestore:rules  # or one part at a time
   ```
5. **Push notifications:** create an APNs key and add it with `eas credentials -p ios` (pushes go through Expo's push service).
6. **Custom domain (needed for universal links):** Firebase Hosting → add your domain, then a CNAME (DNS only, no proxy) to `<project>.web.app`. Set `EXPO_PUBLIC_SITE_URL`, `associatedDomains` in `app.json`, and the team + bundle id in `web/.well-known/apple-app-site-association`.

## Architecture in one page

```
src/
  app/               routes only (expo-router): thin screens, no Firestore code
  components/        shared UI: Screen, Header, Sheet, PersonRow / UserAvatar, Pill, SignInPrompt, ui.tsx (Button, Loading, Skeleton…)
  features/
    account/         auth (Google / Apple), delete account, phone numbers
    directions/      choose + open the maps app
    inbox/           in-app notifications, push token, local reminders
    parking/         the active parking: model, store, spot lifecycle, history, place lookup, widget / Live Activity, tracking, share
    sharing/         shares + chat, timeline, duration sheet, active-shares card
    social/          friends, trust, published spots, contacts sync, nicknames
  lib/               infrastructure: firebase, i18n, live (shared listeners), feedback, errors, time, geo, image, theme
  widgets/           the iOS widget + Live Activity (they only receive props)
  locales/           vi.json, en.json (+ ios-*.json for the OS permission texts)
functions/           Cloud Functions (Node 22): pushes, share timeline, friends, contacts matching, cleanup, account deletion
web/                 public site (Firebase Hosting): landing, share / invite pages, Privacy, Terms, universal-link file
test/                Firestore rules tests + an emulator test for the unfriend cleanup
scripts/             check-i18n.mjs
docs/                ARCHITECTURE.md (conventions, data model, security model)
```

Rules of thumb (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- `lib/` imports no feature; screens hold no Firestore code.
- Every Firestore listener goes through `lib/live.ts` (one shared listener per query).
- User-facing text always goes through `t()`. Talking back to the person always goes through `lib/feedback.tsx`
  (`confirm`, `perform`, `showDone`, `showError`, `trackBusy`), never `Alert` or a hand-made toast.
- Repeated UI belongs in `components/` (`PersonRow`, `Pill`, `Sheet`, `SignInPrompt`, `Loading`…).

## Data retention

This is an open-source app on a free-tier backend, so nearly all data expires on its own.

| Data | Kept for | Enforced in |
|---|---|---|
| Active parking | 7 days unless renewed ("still parked", needs an account) | `src/config.ts` |
| History record | 30 days, at most 100 (on the phone; none for guests) | `src/config.ts` |
| History photo | 3 days after pickup | `src/config.ts` |
| In-app notifications | 14 days | `functions/index.js`, `src/config.ts` |
| Share (link or to a friend) | at most 12 hours, or "until the car is gone" (`SHARE_MAX_HOURS`) | `src/config.ts`, `firestore.rules` |
| Share location | removed 1 hour after the share window ends | `functions/index.js` |
| Share + chat photos | 3 days after the window ends | `functions/index.js` |
| Share + chat text | 30 days after the window ends | `functions/index.js` |
| Published spot (trusted friends) | until pickup / expiry | rules + `functions/index.js` |
| Contacts used for friend matching | never stored | `matchContacts` in `functions/index.js` |

What stays: your public profile (name, avatar, optional gender / about), your phone number and email (visible to friends
only) and friendships. The numbers live in two places on purpose (client + Functions): keep them in sync. Unfriending or
deleting your account removes everything tied to it (shares with their photos and chats, notifications, nicknames…).
If you add a collection that holds user data, delete it in `deleteAccount` and `wipePair` too.

## Scripts and checks

```sh
npm run typecheck        # tsc --noEmit
npm run check:i18n       # keys exist in vi + en, {{placeholders}} are passed, lists hard-coded UI text
npm run test:rules       # Firestore rules (emulator, needs JDK 21+)
npm run test:unfriend    # unfriend cleanup end to end (Firestore + Functions + Storage emulators)
npm run test:delete      # account deletion end to end, including the sign-in account (Auth + the others)
npm test                 # all of the above
```

CI runs the same commands (`.github/workflows/ci.yml`). See [test/README.md](test/README.md).

## Releasing

```sh
npm i -g eas-cli && eas login
eas build -p ios --profile production      # store build (the build number auto-increments)
eas submit -p ios --profile production
```

The git-ignored files EAS can't see must be provided as EAS secrets: upload the two Firebase native files as **file
secrets** exposed as `GOOGLE_SERVICES_PLIST` / `GOOGLE_SERVICES_JSON` (read by `app.config.ts`), and add every
`EXPO_PUBLIC_*` value from `.env` as an EAS environment variable (see the EAS docs on environment variables).

Before submitting to the App Store:

- Fill `CONFIG.appStoreUrl` / `playUrl` in `web/site.js`, deploy hosting, and have the Privacy Policy and Terms (`web/privacy.html`, `web/terms.html`) reviewed by someone qualified. They describe the app as built; keep them in step with any data-handling change.
- Declare the data types in App Store Connect to match the Privacy Policy (contacts are read only on request and not stored).
- Account deletion is in the app (Account → Delete account), as guideline 5.1.1(v) requires. It removes all server data and the sign-in account for Google and Apple users alike. For Sign in with Apple it also tries to revoke Apple's token; that needs the Apple key configured in Firebase console → Authentication → Sign-in method → Apple → OAuth code flow. Without it the account is still deleted, only the revocation is skipped.

## Forking checklist

Change these to make it yours: `app.json` (`name`, `slug`, `bundleIdentifier`, `package`, `appleTeamId`, `owner`,
`extra.eas.projectId`, `associatedDomains`), `.firebaserc`, `.env`, `web/site.js` (`CONFIG`), the operator and contact in
`web/privacy.html` / `web/terms.html`, and the team + bundle id in `web/.well-known/apple-app-site-association`. Replace
`assets/` (icon, splash) with your own artwork.

## Contributing

Issues and pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).
Expo SDK 57 differs from older versions: check https://docs.expo.dev/versions/v57.0.0/ before writing native-facing code.

## License

[MIT](LICENSE)

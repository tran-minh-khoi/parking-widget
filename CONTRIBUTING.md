# Contributing

Thanks for helping. Small, focused pull requests are easiest to review.

## Setup

Follow **Quick start** in the [README](README.md). You need your own Firebase project for anything that touches the
backend; for rules and functions work the emulators are enough (`npm test`).

## Before you open a pull request

```sh
npm test    # typecheck, translations, Firestore rules, unfriend cleanup
```

- New or changed **Firestore rules** need a test for the allowed and the denied case (`test/rules.test.mjs`).
- New user-facing text goes through `t()` and exists in both `vi.json` and `en.json`.
- Reuse the shared components (`PersonRow`, `Pill`, `Sheet`, `SignInPrompt`, `Loading`…) and the feedback helpers in
  `lib/feedback.tsx`; don't call `Alert` or build your own toast. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Every listener goes through `lib/live.ts`; screens don't contain Firestore code.
- Keep data small and short-lived: anything new that is stored server-side needs a retention rule and cleanup (also in
  `deleteAccount`).
- Don't commit secrets or per-project files (`.env`, `GoogleService-Info.plist`, `google-services.json`, keys).
- Expo SDK 57 differs from older versions; check the [v57 docs](https://docs.expo.dev/versions/v57.0.0/) for native APIs.

## Commit and PR style

One logical change per commit, a short imperative subject ("Add nudge button"), and a PR description that says what
changed and how you checked it (screenshots for UI changes).

## Reporting bugs

Open an issue with the steps, what you expected, what happened, the iOS version and the app build. Never include personal
data or tokens. For security problems see [SECURITY.md](SECURITY.md).

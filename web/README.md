# Public site

Static files served by Firebase Hosting (`hosting.public` in `firebase.json`). No build step.

| File | What |
|---|---|
| `index.html` | one page for the landing page `/`, a shared spot `/s/<id>` and a friend invite `/u/<id>` (Firebase rewrites `/s/**` and `/u/**` here). It reads the share over the Firestore REST API. |
| `privacy.html`, `terms.html` | Privacy Policy and Terms of Use (Vietnamese and English). |
| `site.js` | language toggle, header / footer, store buttons. **`CONFIG`** at the top holds the operator name, contact email and store links. |
| `site.css` | the black-and-gold theme. |
| `.well-known/apple-app-site-association` | universal links: `/s/*` and `/u/*` open the app. |
| `icon.png`, `favicon.png` | icons |

## Configure

- **Store links:** set `appStoreUrl` and `playUrl` in `site.js` (empty shows "Coming soon").
- **Operator and contact:** `CONFIG.operator` / `CONFIG.contact` in `site.js`, and the same details in the two legal pages.
- **Universal links:** put `<TeamID>.<bundle id>` in `.well-known/apple-app-site-association` and the domain in `associatedDomains` in `app.json`.
- **Firebase project:** the share page reads the share through the Firestore REST API of `CONFIG.firebaseProject` in `site.js`. Set it for a fork.

## Legal pages

They describe what the app actually does (data collected, retention, sharing, contacts sync, account deletion). They are
written in good faith but are **not legal advice**: have them reviewed before publishing an app, and keep them in step with
any change to data handling.

## Deploy

```sh
firebase deploy --project <your-project-id> --only hosting
```

Check `https://<your-domain>/.well-known/apple-app-site-association` returns JSON, and that `/privacy` and `/terms` load.

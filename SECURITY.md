# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Email the maintainer at the contact address listed on the
project's website (see `web/site.js`, `CONFIG.contact`) with:

- what you found and where (file, rule, function or screen),
- steps to reproduce,
- the impact you think it has.

You will get an acknowledgement within a few days. Please give reasonable time to fix the problem before disclosing it.

## What is in scope

- `firestore.rules` and `storage.rules`: reading or changing data that isn't yours, forging server-written fields (timeline, emails, notifications), sharing links that work for more than one person.
- Cloud Functions callables (`findUser`, `matchContacts`, `unfriend`, `deleteAccount`): bypassing sign-in, listing users, abusing throttles, deleting other people's data.
- The public site (`web/`): injection, leaking share data after a link was accepted.
- Anything that stores personal data for longer than the retention table in the README says.

## Notes for people running their own copy

- The Firebase web config in the app is public by design. Restrict the API key to your bundle ids and keep the rules tight.
- Never commit `.env`, `GoogleService-Info.plist`, `google-services.json`, service-account files, APNs keys or signing certificates.
- Deploy with an explicit `--project` so you never publish rules or functions to the wrong Firebase project.

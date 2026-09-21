# Cloud Functions

Node 22, `firebase-functions` v2, region `asia-southeast1` (keep it next to the Firestore database).
All the code is in `index.js`.

## What is here

| Function | Trigger | Does |
|---|---|---|
| `onShareCreated` | share created | stamps the timeline and `deleteAt`; pushes the invited friend |
| `onShareUpdated` | share updated | timeline entries, `endedAt` / `deleteAt`, pushes for accepted / picked up / closed / revoked / declined, note changes and nudges |
| `onMessageCreated` | chat message | pushes the other person |
| `onShareDeleted` | share deleted | removes its photos, chat and notifications (`wipeShare`) |
| `onFriendCreated` / `onFriendUpdated` | friend request / accepted | notifications |
| `unfriend` | callable | unfriend: wipes everything between the two people (`wipePair`) |
| `onFriendDeleted` | friend deleted | safety net that runs `wipePair` for an accepted friendship |
| `onTrustCreated` / `onTrustUpdated` | trust request / accepted | notifications |
| `onSpotWritten` | published spot | tells everyone who trusts the owner that they parked |
| `onProfileWritten` | profile written | copies the sign-in email into `contacts/{uid}` so friends can see it |
| `findUser` | callable | find a person by exact email or phone; returns the public profile only |
| `matchContacts` | callable | which of the caller's contacts use the app; throttled, stores nothing |
| `deleteAccount` | callable | deletes everything about the caller, then the account |
| `cleanupExpired` | every 60 min | deletes expired shares, old notifications and expired spots |

Pushes go through Expo's push service (`https://exp.host/--/api/v2/push/send`) using the token in `users/{uid}`.
Copy for each push is in the `T` table (Vietnamese and English), chosen by the user's stored language.

## Retention constants

`NOTIFICATIONS_KEEP`, `SHARE_PHOTOS_KEEP`, `SHARE_CONVERSATION_KEEP`… at the top of `index.js` are the server twins of
`src/config.ts`. Change both together.

## Develop and test

```sh
cd functions && npm install
node --check index.js                                  # syntax check (also run by CI)
npm --prefix .. run test:unfriend                      # emulator test for the unfriend cleanup
npm --prefix .. run test:delete                        # emulator test for account deletion
```

The emulator run starts Firestore, Functions and Storage from the repository's `firebase.json`. It needs JDK 21+.

## Deploy

```sh
firebase deploy --project <your-project-id> --only functions
```

Always pass `--project`. On a small project a deploy can fail with "Quota exceeded for total allowable CPU": wait a
minute and run it again (already updated functions are skipped).

## Notes

- New Firestore triggers can take a few minutes after the first deploy before events reach them.
- A new callable is public at the network level but checks `req.auth` itself; if a client sees `unauthenticated` right after a deploy, the function may not be public yet: retry in a moment.
- Deleting things: use `db.recursiveDelete(ref)` for a document with subcollections, and `wipeShare(ref)` for a share (it also removes storage files and notifications in everyone's inbox).

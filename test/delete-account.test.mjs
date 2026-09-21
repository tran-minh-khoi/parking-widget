// Deleting an account removes everything about it, for any sign-in method. Run with the Auth + Firestore + Functions +
// Storage emulators (it calls the real callable over HTTP with a real emulator ID token):
//   firebase emulators:exec --only auth,firestore,functions,storage --project demo-parking "node test/delete-account.test.mjs"
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

initializeApp({ projectId: 'demo-parking', storageBucket: 'demo-parking.appspot.com' });
const db = getFirestore();
const bucket = getStorage().bucket();
const later = Timestamp.fromMillis(Date.now() + 3600e3);
const gone = async (path) => !(await db.doc(path).get()).exists;
const fileGone = async (path) => !(await bucket.file(path).exists())[0];
const check = async (name, cond) => {
  if (!(await cond())) throw new Error(`FAILED: ${name}`);
  console.log('ok', name);
};

// The emulator's sign-up endpoint gives a real ID token, the same shape the app sends.
const signUp = async (email) => {
  const res = await fetch('http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  });
  const { localId, idToken } = await res.json();
  return { uid: localId, idToken };
};
const me = await signUp('me@example.com');
const friend = await signUp('friend@example.com');
const other = await signUp('other@example.com');
const [a, b, c] = [me.uid, friend.uid, other.uid];

// what belongs to me
await db.doc(`profiles/${a}`).set({ name: 'Me' });
await db.doc(`contacts/${a}`).set({ phone: '+84900000001', email: 'me@example.com' });
await db.doc(`spots/${a}`).set({ lat: 1, lng: 2, expiresAt: later });
await db.doc(`users/${a}`).set({ expoPushToken: 'ExponentPushToken[me]' });
await db.doc(`users/${a}/notifications/n1`).set({ type: 'friend', refUid: b });
await db.doc(`users/${a}/aliases/${b}`).set({ name: 'Buddy' });
await bucket.file(`avatars/${a}.jpg`).save('x');
// friendship and trust with b, and a pending request from c
await db.doc(`friends/${[a, b].sort().join('_')}`).set({ members: [a, b].sort(), requester: a, status: 'accepted' });
await db.doc(`trusts/${[a, b].sort().join('_')}`).set({ members: [a, b].sort(), requester: a, status: 'accepted' });
await db.doc(`friends/${[a, c].sort().join('_')}`).set({ members: [a, c].sort(), requester: c, status: 'pending' });
await db.doc(`users/${b}/aliases/${a}`).set({ name: 'Me (nick)' });
// shares: I own one, I received one, a friend asked me to pick a car up
const share = (id, data) => db.doc(`shares/${id}`).set({ status: 'accepted', expiresAt: later, ...data });
await share('mine', { ownerId: a, recipientId: b });
await share('received', { ownerId: b, recipientId: a });
await share('asked', { ownerId: b, invitee: a, status: 'open' });
await db.doc('shares/mine/messages/m1').set({ uid: a, text: 'hi' });
await bucket.file('shares/mine/photo.jpg').save('x');
await bucket.file('shares/received/msgs/1.jpg').save('x');
// notifications about me in b's inbox
await db.doc(`users/${b}/notifications/about-me`).set({ type: 'friend', refUid: a });
await db.doc(`users/${b}/notifications/about-share`).set({ type: 'share', shareId: 'mine' });
// someone else's data that must survive
await db.doc(`profiles/${b}`).set({ name: 'Friend' });
await db.doc(`profiles/${c}`).set({ name: 'Other' });
await share('bystander', { ownerId: b, recipientId: c });
await bucket.file('shares/bystander/photo.jpg').save('keep');
await db.doc(`users/${b}/notifications/unrelated`).set({ type: 'friend', refUid: c });

// call the real callable like the app does
const res = await fetch('http://localhost:5001/demo-parking/asia-southeast1/deleteAccount', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.idToken}` },
  body: JSON.stringify({ data: {} }),
});
const body = await res.json();
if (!res.ok) throw new Error(`FAILED: deleteAccount answered ${res.status} ${JSON.stringify(body)}`);
console.log('ok deleteAccount answered', res.status);

await check('sign-in account deleted', async () => getAuth().getUser(a).then(() => false, () => true));
await check('profile, phone / email, published spot deleted', async () => (await gone(`profiles/${a}`)) && (await gone(`contacts/${a}`)) && (await gone(`spots/${a}`)));
await check('push token, notifications and nicknames deleted', async () => (await gone(`users/${a}`)) && (await gone(`users/${a}/notifications/n1`)) && (await gone(`users/${a}/aliases/${b}`)));
await check('avatar deleted', () => fileGone(`avatars/${a}.jpg`));
await check('friendships and trust deleted (including a pending request)', async () =>
  (await gone(`friends/${[a, b].sort().join('_')}`)) && (await gone(`trusts/${[a, b].sort().join('_')}`)) && (await gone(`friends/${[a, c].sort().join('_')}`)));
await check("the friend's nickname for me deleted", () => gone(`users/${b}/aliases/${a}`));
await check('every share I owned, received or was asked to take deleted', async () => (await gone('shares/mine')) && (await gone('shares/received')) && (await gone('shares/asked')));
await check('chat deleted', async () => (await db.collection('shares/mine/messages').get()).empty);
await check('share and chat photos deleted', async () => (await fileGone('shares/mine/photo.jpg')) && (await fileGone('shares/received/msgs/1.jpg')));
await check("notifications about me in the friend's inbox deleted", async () => (await gone(`users/${b}/notifications/about-me`)) && (await gone(`users/${b}/notifications/about-share`)));
await check("other people's data untouched", async () =>
  !(await gone(`profiles/${b}`)) && !(await gone(`profiles/${c}`)) && !(await gone('shares/bystander')) && !(await gone(`users/${b}/notifications/unrelated`)) && !(await fileGone('shares/bystander/photo.jpg')));
await check('the other users can still sign in', async () => (await getAuth().getUser(b)).uid === b && (await getAuth().getUser(c)).uid === c);
console.log('all passed');

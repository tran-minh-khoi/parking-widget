// Unfriending wipes everything between the two people. Run with the Firestore + Functions + Storage emulators:
//   firebase emulators:exec --only firestore,functions,storage --project demo-parking "node test/unfriend.test.mjs"
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

initializeApp({ projectId: 'demo-parking', storageBucket: 'demo-parking.appspot.com' });
const db = getFirestore();
const bucket = getStorage().bucket();
const later = Timestamp.fromMillis(Date.now() + 3600e3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eventually = async (name, cond) => {
  for (let i = 0; i < 40; i++) if (await cond()) return console.log('ok', name);
  else await sleep(500);
  throw new Error(`FAILED: ${name}`);
};
const gone = async (path) => !(await db.doc(path).get()).exists;

// a and b are friends; c is someone else who also shared with a
await db.doc('friends/a_b').set({ members: ['a', 'b'], requester: 'a', status: 'accepted' });
await db.doc('trusts/a_b').set({ members: ['a', 'b'], requester: 'a', status: 'accepted' });
await db.doc('users/a/aliases/b').set({ name: 'B nick' });
await db.doc('users/b/aliases/a').set({ name: 'A nick' });
const share = (id, o, r, extra = {}) => db.doc(`shares/${id}`).set({ ownerId: o, recipientId: r, status: 'accepted', expiresAt: later, ...extra });
await share('s_ab', 'a', 'b');
await share('s_ba', 'b', 'a');
await db.doc('shares/s_inv').set({ ownerId: 'a', invitee: 'b', status: 'open', expiresAt: later });
await share('s_ac', 'c', 'a');
await db.doc('shares/s_ab/messages/m1').set({ uid: 'a', text: 'hi' });
await bucket.file('shares/s_ab/photo.jpg').save('x');
await bucket.file('shares/s_ab/msgs/1.jpg').save('x');
await bucket.file('shares/s_ac/photo.jpg').save('keep');
await db.doc('users/a/notifications/n1').set({ type: 'friend', refUid: 'b', createdAt: Timestamp.now() });
await db.doc('users/b/notifications/n2').set({ type: 'share', shareId: 's_ab', createdAt: Timestamp.now() });
await db.doc('users/a/notifications/n3').set({ type: 'friend', refUid: 'c', createdAt: Timestamp.now() });
await db.doc('users/a/notifications/n4').set({ type: 'share', shareId: 's_ac', createdAt: Timestamp.now() });

// a pending request that is declined must NOT take shared history with it
await db.doc('friends/a_d').set({ members: ['a', 'd'], requester: 'd', status: 'pending' });
await share('s_ad', 'a', 'd');
await db.doc('friends/a_d').delete();
await sleep(4000);
if (await gone('shares/s_ad')) throw new Error('FAILED: declining a request deleted a share');
console.log('ok declining a pending request keeps shares');

await db.doc('friends/a_b').delete(); // unfriend
await eventually('trust deleted', () => gone('trusts/a_b'));
await eventually('both nicknames deleted', async () => (await gone('users/a/aliases/b')) && (await gone('users/b/aliases/a')));
await eventually('shares between them deleted', async () => (await gone('shares/s_ab')) && (await gone('shares/s_ba')) && (await gone('shares/s_inv')));
await eventually('chat deleted', async () => (await db.collection('shares/s_ab/messages').get()).empty);
await eventually('photos deleted', async () => !(await bucket.file('shares/s_ab/photo.jpg').exists())[0] && !(await bucket.file('shares/s_ab/msgs/1.jpg').exists())[0]);
await eventually('friend notifications about each other deleted', () => gone('users/a/notifications/n1'));
await eventually('share notifications deleted', () => gone('users/b/notifications/n2'));
if (await gone('shares/s_ac') || await gone('users/a/notifications/n3') || await gone('users/a/notifications/n4')) throw new Error('FAILED: unrelated data was deleted');
if (!(await bucket.file('shares/s_ac/photo.jpg').exists())[0]) throw new Error('FAILED: unrelated photo was deleted');
console.log('ok unrelated shares, notifications and photos are untouched');
console.log('all passed');

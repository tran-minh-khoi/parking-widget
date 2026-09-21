const { setGlobalOptions } = require('firebase-functions/v2');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 }); // same region as the Firestore database

// Retention: keep as little as possible; nearly everything is deleted automatically.
// (The client-side twins live in src/config.ts — keep the two in sync.)
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOTIFICATIONS_KEEP = 14 * DAY; // in-app notifications
const SHARE_PHOTOS_KEEP = 3 * DAY; // share photo + chat photos, after the share window ended
const SHARE_LOCATION_KEEP = HOUR; // recipients lose the coordinates an hour after the window ended
const SHARE_CONVERSATION_KEEP = 30 * DAY; // the whole share (chat text included) is deleted 30 days after its window ended

// Push copy per language; the app stores each user's language next to their Expo push token.
const T = {
  vi: {
    accepted: (n) => ({ title: 'Đã nhận link xe', body: `${n} đã nhận chỗ đỗ xe của bạn` }),
    pickedUp: (n) => ({ title: 'Đã lấy xe 🚗', body: `${n} đã lấy xe của bạn` }),
    closed: (n) => ({ title: 'Chủ xe đã lấy xe', body: `${n} đã tự lấy xe, link không còn hiệu lực` }),
    noteChanged: (n, note) => ({ title: `${n} đã đổi ghi chú chỗ đỗ`, body: note ? `Ghi chú mới: ${note}` : 'Đã xoá ghi chú' }),
    nudge: (n, place) => ({ title: `${n} nhắc bạn 🚗`, body: place ? `Chỗ đỗ xe: ${place}` : 'Chạm để xem chỗ đỗ xe' }),
    friendShared: (n, place) => ({ title: `${n} chia sẻ chỗ đỗ xe với bạn`, body: place || 'Chạm để xem và nhận' }),
    revoked: (n) => ({ title: 'Đã huỷ chia sẻ', body: `${n} đã huỷ chia sẻ chỗ đỗ xe với bạn` }),
    message: (n, text) => ({ title: n, body: text }),
    trustRequest: (n) => ({ title: 'Lời mời tin tưởng', body: `${n} muốn tin tưởng bạn để xem xe của nhau` }),
    trustAccepted: (n) => ({ title: 'Đã tin tưởng nhau', body: `${n} đã chấp nhận lời mời của bạn` }),
    parked: (n, place) => ({ title: `${n} vừa đỗ xe 🚗`, body: place || 'Chạm để xem vị trí' }),
    friendRequest: (n) => ({ title: 'Lời mời kết bạn', body: `${n} muốn kết bạn với bạn` }),
    friendAccepted: (n) => ({ title: 'Đã kết bạn', body: `${n} đã chấp nhận lời mời kết bạn` }),
    pickupRequest: (n, place) => ({ title: `${n} nhờ bạn lấy xe giúp 🚗`, body: place || 'Chạm để xem và đồng ý' }),
    declined: (n) => ({ title: 'Bị từ chối', body: `${n} không thể lấy xe giúp bạn` }),
  },
  en: {
    accepted: (n) => ({ title: 'Parking spot accepted', body: `${n} accepted your parking spot` }),
    pickedUp: (n) => ({ title: 'Car picked up 🚗', body: `${n} picked up your car` }),
    closed: (n) => ({ title: 'Owner got the car', body: `${n} already took the car, the link is closed` }),
    noteChanged: (n, note) => ({ title: `${n} changed the parking note`, body: note ? `New note: ${note}` : 'The note was removed' }),
    nudge: (n, place) => ({ title: `${n} is nudging you 🚗`, body: place ? `Parking spot: ${place}` : 'Tap to see the parking spot' }),
    friendShared: (n, place) => ({ title: `${n} shared a parking spot with you`, body: place || 'Tap to view and accept' }),
    revoked: (n) => ({ title: 'Sharing cancelled', body: `${n} stopped sharing their parking spot with you` }),
    message: (n, text) => ({ title: n, body: text }),
    trustRequest: (n) => ({ title: 'Trust request', body: `${n} wants to trust you and see each other's cars` }),
    trustAccepted: (n) => ({ title: 'You trust each other', body: `${n} accepted your request` }),
    parked: (n, place) => ({ title: `${n} just parked 🚗`, body: place || 'Tap to see where' }),
    friendRequest: (n) => ({ title: 'Friend request', body: `${n} wants to be your friend` }),
    friendAccepted: (n) => ({ title: 'You are friends', body: `${n} accepted your friend request` }),
    pickupRequest: (n, place) => ({ title: `${n} asks you to pick up their car 🚗`, body: place || 'Tap to view and accept' }),
    declined: (n) => ({ title: 'Declined', body: `${n} can't pick up your car` }),
  },
};

// Whatever was typed -> E.164 (a number without "+" is read as Vietnamese). Keep in sync with src/lib/phone.ts.
const normPhone = (s) => parsePhoneNumberFromString(String(s).trim(), 'VN')?.number ?? '';

// jane.doe@gmail.com -> j***@gmail.com
const maskEmail = (e) => (e && e.includes('@') ? `${e[0]}***${e.slice(e.indexOf('@'))}` : '');

const nameOf = async (uid) => (await db.doc(`profiles/${uid}`).get()).data()?.name || '?';

// extra: { type, shareId, refUid } — stored in the in-app notification and sent as the push payload.
async function push(uid, key, args, extra = {}) {
  if (!uid) return;
  const { expoPushToken, lang } = (await db.doc(`users/${uid}`).get()).data() || {};
  const { title, body } = (T[lang] || T.en)[key](...args);
  const data = Object.fromEntries(Object.entries(extra).filter(([k, v]) => k !== 'type' && v));
  // In-app notification centre entry, even if the user has no push token / disabled push.
  await db.collection(`users/${uid}/notifications`).add({
    type: extra.type || 'share', title, body, ...data, read: false, createdAt: Timestamp.now(),
  });
  if (!expoPushToken) return;
  // Expo's push service relays to APNs/FCM using the credentials stored in EAS.
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoPushToken, title, body, sound: 'default', data }),
  });
}

// A friend was asked to pick the car up.
// The timeline of a share (who shared / was asked / agreed / picked up / declined / took the car back) is kept on
// the share itself, written here so nobody can forge it. `deleteAt` is when the whole conversation is removed.
// A share addressed to a friend is either "pick my car up" (the default, older shares have no flag) or a plain share.
const isPickup = (s) => !!s.invitee && s.pickup !== false;
const entry = (t, by, extra = {}) => ({ t, by: by || '?', at: Date.now(), ...extra });

exports.onShareCreated = onDocumentCreated('shares/{id}', async (event) => {
  const s = event.data.data();
  await event.data.ref.update({
    timeline: FieldValue.arrayUnion(isPickup(s) ? entry('asked', s.ownerName, { to: s.inviteeName || '' }) : entry('shared', s.ownerName)),
    deleteAt: Timestamp.fromMillis(s.expiresAt.toMillis() + SHARE_CONVERSATION_KEEP),
  });
  if (s.invitee) await push(s.invitee, isPickup(s) ? 'pickupRequest' : 'friendShared', [s.ownerName || '?', s.placeTitle], { type: 'share', shareId: event.params.id });
});

exports.onShareUpdated = onDocumentUpdated('shares/{id}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const statusChanged = before.status !== after.status;
  const expiryChanged = before.expiresAt.toMillis() !== after.expiresAt.toMillis();
  const noteChanged = (before.note || '') !== (after.note || '');
  const nudged = !!after.nudgedAt && after.nudgedAt.toMillis() !== before.nudgedAt?.toMillis();
  if (!statusChanged && !expiryChanged && !noteChanged && !nudged) return; // includes our own timeline / deleteAt writes below
  const { id } = event.params;

  const patch = {};
  if (expiryChanged) patch.deleteAt = Timestamp.fromMillis(after.expiresAt.toMillis() + SHARE_CONVERSATION_KEEP); // "until the car is gone" was extended
  if (statusChanged) {
    const by = {
      accepted: after.recipientName,
      pickedUp: after.recipientName,
      declined: after.recipientName || after.inviteeName, // withdrawn after agreeing, or declined by the invited friend
      closed: after.ownerName,
      revoked: after.ownerName,
    }[after.status];
    if (by !== undefined) patch.timeline = FieldValue.arrayUnion(entry(after.status, by));
    if (['pickedUp', 'declined', 'closed', 'revoked'].includes(after.status)) {
      patch.endedAt = Timestamp.now();
      patch.deleteAt = Timestamp.fromMillis(Date.now() + SHARE_CONVERSATION_KEEP); // history is kept 30 days after it ends
    }
  }
  if (Object.keys(patch).length) await event.data.after.ref.update(patch);

  // The owner edited the note or nudged: tell the other person (the recipient, or the friend it was sent to).
  const other = after.recipientId || after.invitee;
  if (other && ['open', 'accepted'].includes(after.status)) {
    if (noteChanged) await push(other, 'noteChanged', [after.ownerName || '?', after.note || ''], { shareId: id });
    if (nudged) await push(other, 'nudge', [after.ownerName || '?', after.placeTitle || after.note || ''], { shareId: id });
  }
  if (!statusChanged) return;

  if (after.status === 'accepted') await push(after.ownerId, 'accepted', [after.recipientName || '?'], { shareId: id });
  if (after.status === 'pickedUp') await push(after.ownerId, 'pickedUp', [after.recipientName || '?'], { shareId: id });
  if (after.status === 'closed') await push(after.recipientId, 'closed', [after.ownerName || '?'], { shareId: id });
  if (after.status === 'revoked') await push(after.recipientId, 'revoked', [after.ownerName || '?'], { shareId: id });
  if (after.status === 'declined') {
    // declined by the invited friend, or withdrawn by the person who had agreed
    const who = after.recipientName || (after.invitee ? await nameOf(after.invitee) : '?');
    await push(after.ownerId, 'declined', [who], { shareId: id });
  }
});

exports.onMessageCreated = onDocumentCreated('shares/{id}/messages/{mid}', async (event) => {
  const msg = event.data.data();
  const share = (await db.doc(`shares/${event.params.id}`).get()).data();
  if (!share) return;
  const to = msg.uid === share.ownerId ? share.recipientId : share.ownerId;
  await push(to, 'message', [msg.name || '?', msg.text ? String(msg.text).slice(0, 120) : '📷'], { type: 'message', shareId: event.params.id });
});

// Everything a share leaves behind: its photos (share + chat), its chat, its in-app notifications in everyone's inbox and
// the doc itself. Safe to run again, and also used when the doc is already gone (a client deleted it).
const wipeShare = async (ref) => {
  await getStorage().bucket().deleteFiles({ prefix: `shares/${ref.id}/` });
  const notices = await db.collectionGroup('notifications').where('shareId', '==', ref.id).get();
  await Promise.all(notices.docs.map((d) => d.ref.delete()));
  await db.recursiveDelete(ref); // the doc and its messages
};

// The owner deleted a parking from History: the share is gone for everyone, so drop its chat and photos too.
exports.onShareDeleted = onDocumentDeleted('shares/{id}', (event) => wipeShare(db.doc(`shares/${event.params.id}`)));

exports.onFriendCreated = onDocumentCreated('friends/{id}', async (event) => {
  const f = event.data.data();
  const other = f.members.find((m) => m !== f.requester);
  await push(other, 'friendRequest', [await nameOf(f.requester)], { type: 'friend', refUid: f.requester });
});

exports.onFriendUpdated = onDocumentUpdated('friends/{id}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === 'pending' && after.status === 'accepted') {
    const other = after.members.find((m) => m !== after.requester);
    await push(after.requester, 'friendAccepted', [await nameOf(other)], { type: 'friend', refUid: other });
  }
});

// Unfriending leaves nothing behind, for both people: the friendship and trust, the nicknames, every share between them
// (with its photos, chat and notifications) and the friend / trust / parked notifications about each other.
const wipePair = async (a, b) => {
  const id = [a, b].sort().join('_');
  for (const [me, other] of [[a, b], [b, a]]) {
    await db.doc(`users/${me}/aliases/${other}`).delete();
    for (const f of ['recipientId', 'invitee']) {
      for (const d of (await db.collection('shares').where('ownerId', '==', me).where(f, '==', other).get()).docs) await wipeShare(d.ref);
    }
    for (const d of (await db.collection(`users/${me}/notifications`).where('refUid', '==', other).get()).docs) await d.ref.delete();
  }
  // the friendship goes last: if anything above failed it is still there, and unfriending again finishes the job
  await db.doc(`trusts/${id}`).delete();
  await db.doc(`friends/${id}`).delete();
};

// The app unfriends through this call (it waits for the wipe and shows errors). The trigger below is the safety net
// for a friend doc deleted some other way.
exports.unfriend = onCall({ timeoutSeconds: 120 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const other = String(req.data?.other ?? '');
  if (!other || other === req.auth.uid) throw new HttpsError('invalid-argument', 'Bad user');
  const ref = db.doc(`friends/${[req.auth.uid, other].sort().join('_')}`);
  // Only a real friendship takes its history with it. Cancelling or declining a request just removes the request.
  if ((await ref.get()).data()?.status === 'accepted') await wipePair(req.auth.uid, other);
  else await ref.delete();
});
exports.onFriendDeleted = onDocumentDeleted('friends/{id}', (event) => {
  const f = event.data.data();
  return f.status === 'accepted' ? wipePair(...f.members) : undefined;
});

// Find a person by exact email or phone number and return only their public profile.
exports.findUser = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const q = String(req.data?.q ?? '').trim();
  if (q.length < 5 || q.length > 100) return null;
  let uid = null;
  try {
    if (q.includes('@')) uid = (await getAuth().getUserByEmail(q.toLowerCase())).uid;
    else {
      const phone = normPhone(q);
      const snap = phone ? await db.collection('contacts').where('phone', '==', phone).limit(1).get() : null;
      uid = snap?.docs[0]?.id ?? null;
    }
  } catch {
    uid = null; // no such user
  }
  if (!uid || uid === req.auth.uid) return null;
  const p = (await db.doc(`profiles/${uid}`).get()).data();
  if (!p) return null;
  // Found by email: the caller already knows it. Found by phone: only a masked email, so a phone number can't reveal an address.
  const email = q.includes('@') ? q.toLowerCase() : maskEmail((await getAuth().getUser(uid).catch(() => null))?.email);
  return { uid, name: p.name, photoURL: p.photoURL || '', email };
});

// Which of my contacts already use the app? The phone's contacts are compared with member phone numbers / emails and
// nothing is kept: the lists are not stored, only a timestamp to keep this from being used to scan for people.
const SYNC_MAX = 2000; // numbers + emails per call
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
exports.matchContacts = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const me = req.auth.uid;
  const gate = db.doc(`users/${me}`);
  if (Date.now() - ((await gate.get()).data()?.syncedAt?.toMillis() ?? 0) < 30 * 1000) throw new HttpsError('resource-exhausted', 'Too many syncs');
  await gate.set({ syncedAt: Timestamp.now() }, { merge: true });

  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()) : []);
  const phones = [...new Set(list(req.data?.phones).filter((p) => /^\+\d{7,15}$/.test(p)))].slice(0, SYNC_MAX);
  const emails = [...new Set(list(req.data?.emails).map((e) => e.toLowerCase()).filter((e) => e.length <= 100 && e.includes('@')))].slice(0, SYNC_MAX - phones.length);

  const uidOf = {}; // phone or email -> uid
  await Promise.all([
    ...chunks(phones, 30).map(async (c) => (await db.collection('contacts').where('phone', 'in', c).get()).forEach((d) => (uidOf[d.data().phone] = d.id))),
    ...chunks(emails, 100).map(async (c) => (await getAuth().getUsers(c.map((email) => ({ email })))).users.forEach((u) => u.email && (uidOf[u.email.toLowerCase()] = u.uid))),
  ]);
  const uids = [...new Set(Object.values(uidOf))].filter((u) => u !== me);
  const profiles = {};
  await Promise.all(chunks(uids, 200).map(async (c) => (await db.getAll(...c.map((u) => db.doc(`profiles/${u}`)))).forEach((d) => d.exists && (profiles[d.id] = d.data()))));
  // key = the number / email as it appeared in the caller's contacts, so the app can show the contact's own name
  return Object.entries(uidOf)
    .filter(([, uid]) => profiles[uid])
    .map(([key, uid]) => ({ key, uid, name: profiles[uid].name, photoURL: profiles[uid].photoURL || '' }));
});

// Friends see each other's email, copied here from the sign-in account (so it is real, and it works for every app version).
// Runs when a profile is written (each app start), and only writes when the email is missing or changed.
exports.onProfileWritten = onDocumentWritten('profiles/{uid}', async (event) => {
  if (!event.data.after.exists) return;
  const { uid } = event.params;
  const email = ((await getAuth().getUser(uid).catch(() => null))?.email || '').toLowerCase();
  if (!email) return;
  const ref = db.doc(`contacts/${uid}`);
  if ((await ref.get()).data()?.email === email) return;
  await ref.set({ email }, { merge: true });
});

// Delete everything about the caller, then the account itself (App Store guideline 5.1.1(v)).
// Shares are removed with their chat and photos (onShareDeleted); friendships, trusts, nicknames, profile, phone / email,
// published spot, notifications, push token and avatar go too. Safe to call again if it stopped half way.
exports.deleteAccount = onCall({ timeoutSeconds: 300 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const uid = req.auth.uid;

  // shares I own, received or was asked to take
  const shares = await Promise.all(['ownerId', 'recipientId', 'invitee'].map((f) => db.collection('shares').where(f, '==', uid).get()));
  for (const d of new Map(shares.flatMap((s) => s.docs.map((x) => [x.id, x]))).values()) await wipeShare(d.ref);

  for (const col of ['friends', 'trusts']) {
    for (const d of (await db.collection(col).where('members', 'array-contains', uid).get()).docs) {
      const other = d.data().members.find((m) => m !== uid);
      await db.doc(`users/${other}/aliases/${uid}`).delete(); // their nickname for me
      await d.ref.delete();
    }
  }
  // notifications about me in other people's inboxes (friend / trust / parked)
  await Promise.all((await db.collectionGroup('notifications').where('refUid', '==', uid).get()).docs.map((d) => d.ref.delete()));
  await Promise.all(['spots', 'profiles', 'contacts'].map((c) => db.doc(`${c}/${uid}`).delete()));
  await db.recursiveDelete(db.doc(`users/${uid}`)); // push token, notifications, my nicknames
  await getStorage().bucket().file(`avatars/${uid}.jpg`).delete({ ignoreNotFound: true });
  await getAuth().deleteUser(uid);
});

exports.onTrustCreated = onDocumentCreated('trusts/{id}', async (event) => {
  const t = event.data.data();
  const other = t.members.find((m) => m !== t.requester);
  await push(other, 'trustRequest', [await nameOf(t.requester)], { type: 'trust', refUid: t.requester });
});

exports.onTrustUpdated = onDocumentUpdated('trusts/{id}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === 'pending' && after.status === 'accepted') {
    const other = after.members.find((m) => m !== after.requester);
    await push(after.requester, 'trustAccepted', [await nameOf(other)], { type: 'trust', refUid: other });
  }
});

// Someone I trust parked: tell everyone who trusts them.
exports.onSpotWritten = onDocumentWritten('spots/{uid}', async (event) => {
  const after = event.data.after.data();
  if (!after) return;
  const before = event.data.before.data();
  if (before && before.parkedAt.toMillis() === after.parkedAt.toMillis()) return; // note / renew edits: no notification
  const uid = event.params.uid;
  const trusts = await db.collection('trusts').where('members', 'array-contains', uid).get();
  for (const doc of trusts.docs) {
    const t = doc.data();
    if (t.status !== 'accepted') continue;
    await push(t.members.find((m) => m !== uid), 'parked', [after.name || (await nameOf(uid)), after.placeTitle], { type: 'spot', refUid: uid });
  }
});

// Hourly housekeeping, sized for the free tier.
exports.cleanupExpired = onSchedule('every 60 minutes', async () => {
  const now = Date.now();
  const bucket = getStorage().bucket();
  const ms = (t) => Timestamp.fromMillis(t);

  // Shares. Never accepted: delete. Ended: location goes after 1h, photos + thumbnail after 3 days,
  // the conversation itself after 30 days (below).
  const shares = await db.collection('shares').where('scrubbed', '==', false).where('expiresAt', '<', ms(now - SHARE_LOCATION_KEEP)).get();
  for (const doc of shares.docs) {
    const s = doc.data();
    if (s.status === 'open') {
      await bucket.deleteFiles({ prefix: `shares/${doc.id}/` });
      await db.recursiveDelete(doc.ref);
      continue;
    }
    const patch = {};
    if (s.lat != null) Object.assign(patch, { lat: null, lng: null });
    if (s.expiresAt.toMillis() < now - SHARE_PHOTOS_KEEP) {
      await bucket.deleteFiles({ prefix: `shares/${doc.id}/` }); // full photo + chat photos
      Object.assign(patch, { thumb: '', photoPath: FieldValue.delete(), scrubbed: true });
    }
    if (Object.keys(patch).length) await doc.ref.update(patch);
  }

  // The whole share (conversation included): on its `deleteAt`, or 30 days after its window for older shares.
  const due = await db.collection('shares').where('deleteAt', '<', ms(now)).limit(200).get();
  for (const doc of due.docs) {
    await bucket.deleteFiles({ prefix: `shares/${doc.id}/` });
    await db.recursiveDelete(doc.ref);
  }
  const stale = await db.collection('shares').where('expiresAt', '<', ms(now - SHARE_CONVERSATION_KEEP)).limit(200).get();
  for (const doc of stale.docs) {
    await bucket.deleteFiles({ prefix: `shares/${doc.id}/` });
    await db.recursiveDelete(doc.ref);
  }

  // Notifications older than 14 days.
  const oldNotices = await db.collectionGroup('notifications').where('createdAt', '<', ms(now - NOTIFICATIONS_KEEP)).limit(400).get();
  await Promise.all(oldNotices.docs.map((d) => d.ref.delete()));

  // Published parking spots that expired (the owner's app normally deletes them on pickup).
  const spots = await db.collection('spots').where('expiresAt', '<', ms(now)).get();
  await Promise.all(spots.docs.map((d) => d.ref.delete()));
});

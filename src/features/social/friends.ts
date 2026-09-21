import { collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { restartLive, useLive } from '@/lib/live';

import { useUser, type Who } from '@/features/account/auth';
import { app, db } from '@/lib/firebase';
import { pairId } from '@/features/social/trust';

// Friends: search someone by email / phone, send a request, and once accepted you can ask them to
// trust you (trust.ts) or to pick your car up for you (a share with an `invitee`).

export type Friend = { id: string; other: string; requester: string; status: 'pending' | 'accepted' };
export type Found = { uid: string; name: string; photoURL: string; email: string };

export { normPhone } from '@/features/account/phone';
import { normPhone } from '@/features/account/phone';

const NONE: Friend[] = [];
export const useFriendsLive = (me?: string) => {
  const { data, loading, error, refresh } = useLive<Friend[]>(
    me ? `friends:${me}` : null,
    (set, fail) =>
      onSnapshot(
        query(collection(db, 'friends'), where('members', 'array-contains', me)),
        (s) => set(s.docs.map((d) => ({ id: d.id, ...d.data(), other: (d.data().members as string[]).find((m) => m !== me)! }) as Friend)),
        fail,
      ),
    NONE,
  );
  return { items: data, loading, error, refresh };
};
export const useFriends = (me?: string) => useFriendsLive(me).items;

export const sendFriend = (me: Who, other: string) =>
  setDoc(doc(db, 'friends', pairId(me.uid, other)), {
    members: [me.uid, other].sort(),
    requester: me.uid,
    status: 'pending',
    createdAt: Timestamp.now(),
  });

export const acceptFriend = (me: string, other: string) => updateDoc(doc(db, 'friends', pairId(me, other)), { status: 'accepted' });

// Unfriending (or cancelling / declining a request) is done by the server, which deletes everything between the two
// of you: trust, nicknames, shared spots with their chats and photos, and the related notifications.
export const removeFriend = async (me: string, other: string) => {
  await httpsCallable<{ other: string }, void>(getFunctions(app, 'asia-southeast1'), 'unfriend')({ other });
  restartLive(`aliases:${me}`);
};

// Exact email or phone -> that person's public profile (or null). Runs on the server so nobody can list users.
export const findUser = async (q: string): Promise<Found | null> => {
  const call = httpsCallable<{ q: string }, Found | null>(getFunctions(app, 'asia-southeast1'), 'findUser');
  return (await call({ q })).data;
};

// A friend's phone number and email (only friends may read them).
export type ContactInfo = { phone?: string; email?: string };
export const useContact = (uid?: string) =>
  useLive<ContactInfo | undefined>(
    uid ? `contact:${uid}` : null,
    (set, fail) => onSnapshot(doc(db, 'contacts', uid!), (d) => set(d.exists() ? { phone: d.data().phone || undefined, email: d.data().email || undefined } : undefined), fail),
    undefined,
  ).data;

// My private nicknames for people, by uid. Only I can see them.
const NO_ALIASES: Record<string, string> = {};
export const useAliases = (me?: string) =>
  useLive<Record<string, string>>(
    me ? `aliases:${me}` : null,
    (set, fail) => onSnapshot(collection(db, 'users', me!, 'aliases'), (s) => set(Object.fromEntries(s.docs.map((d) => [d.id, String(d.data().name ?? '')]))), fail),
    NO_ALIASES,
  ).data;
export const useAlias = (uid?: string) => useAliases(useUser()?.uid)[uid ?? ''];
export const saveAlias = async (me: string, other: string, name: string) => {
  const ref = doc(db, 'users', me, 'aliases', other);
  await (name.trim() ? setDoc(ref, { name: name.trim() }) : deleteDoc(ref));
  restartLive(`aliases:${me}`);
};

// My own extra details: gender + about are public, the phone number is only for me and my friends.
export const saveExtras = async (me: Who, x: { gender?: string; about?: string; phone?: string }) => {
  const { phone, ...profile } = x;
  if (Object.keys(profile).length) await setDoc(doc(db, 'profiles', me.uid), profile, { merge: true });
  if (phone !== undefined) {
    if (phone.trim()) await setDoc(doc(db, 'contacts', me.uid), { phone: normPhone(phone) }, { merge: true });
    else await setDoc(doc(db, 'contacts', me.uid), { phone: '' }, { merge: true }); // the doc also holds my email
  }
};

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where,
  type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type  { Who } from '@/features/account/auth';
import { db, storage } from '@/lib/firebase';
import type { TimelineEntry } from './timeline';
import { resizeJpeg } from '@/lib/image';
import { useLive } from '@/lib/live';

export type ShareStatus = 'open' | 'accepted' | 'pickedUp' | 'closed' | 'revoked' | 'declined';
export type Share = {
  id: string;
  ownerId: string;
  ownerName: string;
  note?: string;
  placeTitle?: string;
  placeAddress?: string;
  lat: number | null; // null once the share window ended
  lng: number | null;
  thumb: string;
  photoPath?: string;
  parkedAt: number;
  expiresAt: number;
  untilGone?: boolean; // shared "until the car is gone"
  invitee?: string; // a friend the share was sent to directly: only they can accept
  pickup?: boolean; // ...and it is a "pick my car up" request (false = just sharing the spot). Older shares have no flag: pickup.
  inviteeName?: string;
  sent?: boolean; // false while the share sheet is open; true once the link was actually sent
  status: ShareStatus;
  recipientId?: string;
  recipientName?: string;
  pickedUpAt?: number;
  timeline?: TimelineEntry[]; // stamped by Cloud Functions
  endedAt?: number;
  nudgedAt?: number; // last time the owner nudged the other person
  deleteAt?: number; // when the whole conversation is removed
};
export type Message = { id: string; uid: string; name: string; text: string; photoPath?: string; createdAt: number };

export const isPickup = (s: Share) => !!s.invitee && s.pickup !== false;

export const nameOf = (u: Who) => u.displayName ?? u.email?.split('@')[0] ?? '?';

const ms = (t?: Timestamp) => t?.toMillis();
const toShare = (d: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData | undefined }): Share => {
  const x = d.data() as DocumentData;
  return { ...x, id: d.id, parkedAt: ms(x.parkedAt)!, expiresAt: ms(x.expiresAt)!, pickedUpAt: ms(x.pickedUpAt), endedAt: ms(x.endedAt), nudgedAt: ms(x.nudgedAt), deleteAt: ms(x.deleteAt) } as Share;
};

// undefined = loading, null = missing / expired (rules deny reads after expiry)
export const useShare = (id: string) => {
  const { data, loading } = useLive<Share | null>(
    `share:${id}`,
    (set) => onSnapshot(doc(db, 'shares', id), (d) => set(d.exists() ? toShare(d) : null), () => set(null)),
    null,
  );
  return loading ? undefined : data;
};

const NO_MESSAGES: Message[] = [];
export const useMessages = (id: string, enabled: boolean) => {
  const { data, loading } = useLive<Message[]>(
    enabled ? `messages:${id}` : null,
    (set, fail) =>
      onSnapshot(
        query(collection(db, 'shares', id, 'messages'), orderBy('createdAt')),
        (s) => set(s.docs.map((d) => ({ ...(d.data() as Message), id: d.id, createdAt: ms(d.data().createdAt as Timestamp) ?? Date.now() }))),
        fail,
      ),
    NO_MESSAGES,
  );
  return { messages: data, loading };
};

// My shares: what I sent and what I accepted, with first-load / error / pull-to-refresh state.
const NO_SHARES: Share[] = [];
const byNewest = (a: Share, b: Share) => b.parkedAt - a.parkedAt;
// Ended shares stay (the conversation is history); never-accepted expired links do not.
const alive = (s: Share) => s.status !== 'open' || s.expiresAt > Date.now();
// Mine: only what I actually sent. A share is created before the share sheet opens and only counts once
// it was sent (`sent`), so cancelling never leaves a "waiting for someone" row; dead links with no recipient are noise.
const sent = (s: Share) => alive(s) && s.sent !== false && !(s.status === 'closed' && !s.recipientId);

const useSharesWhere = (field: 'ownerId' | 'recipientId' | 'invitee', uid: string | undefined, keep: (s: Share) => boolean) =>
  useLive<Share[]>(
    uid ? `shares:${field}:${uid}` : null,
    (set, fail) =>
      onSnapshot(
        query(collection(db, 'shares'), where(field, '==', uid)),
        (s) => set(s.docs.map(toShare).filter(keep).sort(byNewest).slice(0, 50)),
        fail,
      ),
    NO_SHARES,
  );

export const useMyShares = (uid?: string) => {
  const a = useSharesWhere('ownerId', uid, sent);
  const b = useSharesWhere('recipientId', uid, alive);
  const c = useSharesWhere('invitee', uid, alive); // friends who asked me to pick their car up
  const received = [...b.data, ...c.data.filter((i) => !b.data.some((r) => r.id === i.id))].sort(byNewest).slice(0, 50);
  return {
    owned: a.data,
    received,
    loading: a.loading || b.loading || c.loading,
    error: a.error || b.error || c.error,
    refresh: () => Promise.all([a.refresh(), b.refresh(), c.refresh()]),
  };
};

export const photoUrl = (path: string) => getDownloadURL(ref(storage, path));

export const acceptShare = (id: string, user: Who) =>
  updateDoc(doc(db, 'shares', id), { recipientId: user.uid, recipientName: nameOf(user), status: 'accepted' });

export const declineShare = (id: string) => updateDoc(doc(db, 'shares', id), { status: 'declined' });

export const markPickedUp = (id: string) => updateDoc(doc(db, 'shares', id), { status: 'pickedUp', pickedUpAt: Timestamp.now() });

// Owner took the car: close every link that is still open/accepted (rules reject the rest, ignored).
// "Until the car is gone" shares follow the parking when it is renewed.
// Write the same change to several of my shares; the ones that already ended refuse it (ignored).
export const patchShares = (ids: string[] = [], data: Partial<{ expiresAt: Timestamp; untilGone: boolean; note: string }>) =>
  Promise.allSettled(ids.map((id) => updateDoc(doc(db, 'shares', id), data)));

export const extendShares = (ids: string[] = [], ms: number) => patchShares(ids, { expiresAt: Timestamp.fromMillis(ms) });

// Remind the other person about the spot (they get a push; the rules allow one a minute).
export const nudgeShare = (id: string) => updateDoc(doc(db, 'shares', id), { nudgedAt: serverTimestamp() });

// Owner takes a link back (also cleans up a share that was never accepted).
// The link was really sent: from now on it counts as "I shared".
export const markSent = (id: string) => updateDoc(doc(db, 'shares', id), { sent: true });

export const revokeShare = (id: string) => deleteDoc(doc(db, 'shares', id));

// Stop sharing. Nobody accepted yet: just delete the link. Someone did: mark it revoked so they are told and keep the chat history.
export const cancelShare = (s: Share) => (s.status === 'accepted' ? updateDoc(doc(db, 'shares', s.id), { status: 'revoked' }) : revokeShare(s.id));

export const closeShares = (ids: string[] = []) =>
  Promise.allSettled(ids.map((id) => updateDoc(doc(db, 'shares', id), { status: 'closed' })));

export const sendMessage = (id: string, user: Who, text: string, photoPath?: string) =>
  addDoc(collection(db, 'shares', id, 'messages'), {
    uid: user.uid,
    name: nameOf(user),
    text: text.trim(),
    ...(photoPath && { photoPath }),
    createdAt: Timestamp.now(),
  });

// Photo in the chat, e.g. "I got the car, here it is".
export const sendPhoto = async (id: string, user: Who, uri: string) => {
  const small = await resizeJpeg(uri, 1080, 0.7);
  const path = `shares/${id}/msgs/${Date.now()}.jpg`;
  await uploadBytes(ref(storage, path), await (await fetch(small.uri)).blob(), { contentType: 'image/jpeg' });
  await sendMessage(id, user, '', path);
};

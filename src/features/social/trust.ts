import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

import type  { AppUser, Who } from '@/features/account/auth';
import { useLive } from '@/lib/live';
import { auth, db } from '@/lib/firebase';
import type  { Spot } from '@/features/parking/model';
import { expiresAt } from '@/features/parking/model';
import { nameOf } from '@/features/sharing/shares';

// Trust = two people who accepted each other: each parking notifies the other, who can see the car.

export type Profile = { name: string; photoURL: string; gender?: string; about?: string };
export type Trust = { id: string; other: string; requester: string; status: 'pending' | 'accepted' };
export type PublishedSpot = {
  name: string;
  lat: number;
  lng: number;
  placeTitle?: string;
  placeAddress?: string;
  note?: string;
  thumb: string;
  parkedAt: number;
};

export const pairId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

// Public profile so people I share with see my name + avatar (never my email or push token).
// (My email is copied next to my phone number in `contacts`, which only friends can read, by a Cloud Function.)
export const syncProfile = (user: AppUser) =>
  setDoc(doc(db, 'profiles', user.uid), { name: nameOf(user), photoURL: user.photoURL ?? '', updatedAt: Timestamp.now() }, { merge: true });

// undefined = loading, null = no such profile
export const useProfile = (uid?: string) => {
  const { data, loading } = useLive<Profile | null>(
    uid ? `profile:${uid}` : null,
    (set) => onSnapshot(doc(db, 'profiles', uid!), (d) => set(d.exists() ? (d.data() as Profile) : null), () => set(null)),
    null,
  );
  return uid && loading ? undefined : data;
};

const NO_TRUSTS: Trust[] = [];
export const useTrustsLive = (me?: string) => {
  const { data, loading, error, refresh } = useLive<Trust[]>(
    me ? `trusts:${me}` : null,
    (set, fail) =>
      onSnapshot(
        query(collection(db, 'trusts'), where('members', 'array-contains', me)),
        (s) => set(s.docs.map((d) => ({ id: d.id, ...d.data(), other: (d.data().members as string[]).find((m) => m !== me)! }) as Trust)),
        fail,
      ),
    NO_TRUSTS,
  );
  return { items: data, loading, error, refresh };
};
export const useTrusts = (me?: string) => useTrustsLive(me).items;

// The car of someone who trusts me. undefined = loading, null = not parked (or not trusted).
export const useTrustedSpot = (other?: string, enabled = true) => {
  const { data, loading } = useLive<PublishedSpot | null>(
    other && enabled ? `spot:${other}` : null,
    (set) =>
      onSnapshot(
        doc(db, 'spots', other!),
        (d) => set(d.exists() ? ({ ...d.data(), parkedAt: d.data().parkedAt.toMillis() } as PublishedSpot) : null),
        () => set(null),
      ),
    null,
  );
  return other && enabled && loading ? undefined : data;
};

export const sendTrust = (me: Who, other: string) =>
  setDoc(doc(db, 'trusts', pairId(me.uid, other)), {
    members: [me.uid, other].sort(),
    requester: me.uid,
    status: 'pending',
    createdAt: Timestamp.now(),
  });
export const acceptTrust = (me: string, other: string) => updateDoc(doc(db, 'trusts', pairId(me, other)), { status: 'accepted' });
export const removeTrust = (me: string, other: string) => deleteDoc(doc(db, 'trusts', pairId(me, other)));

// Publish my current parking for trusted people (fire and forget; null = car picked up).
export const publishSpot = async (spot: Spot | null) => {
  const me: User | null = auth.currentUser;
  if (!me) return;
  try {
    if (!spot) return void (await deleteDoc(doc(db, 'spots', me.uid)));
    await setDoc(doc(db, 'spots', me.uid), {
      name: nameOf(me),
      lat: spot.lat,
      lng: spot.lng,
      placeTitle: spot.place?.title ?? '',
      placeAddress: spot.place?.address ?? '',
      note: spot.note ?? '',
      thumb: spot.thumb,
      parkedAt: Timestamp.fromMillis(spot.parkedAt),
      expiresAt: Timestamp.fromMillis(expiresAt(spot)),
    });
  } catch {} // offline / signed out: the next parking or app open publishes again
};

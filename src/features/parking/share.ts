import { collection, deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { Share } from 'react-native';

import type { Who } from '@/features/account/auth';
import { markSent, nameOf, patchShares, type Share as ShareDoc } from '@/features/sharing/shares';
import { db, SHARE_HOST, storage } from '@/lib/firebase';
import { trackBusy } from '@/lib/feedback';
import i18n from '@/lib/i18n';
import { expiresAt, type ShareFor, type Spot } from './model';
import { patchSpot } from './store';

// Sending my parking to someone: a link they open (shareSpot) or a friend asked to pick the car up (askPickup).

const withShare = (id: string, untilGone: boolean) => (s: Spot): Spot => ({
  ...s,
  shareIds: [...(s.shareIds ?? []), id],
  untilIds: untilGone ? [...(s.untilIds ?? []), id] : s.untilIds,
});

type Invitee = { uid: string; name: string; pickup: boolean };
const createShare = async (spot: Spot, duration: ShareFor, user: Who, invitee?: Invitee) => {
  const ref = doc(collection(db, 'shares'));
  let photoPath: string | undefined;
  try {
    const blob = await (await fetch(spot.photo)).blob();
    photoPath = `shares/${ref.id}/photo.jpg`;
    await uploadBytes(storageRef(storage, photoPath), blob, { contentType: 'image/jpeg' });
  } catch {
    photoPath = undefined; // Storage not enabled / offline: recipients still get the thumbnail
  }
  const untilGone = duration === 'until';
  await setDoc(ref, {
    ownerId: user.uid,
    ownerName: nameOf(user),
    note: spot.note ?? '',
    placeTitle: spot.place?.title ?? '',
    placeAddress: spot.place?.address ?? '',
    lat: spot.lat,
    lng: spot.lng,
    thumb: spot.thumb,
    ...(photoPath && { photoPath }),
    status: 'open',
    untilGone,
    ...(invitee && { invitee: invitee.uid, inviteeName: invitee.name, pickup: invitee.pickup }),
    sent: !!invitee, // a plain link only counts once the share sheet actually sent it (see shareSpot)
    scrubbed: false, // Cloud Functions set this once the share's photos are deleted
    parkedAt: Timestamp.fromMillis(spot.parkedAt),
    expiresAt: Timestamp.fromMillis(untilGone ? expiresAt(spot) : Date.now() + duration * 3600 * 1000),
  });
  await patchSpot(withShare(ref.id, untilGone));
  return { id: ref.id, url: `${SHARE_HOST}/s/${ref.id}` };
};

// Take back a share that was created but never sent.
const abortShare = async (id: string) => {
  deleteDoc(doc(db, 'shares', id)).catch(() => {});
  await patchSpot((s) => ({ ...s, shareIds: s.shareIds?.filter((x) => x !== id), untilIds: s.untilIds?.filter((x) => x !== id) }));
};

const linkMessage = (user: Who, duration: ShareFor, url: string) =>
  i18n.t(duration === 'until' ? 'share.messageUntil' : 'share.message', { name: user.displayName ?? user.email, hours: duration, url });

export const shareSpot = async (spot: Spot, duration: ShareFor, user: Who): Promise<boolean> => {
  const { id, url } = await trackBusy(createShare(spot, duration, user));
  const res = await Share.share({ message: linkMessage(user, duration, url) });
  // The share sheet was dismissed without sending: don't leave a "waiting for someone" share behind.
  if (res.action === Share.dismissedAction) {
    await abortShare(id);
    return false;
  }
  await markSent(id).catch(() => {});
  return true;
};

// Send the same link again (the share sheet was closed, the message got lost): still one link, one recipient.
export const resendLink = (s: ShareDoc, user: Who) =>
  Share.share({ message: linkMessage(user, s.untilGone ? 'until' : Math.max(1, Math.round((s.expiresAt - Date.now()) / 3600000)), `${SHARE_HOST}/s/${s.id}`) });

// Send the spot straight to a friend (they get a notification and only they can accept).
export const shareToFriend = async (spot: Spot, duration: ShareFor, user: Who, friend: { uid: string; name: string }) =>
  (await trackBusy(createShare(spot, duration, user, { ...friend, pickup: false }))).id;

// Ask a friend to pick the car up for me: a share only they can accept (they get a notification).
export const askPickup = async (spot: Spot, friend: string, user: Who, friendName: string) =>
  (await trackBusy(createShare(spot, 'until', user, { uid: friend, name: friendName, pickup: true }))).id;

// Change how long a share lasts, counted from now; "until the car is gone" follows the parking.
export const retimeShare = async (spot: Spot, share: ShareDoc, duration: ShareFor) => {
  const untilGone = duration === 'until';
  const [res] = await patchShares([share.id], {
    untilGone,
    expiresAt: Timestamp.fromMillis(untilGone ? expiresAt(spot) : Date.now() + duration * 3600 * 1000),
  });
  if (res.status === 'rejected') throw res.reason;
  await patchSpot((s) => ({ ...s, untilIds: [...(s.untilIds ?? []).filter((x) => x !== share.id), ...(untilGone ? [share.id] : [])] }));
};

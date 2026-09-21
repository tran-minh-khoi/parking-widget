import { File, Paths } from 'expo-file-system';

import { closeShares, extendShares, patchShares } from '@/features/sharing/shares';
import { cancelReminders, scheduleReminders } from '@/features/inbox/notify';
import { publishSpot } from '@/features/social/trust';
import { resizeJpeg } from '@/lib/image';
import { addToHistory, deleteHistoryItem, loadHistory } from './history';
import { expiresAt, isLive, type Spot } from './model';
import { lookupPlace } from './place';
import { clearSpotRecord, patchSpot, readSpot, writeSpot } from './store';
import { syncWidget, widgetThumbFile } from './surfaces';
import { startTracking, stopTracking } from './tracking';

// The lifecycle of the one active parking: save -> (note / place / renew) -> close or expire.
// Every change goes through `commit`, so the widget, lock-screen card and trusted friends never fall behind.

// A changed spot: redraw the widget / card and republish it for trusted friends.
const commit = (spot: Spot) => {
  syncWidget(spot);
  publishSpot(spot);
  return spot;
};

export const loadSpot = async (): Promise<Spot | null> => {
  const spot = await readSpot();
  if (spot && !isLive(spot)) {
    await closeSpot('expired');
    return null;
  }
  return spot;
};

export const saveSpot = async (photoUri: string, coords: { latitude: number; longitude: number }): Promise<Spot> => {
  const old = await readSpot();
  const parkedAt = Date.now();
  const [full, thumb, widget, place] = await Promise.all([
    resizeJpeg(photoUri, 1080, 0.7),
    resizeJpeg(photoUri, 360, 0.5),
    resizeJpeg(photoUri, 480, 0.6),
    lookupPlace(coords.latitude, coords.longitude),
  ]);
  const photo = new File(Paths.document, `spot-${parkedAt}.jpg`);
  new File(full.uri).copy(photo);
  const wt = widgetThumbFile();
  if (wt.exists) wt.delete();
  new File(widget.uri).copy(wt);
  if (old) new File(old.photo).delete();

  const spot: Spot = { lat: coords.latitude, lng: coords.longitude, photo: photo.uri, thumb: thumb.base64 ?? '', parkedAt, place };
  await writeSpot(spot);
  scheduleReminders(parkedAt, expiresAt(spot), true).catch(() => {});
  startTracking();
  return commit(spot);
};

export const updateNote = async (note: string): Promise<Spot | null> => {
  const next = await patchSpot((s) => ({ ...s, note: note.trim() || undefined }));
  if (next) patchShares(next.shareIds, { note: next.note ?? '' }); // the people I shared with see the new note (and get a push)
  return next && commit(next);
};

// Spot saved while offline / geocoder busy: look the place up again later.
export const ensurePlace = async (): Promise<Spot | null> => {
  const spot = await readSpot();
  if (!spot || spot.place) return spot;
  const place = await lookupPlace(spot.lat, spot.lng);
  if (!place) return spot;
  const next = { ...spot, place };
  await writeSpot(next);
  return commit(next);
};

// "The car is still here": restart the 7-day countdown and the daily reminders (needs an account: see the UI).
export const renewSpot = async (): Promise<Spot | null> => {
  const next = await patchSpot((s) => ({ ...s, renewedAt: Date.now() }));
  if (!next) return null;
  scheduleReminders(next.parkedAt, expiresAt(next)).catch(() => {});
  extendShares(next.untilIds, expiresAt(next)); // "until the car is gone" shares follow the parking
  return commit(next);
};

export const closeSpot = async (reason: 'gotCar' | 'expired' = 'gotCar') => {
  const spot = await readSpot();
  await clearSpotRecord();
  syncWidget(null);
  publishSpot(null);
  cancelReminders().catch(() => {});
  stopTracking();
  if (!spot) return;
  await addToHistory(spot, reason);
  closeShares(spot.shareIds); // recipients see "owner got the car"
};

// Account deleted: forget everything this phone kept for it (the current parking, its widget / card, reminders, History).
export const wipeLocalData = async () => {
  const spot = await readSpot();
  await clearSpotRecord();
  if (spot) new File(spot.photo).delete();
  syncWidget(null);
  cancelReminders().catch(() => {});
  stopTracking();
  for (const h of await loadHistory()) await deleteHistoryItem(h.parkedAt);
};

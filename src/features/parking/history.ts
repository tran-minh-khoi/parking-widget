import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { deleteDoc, doc } from 'firebase/firestore';

import { RETENTION } from '@/config';
import { auth, db } from '@/lib/firebase';
import type { Spot } from './model';

// History belongs to the signed-in account: guests get none (nothing is kept locally for them).
// Closed parkings are kept for 30 days, their photo for 3, and at most 100 entries.
const keyFor = () => (auth.currentUser ? `history_${auth.currentUser.uid}` : null);

const deleteFile = (uri?: string) => {
  try {
    if (uri) new File(uri).delete();
  } catch {}
};

const read = async (): Promise<Spot[]> => {
  const key = keyFor();
  return key ? JSON.parse((await AsyncStorage.getItem(key)) ?? '[]') : [];
};
const write = async (items: Spot[]) => {
  const key = keyFor();
  if (key) await AsyncStorage.setItem(key, JSON.stringify(items));
};

// Newest first, with everything past its retention already deleted.
export const loadHistory = async (): Promise<Spot[]> => {
  const all = (await read()).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const now = Date.now();
  const kept: Spot[] = [];
  for (const h of all) {
    const age = now - (h.closedAt ?? 0);
    if (kept.length >= RETENTION.historyMax || age >= RETENTION.historyRecords) deleteFile(h.photo);
    else kept.push(age >= RETENTION.historyPhotos && h.photo ? (deleteFile(h.photo), { ...h, photo: '' }) : h);
  }
  if (JSON.stringify(kept) !== JSON.stringify(all)) await write(kept);
  return kept;
};

// A parking was closed (car picked up / expired). Guests keep nothing: the photo goes with it.
export const addToHistory = async (spot: Spot, reason: 'gotCar' | 'expired') => {
  if (!keyFor()) return deleteFile(spot.photo);
  await write([{ ...spot, thumb: '', closedAt: Date.now(), closeReason: reason }, ...(await loadHistory())]);
};

// Deleting a parking also deletes its shares, so it disappears for the people it was shared with
// (Cloud Functions then remove the chat, photos and notifications).
export const deleteHistoryItem = async (parkedAt: number) => {
  const all = await read();
  const hit = all.find((h) => h.parkedAt === parkedAt);
  deleteFile(hit?.photo);
  await write(all.filter((h) => h.parkedAt !== parkedAt));
  for (const id of hit?.shareIds ?? []) deleteDoc(doc(db, 'shares', id)).catch(() => {});
};

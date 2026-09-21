import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Spot } from './model';

// The one active parking, persisted on the phone. Everything else derives from it.
const KEY = 'spot';

export const readSpot = async (): Promise<Spot | null> => JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
export const writeSpot = (spot: Spot) => AsyncStorage.setItem(KEY, JSON.stringify(spot));
export const clearSpotRecord = () => AsyncStorage.removeItem(KEY);

// read -> change -> write; null if there is no parking
export const patchSpot = async (change: (s: Spot) => Spot): Promise<Spot | null> => {
  const spot = await readSpot();
  if (!spot) return null;
  const next = change(spot);
  await writeSpot(next);
  return next;
};

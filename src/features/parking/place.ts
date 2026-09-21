import * as Location from 'expo-location';

import { AppError } from '@/lib/errors';
import i18n from '@/lib/i18n';
import type { Place } from './model';

// GPS can fail right after launch or indoors (kCLErrorLocationUnknown): fall back to the last known fix.
export const getPosition = async () => {
  try {
    return (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;
  } catch {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last.coords;
    throw new AppError(i18n.t('home.locationUnavailable'));
  }
};

// Nearest named place for a coordinate (Apple's geocoder: a mall / building name when it knows one,
// otherwise the street). No API key; swap for Google Places if POI names aren't good enough.
export const lookupPlace = async (lat: number, lng: number): Promise<Place | undefined> => {
  try {
    const lookup = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const [p] = (await Promise.race([lookup, new Promise<undefined>((r) => setTimeout(r, 4000))])) ?? [];
    if (!p) return;
    const street = [p.streetNumber, p.street].filter(Boolean).join(' ');
    const poi = p.name && !/^\d/.test(p.name) && p.name !== p.street ? p.name : undefined;
    const area = [p.district ?? p.subregion, p.city ?? p.region].filter(Boolean).join(', ');
    const title = poi ?? (street || p.district || p.city || '');
    if (!title) return;
    return { title, address: p.formattedAddress ?? [street, area].filter(Boolean).join(', ') };
  } catch {} // offline / geocoder throttled: the spot works without a name, retried on the next app open
};

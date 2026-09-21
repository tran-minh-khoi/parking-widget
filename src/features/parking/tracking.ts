import * as Location from 'expo-location';

import { meters } from '@/lib/geo';
import type { Spot } from './model';
import { setCarDistance } from './surfaces';

// Background location while a car is parked, so the lock-screen card and widget keep showing the distance
// to the car. Needs "Always" permission; without it the distance only updates while the app is open.
export const TRACK_TASK = 'car-distance';

export const startTracking = async () => {
  try {
    if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') return;
    if ((await Location.requestBackgroundPermissionsAsync()).status !== 'granted') return;
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) return;
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 30,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: false,
    });
  } catch {} // task not registered / permission dialog dismissed
};

export const stopTracking = async () => {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) await Location.stopLocationUpdatesAsync(TRACK_TASK);
  } catch {}
};

// A new location fix: how far am I from this spot?
export const handleLocation = (spot: Spot, lat: number, lng: number) => setCarDistance(spot, meters(spot, { lat, lng }));

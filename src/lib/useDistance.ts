import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { meters } from '@/lib/geo';

// Straight-line distance from me to a point, refreshed every 15s while the screen is mounted.
export const useDistance = (lat?: number, lng?: number) => {
  const [m, setM] = useState<number>();
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let alive = true;
    const tick = async () => {
      try {
        if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') return;
        const p =
          (await Location.getLastKnownPositionAsync({ maxAge: 60000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (alive) setM(meters({ lat, lng }, { lat: p.coords.latitude, lng: p.coords.longitude }));
      } catch {} // no permission / no fix: just don't show a distance
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [lat, lng]);
  return m;
};

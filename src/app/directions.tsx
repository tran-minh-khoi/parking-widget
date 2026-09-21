import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useDirections } from '@/features/directions/DirectionsSheet';
import { C } from '@/lib/theme';

// Deep link from a widget / the lock-screen card when no maps app has been chosen yet:
// myparking://directions?lat=..&lng=.. shows the chooser over a blank screen.
export default function Directions() {
  const { lat, lng, label } = useLocalSearchParams<{ lat: string; lng: string; label?: string }>();
  const router = useRouter();
  const { go, sheet } = useDirections(() => router.replace('/'));
  useEffect(() => void go(Number(lat), Number(lng), label), [lat, lng, label]);
  return <View style={{ flex: 1, backgroundColor: C.bg }}>{sheet}</View>;
}

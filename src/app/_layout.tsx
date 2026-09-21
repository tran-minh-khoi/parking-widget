import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/lib/i18n';
import { useUser } from '@/features/account/auth';
import { loadLang } from '@/lib/i18n';
import { loadNavPref } from '@/features/directions/nav';
import { setupNotifications } from '@/features/inbox/notify';
import { loadHistory } from '@/features/parking/history';
import { loadSpot } from '@/features/parking/spot';
import { setPickup, setSharedSpot, syncWidget } from '@/features/parking/surfaces';
import { startTracking } from '@/features/parking/tracking';
import { registerPush } from '@/features/inbox/notify';
import { isPickup, useMyShares } from '@/features/sharing/shares';
import { publishSpot, syncProfile } from '@/features/social/trust';
import { BusyOverlay, DoneToast } from '@/lib/feedback';
import { C } from '@/lib/theme';

export default function RootLayout() {
  const router = useRouter();
  const user = useUser();
  const handled = useRef(new Set<string>());

  // The photo widget also shows a spot shared with me that I accepted (until it's picked up / closed).
  const { received, owned } = useMyShares(user?.uid);

  // Widget / lock-screen line: which friend I asked to pick the car up, and whether they agreed.
  useEffect(() => {
    loadSpot().then((spot) => {
      const req = spot && owned.find((s) => isPickup(s) && spot.shareIds?.includes(s.id) && ['open', 'accepted', 'declined'].includes(s.status));
      setPickup(req ? { name: req.inviteeName || req.recipientName || '', status: req.status as 'open' | 'accepted' | 'declined' } : null);
    });
  }, [owned]);
  const active = received.find((s) => s.status === 'accepted' && s.expiresAt > Date.now() && s.lat != null) ?? null;
  useEffect(() => void setSharedSpot(active), [active?.id, active?.note, active?.placeTitle]);

  // Push token for "accepted / new message / picked up" (Cloud Functions send them).
  useEffect(() => {
    if (!user) return;
    registerPush(user).catch(() => {}); // fails on simulators / when permission is denied
    loadSpot().then(publishSpot); // trusted people see a car that was parked before I signed in
  }, [user?.uid]);
  // Public profile (name + avatar) for the people I share with; follows edits in Account.
  useEffect(() => {
    if (user) syncProfile(user).catch(() => {});
  }, [user?.uid, user?.displayName, user?.photoURL]);

  useEffect(() => {
    loadLang().then(setupNotifications);
    loadNavPref()
      .then(loadSpot)
      .then((s) => {
        syncWidget(s); // keep widget + lock-screen card fresh (needs the chosen maps app)
        if (s) startTracking(); // background distance updates
      });
    loadHistory(); // purge history older than 24h
  }, []);

  // Notification taps, also from a cold start: open the share, or run the reminder button.
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const key = `${last.notification.request.identifier}:${last.actionIdentifier}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    const shareId = last.notification.request.content.data?.shareId;
    const refUid = last.notification.request.content.data?.refUid;
    if (typeof shareId === 'string') router.push({ pathname: '/s/[id]', params: { id: shareId } });
    else if (typeof refUid === 'string') router.push({ pathname: '/profile/[uid]', params: { uid: refUid } });
    else if (last.actionIdentifier === 'got') router.push('/gotcar'); // confirm first
    else if (last.actionIdentifier === 'renew') router.push('/renew');
  }, [last, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
      <DoneToast />
      <BusyOverlay />
    </GestureHandlerRootView>
  );
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDirections } from '@/features/directions/DirectionsSheet';
import { HeaderAvatar, HeaderBell } from '@/components/HeaderButtons';
import { ImageViewer } from '@/components/ImageViewer';
import { Screen } from '@/components/Screen';
import { ActionButton, Button, Chip, CircleButton, Loading, st } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { useDistance } from '@/lib/useDistance';
import { useUser } from '@/features/account/auth';
import { closeSpot, ensurePlace, loadSpot, renewSpot, saveSpot, updateNote } from '@/features/parking/spot';
import { expiresAt, type ShareFor, type Spot } from '@/features/parking/model';
import { getPosition } from '@/features/parking/place';
import { loadHistory } from '@/features/parking/history';
import { setCarDistance } from '@/features/parking/surfaces';
import { resendLink, shareSpot, shareToFriend } from '@/features/parking/share';
import { ActiveShares, activeShares } from '@/features/sharing/ActiveShares';
import { DurationSheet, type Friend } from '@/features/sharing/DurationSheet';
import { useMyShares } from '@/features/sharing/shares';
import { DAY } from '@/config';
import { dateTime } from '@/lib/time';
import { C, SQUIRCLE } from '@/lib/theme';
import { confirm, perform, showDone, showError } from '@/lib/feedback';
import { AppError } from '@/lib/errors';

export default function Home() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { share: shareParam } = useLocalSearchParams<{ share?: string }>();
  const user = useUser();
  const { owned } = useMyShares(user?.uid);
  const cam = useRef<CameraView>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [lastClosed, setLastClosed] = useState<Spot>();
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [noteD, setNoteD] = useState<string>(); // note draft; undefined = untouched
  const distance = useDistance(spot?.lat, spot?.lng);
  const { go, sheet: directionsSheet } = useDirections();

  // Keep the lock-screen card / widget distance in step while the app is open (coarse: 10 m steps).
  const step = distance === undefined ? undefined : Math.round(distance / 10);
  useEffect(() => {
    if (spot && distance !== undefined) setCarDistance(spot, distance);
  }, [step, spot?.parkedAt]);

  const refresh = useCallback(() => {
    loadSpot().then((s) => {
      setSpot(s);
      if (s && !s.place) ensurePlace().then((n) => n?.place && setSpot(n)); // retry a failed place lookup
    });
    loadHistory().then((h) => setLastClosed(h[0]));
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  useEffect(() => setNoteD(undefined), [spot?.parkedAt]); // a new parking starts with a clean note field

  // Recipient tapped "I got the car": close my parking too.
  useEffect(() => {
    const done = spot && owned.find((sh) => spot.shareIds?.includes(sh.id) && sh.status === 'pickedUp');
    if (!done) return;
    closeSpot().then(refresh);
    showDone(t('shared.ownerPickedUp', { name: done.recipientName }));
  }, [owned, spot, t, refresh]);

  // opened from the widget / lock-screen "Share" button
  useEffect(() => {
    if (shareParam && spot) setSheet(true);
  }, [shareParam, spot?.parkedAt]);

  const snap = async () => {
    if (busy || !cam.current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new AppError(t('home.locationNeeded'));
      const [pic, pos] = await Promise.all([cam.current.takePictureAsync({ quality: 0.8 }), getPosition()]);
      setSpot(await saveSpot(pic.uri, pos));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const shared = activeShares(owned, spot?.shareIds);
  const gotCar = () =>
    confirm({
      title: t('home.gotCarTitle'),
      message: shared.length ? t('home.gotCarShared', { count: shared.length }) : t('home.gotCarMessage'),
      action: t('home.gotCar'),
      onConfirm: () => perform(closeSpot().then(refresh), t('home.gotCarDone')),
    });

  const renewNow = () => perform(renewSpot().then(setSpot), t('home.renewed'));
  const renew = () =>
    !user
      ? // guests get 7 days and no extension: renewing needs an account
        confirm({ title: t('home.renewLoginTitle'), message: t('home.renewLoginBody'), action: t('account.signIn'), destructive: false, onConfirm: () => router.push('/login') })
      : confirm({ title: t('home.renewTitle'), message: t('home.renewMessage'), action: t('home.stillHere'), destructive: false, onConfirm: renewNow });

  // A link works for one person, so while my last link is still waiting for someone there is no point in a second one.
  const waiting = shared.find((x) => x.status === 'open' && !x.invitee && x.sent !== false);
  const share = async (duration: ShareFor, friend?: Friend) => {
    if (!spot) return;
    if (!user) return router.push('/login');
    if (!friend && waiting)
      return confirm({ title: t('share.waitingTitle'), message: t('share.waitingBody'), action: t('share.sendAgain'), destructive: false, onConfirm: () => resendLink(waiting, user).catch(() => {}) });
    try {
      if (friend) {
        await shareToFriend(spot, duration, user, friend);
        showDone(t('share.sentTo', { name: friend.name }));
      } else if (await shareSpot(spot, duration, user)) showDone(t('share.sentLink'));
      refresh();
    } catch (e) {
      showError(e);
    }
  };

  // main screen: bell on the left, avatar on the right
  const header = { title: 'My Parking', left: <HeaderBell />, right: <HeaderAvatar /> };

  // still reading the saved parking / the camera permission: a spinner, not an empty (or wrong) page
  if (spot === undefined || (!spot && camPerm === null)) return <Screen header={header} tabbed><Loading /></Screen>;

  if (!spot) {
    return (
      <Screen header={header} tabbed>
        {camPerm?.granted ? (
          <>
            <View style={s.finder}>
              <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
              <CircleButton
                icon={flash === 'on' ? 'flash' : 'flash-off'}
                size={42}
                bg="rgba(10,10,10,0.55)"
                color={flash === 'on' ? C.gold : C.text}
                style={s.flashBtn}
                onPress={() => setFlash(flash === 'on' ? 'off' : 'on')}
              />
            </View>
            <Text style={st.hint}>{t('home.hint')}</Text>
            <View style={s.controls}>
              <Pressable style={s.thumb} onPress={() => router.navigate('/history')}>
                {lastClosed?.photo ? <Image source={lastClosed.photo} style={StyleSheet.absoluteFill} /> : <Ionicons name="time-outline" size={26} color={C.muted} />}
              </Pressable>
              <Pressable style={s.shutterRing} onPress={snap}>
                {busy ? <ActivityIndicator color={C.bg} /> : <View style={s.shutter} />}
              </Pressable>
              <CircleButton icon="camera-reverse-outline" size={56} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} />
            </View>
          </>
        ) : (
          <View style={s.center}>
            <Ionicons name="camera-outline" size={56} color={C.gold} />
            <Text style={[st.hint, { fontSize: 16 }]}>{t('home.cameraNeeded')}</Text>
            <Button label={t('home.grant')} onPress={askCam} />
          </View>
        )}
      </Screen>
    );
  }

  const time = new Date(spot.parkedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((Date.now() - spot.parkedAt) / DAY);
  const noteVal = noteD ?? spot.note ?? '';
  const noteDirty = noteVal.trim() !== (spot.note ?? '');
  const saveNote = () => {
    if (!noteDirty) return;
    return updateNote(noteVal).then((n) => {
      if (n) setSpot(n);
      setNoteD(undefined);
      Keyboard.dismiss();
      showDone(t('home.noteSaved'));
    });
  };
  const expires = expiresAt(spot);
  return (
    <Screen header={header} tabbed scroll>
        <Pressable style={s.finder} onPress={() => setViewer(true)} accessibilityLabel={t('shared.viewPhoto')}>
          <Image source={spot.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Chip icon="time-outline" text={days ? `${t('home.parkedAt', { time })} · ${t('home.days', { count: days })}` : t('home.parkedAt', { time })} style={s.chipTL} />
          {distance !== undefined && <Chip icon="walk" text={formatDistance(distance)} style={s.chipTR} />}
          {spot.place && <Chip icon="location" text={spot.place.title} style={s.chipBL} />}
        </Pressable>
        <ImageViewer uri={spot.photo} visible={viewer} onClose={() => setViewer(false)} />

        {spot.place?.address && spot.place.address !== spot.place.title ? <Text style={s.placeAddress}>{spot.place.address}</Text> : null}

        <View style={s.noteRow}>
          <TextInput
            style={[st.input, { flex: 1 }]}
            value={noteVal}
            onChangeText={setNoteD}
            placeholder={t('home.notePlaceholder')}
            placeholderTextColor={C.muted}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={saveNote}
          />
          <CircleButton icon="checkmark" size={50} bg={noteDirty ? C.gold : C.card} color={noteDirty ? C.bg : C.muted} onPress={saveNote} />
        </View>

        <Button label={t('home.navigate')} icon="navigate" onPress={() => go(spot.lat, spot.lng, spot.place?.title || spot.note)} />

        <View style={s.actions}>
          <ActionButton icon="share-outline" label={t('share.button')} onPress={() => setSheet(true)} />
          <ActionButton icon="refresh" label={t('home.stillHere')} onPress={renew} />
          <ActionButton icon="checkmark-done" label={t('home.gotCar')} onPress={gotCar} color={C.ok} />
        </View>

        <ActiveShares shares={shared} spot={spot} />

        {/* exact moment the parking is forgotten, then what to do about it (on its own line) */}
        <Text style={st.hint}>{`${t('home.expiresOn', { when: dateTime(expires) })}\n${t(user ? 'home.extendHint' : 'home.extendGuest')}`}</Text>

      {directionsSheet}
      <DurationSheet visible={sheet} friends title={t('share.sheetTitle')} onClose={() => setSheet(false)} onPick={share} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  finder: { width: '100%', aspectRatio: 1, backgroundColor: C.card, ...SQUIRCLE },
  flashBtn: { position: 'absolute', top: 16, left: 16 },
  chipTL: { position: 'absolute', left: 16, top: 16 },
  chipTR: { position: 'absolute', right: 16, top: 16 },
  chipBL: { position: 'absolute', left: 16, bottom: 16, maxWidth: '75%' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  thumb: { width: 56, height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: C.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.text },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeAddress: { color: C.muted, fontSize: 13, paddingHorizontal: 4 },
  actions: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4 },
});

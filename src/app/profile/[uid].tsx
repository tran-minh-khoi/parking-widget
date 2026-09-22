import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDirections } from '@/features/directions/DirectionsSheet';
import { HeaderBack } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { useUser } from '@/features/account/auth';
import { AliasModal } from '@/features/social/AliasModal';
import { acceptFriend, removeFriend, saveAlias, sendFriend, useAlias, useContact, useFriendsLive } from '@/features/social/friends';
import { ImageViewer } from '@/components/ImageViewer';
import { askPickup } from '@/features/parking/share';
import { loadSpot } from '@/features/parking/spot';
import { type Spot } from '@/features/parking/model';
import { C, SQUIRCLE } from '@/lib/theme';
import { dayLabel, hhmm } from '@/lib/time';
import { acceptTrust, removeTrust, sendTrust, useProfile, useTrustedSpot, useTrusts } from '@/features/social/trust';
import { Avatar, Button, Chip, CircleButton, st } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { useDistance } from '@/lib/useDistance';
import { confirm, perform } from '@/lib/feedback';

// One labelled line of a friend's details; tappable when it does something (call).
function InfoRow({ icon, label, value, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable style={s.infoRow} onPress={onPress} disabled={!onPress}>
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={18} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, onPress && { color: C.gold }]}>{value}</Text>
      </View>
    </Pressable>
  );
}

// A person: public profile, friendship, and once friends the extras (trust, "pick my car up for me").
export default function Profile() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const me = useUser();
  const profile = useProfile(uid);
  const { items: friendList, loading: friendsLoading } = useFriendsLive(me?.uid);
  const friend = friendList.find((x) => x.other === uid);
  const friends = friend?.status === 'accepted';
  const contact = useContact(friends ? uid : undefined);
  const phone = contact?.phone;
  const alias = useAlias(uid);
  const [editName, setEditName] = useState(false);
  const [viewing, setViewing] = useState<string>();
  const trust = useTrusts(me?.uid).find((x) => x.other === uid);
  const trusted = trust?.status === 'accepted';
  const spot = useTrustedSpot(uid, trusted);
  const distance = useDistance(spot?.lat, spot?.lng);
  const { go, sheet } = useDirections();
  const [mine, setMine] = useState<Spot | null>(null);
  useEffect(() => void loadSpot().then(setMine), []);

  const real = profile?.name ?? '…';
  const name = alias || real; // my nickname for them, if I gave one

  // Buttons already show their own spinner while the promise runs, so they skip the overlay.
  const act = (work: Promise<unknown>, done: string) => perform(work, done, false);

  const confirmUnfriend = () =>
    confirm({
      title: t('friends.removeTitle', { name }),
      message: t(trusted ? 'friends.removeTrustedBody' : 'friends.removeBody', { name }),
      action: t('friends.remove'),
      onConfirm: () => me && perform(removeFriend(me.uid, uid), t('friends.removed', { name })),
    });
  const confirmUntrust = () =>
    confirm({
      title: t('trust.removeTitle', { name }),
      message: t('trust.removeBody'),
      action: t('trust.remove'),
      onConfirm: () => me && perform(removeTrust(me.uid, uid), t('trust.removedDone', { name })),
    });
  // Ask this friend to pick the car up: they get a notification and must approve.
  const requestPickup = () =>
    confirm({
      title: t('pickup.confirmTitle', { name }),
      message: t('pickup.confirmBody', { name }),
      action: t('pickup.send'),
      destructive: false,
      onConfirm: () =>
        me && mine && perform(askPickup(mine, uid, me, real).then((id) => router.push({ pathname: '/s/[id]', params: { id } })), t('pickup.sent', { name })),
    });

  if (profile === undefined) return <Screen header={{ left: <HeaderBack /> }}><ActivityIndicator color={C.gold} style={{ marginTop: 80 }} /></Screen>;

  return (
    <Screen
      header={{ title: name, left: <HeaderBack />, right: friends ? <CircleButton icon="person-remove-outline" size={44} color={C.danger} onPress={confirmUnfriend} /> : undefined }}
      scroll
    >
      {sheet}
      <ImageViewer uri={viewing} visible={!!viewing} onClose={() => setViewing(undefined)} />
      <AliasModal
        visible={editName}
        realName={real}
        initial={alias ?? ''}
        onClose={() => setEditName(false)}
        onSave={(a) => me && perform(saveAlias(me.uid, uid, a).then(() => setEditName(false)), t(a.trim() ? 'alias.saved' : 'alias.cleared', { name: a.trim() }), false)
        }
      />
        <View style={s.top}>
          <Pressable disabled={!profile?.photoURL} onPress={() => setViewing(profile?.photoURL)}>
            <Avatar user={profile ? { displayName: profile.name, email: null, photoURL: profile.photoURL || null } : null} size={110} />
          </Pressable>
          <View style={s.nameRow}>
            <Text style={st.title}>{name}</Text>
            {friends && (
              <Pressable onPress={() => setEditName(true)} hitSlop={10} accessibilityLabel={t('alias.title')}>
                <Ionicons name="create-outline" size={22} color={C.gold} />
              </Pressable>
            )}
          </View>
          {alias ? <Text style={s.realName}>{t('alias.real', { name: real })}</Text> : null}
          <View style={s.chips}>
            {friends && <Chip icon="people" text={t('friends.friends')} style={{ backgroundColor: C.card }} />}
            {trusted && <Chip icon="shield-checkmark" text={t('trust.trusted')} style={{ backgroundColor: C.card }} />}
            {trusted && spot !== undefined && <Chip icon={spot ? 'car' : 'car-outline'} text={t(spot ? 'trust.parkedNow' : 'trust.notParkedShort')} style={{ backgroundColor: C.card }} />}
          </View>
          {!friends && profile?.about ? <Text style={s.about}>{profile.about}</Text> : null}
        </View>

        {/* friends see everything this person filled in */}
        {friends && (
          <View style={s.info}>
            {contact?.email ? <InfoRow icon="mail" label={t('profile.email')} value={contact.email} onPress={() => Linking.openURL(`mailto:${contact.email}`)} /> : null}
            {phone ? <InfoRow icon="call" label={t('profile.phone')} value={phone} onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
            {profile?.gender ? <InfoRow icon={profile.gender === 'female' ? 'female' : profile.gender === 'male' ? 'male' : 'person'} label={t('profile.gender')} value={t(`account.${profile.gender}`)} /> : null}
            {profile?.about ? <InfoRow icon="document-text" label={t('profile.about')} value={profile.about} /> : null}
            {!phone && !contact?.email && !profile?.gender && !profile?.about ? <Text style={st.hint}>{t('profile.noInfo', { name })}</Text> : null}
          </View>
        )}

        {!me ? (
          <Button label={t('account.signIn')} onPress={() => router.push('/login')} />
        ) : me.uid === uid ? null : friendsLoading && !friend ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} />
        ) : !friend ? (
          <>
            <Text style={st.hint}>{t('friends.explain')}</Text>
            <Button label={t('friends.add')} icon="person-add-outline" onPress={() => act(sendFriend(me, uid), t('friends.requestSent', { name }))} />
          </>
        ) : friend.status === 'pending' && friend.requester === me.uid ? (
          <>
            <Text style={st.hint}>{t('friends.waiting', { name })}</Text>
            <Button variant="dark" label={t('friends.cancel')} onPress={() => act(removeFriend(me.uid, uid), t('friends.requestCancelled'))} />
          </>
        ) : friend.status === 'pending' ? (
          <>
            <Text style={st.hint}>{t('friends.invited', { name })}</Text>
            <Button label={t('friends.accept')} icon="checkmark-circle" onPress={() => act(acceptFriend(me.uid, uid), t('friends.nowFriends', { name }))} />
            <Button variant="dark" label={t('friends.decline')} onPress={() => act(removeFriend(me.uid, uid), t('friends.requestDeclined'))} />
          </>
        ) : (
          <>
            {mine && <Button label={t('pickup.ask', { name })} icon="car-outline" onPress={requestPickup} />}

            {/* trust: needs friendship first */}
            {!trust ? (
              <View style={{ gap: 8 }}>
                <Text style={st.hint}>{t('trust.explain')}</Text>
                <Button variant="dark" label={t('trust.send')} icon="shield-checkmark-outline" onPress={() => act(sendTrust(me, uid), t('trust.requestSent', { name }))} />
              </View>
            ) : trust.status === 'pending' && trust.requester === me.uid ? (
              <View style={{ gap: 8 }}>
                <Text style={st.hint}>{t('trust.waiting', { name })}</Text>
                <Button variant="dark" label={t('trust.cancel')} onPress={() => act(removeTrust(me.uid, uid), t('trust.requestCancelled'))} />
              </View>
            ) : trust.status === 'pending' ? (
              <View style={{ gap: 8 }}>
                <Text style={st.hint}>{t('trust.invited', { name })}</Text>
                <Button label={t('trust.accept')} icon="checkmark-circle" onPress={() => act(acceptTrust(me.uid, uid), t('trust.nowTrusted', { name }))} />
                <Button variant="dark" label={t('trust.decline')} onPress={() => act(removeTrust(me.uid, uid), t('trust.requestDeclined'))} />
              </View>
            ) : spot === undefined ? (
              <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} />
            ) : spot ? (
              <View style={{ gap: 12 }}>
                <Text style={st.section}>{t('trust.currentCar')}</Text>
                <Pressable style={s.photo} onPress={() => setViewing(`data:image/jpeg;base64,${spot.thumb}`)}>
                  <Image source={`data:image/jpeg;base64,${spot.thumb}`} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <Chip icon="time-outline" text={`${dayLabel(spot.parkedAt)} ${hhmm(spot.parkedAt)}`} style={s.chipBL} />
                  {distance !== undefined && <Chip icon="walk" text={formatDistance(distance)} style={s.chipTR} />}
                </Pressable>
                {spot.placeTitle ? <Text style={st.title}>{spot.placeTitle}</Text> : null}
                {spot.placeAddress && spot.placeAddress !== spot.placeTitle ? <Text style={s.address}>{spot.placeAddress}</Text> : null}
                {spot.note ? <Text style={s.note}>{spot.note}</Text> : null}
                <Button label={t('home.navigate')} icon="navigate" onPress={() => go(spot.lat, spot.lng, spot.placeTitle || spot.note)} />
              </View>
            ) : (
              <View style={s.center}>
                <Ionicons name="car-outline" size={44} color={C.muted} />
                <Text style={st.hint}>{t('trust.notParked', { name })}</Text>
              </View>
            )}
            {trusted && <Button variant="dark" label={t('trust.remove')} icon="shield-outline" onPress={confirmUntrust} />}
          </>
        )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
  top: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, // Friends / Trusted / Parked on one row, wrapping only when they don't fit
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  realName: { color: C.muted, fontSize: 13 },
  about: { color: C.text, fontSize: 15, textAlign: 'center', paddingHorizontal: 12 },
  info: { backgroundColor: C.card, borderRadius: 24, borderCurve: 'continuous', padding: 14, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: C.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { color: C.text, fontSize: 16, fontWeight: '600', marginTop: 1 },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: C.card, ...SQUIRCLE },
  chipBL: { position: 'absolute', left: 16, bottom: 16 },
  chipTR: { position: 'absolute', right: 16, top: 16 },
  address: { color: C.muted, fontSize: 14 },
  note: { color: C.gold, fontSize: 18, fontWeight: '800' },
});

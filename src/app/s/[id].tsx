import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDirections } from '@/features/directions/DirectionsSheet';
import { HeaderBack } from '@/components/HeaderButtons';
import { ImageViewer } from '@/components/ImageViewer';
import { Screen } from '@/components/Screen';
import { acceptFriend, removeFriend, sendFriend, useAlias, useFriends } from '@/features/social/friends';
import { useUser } from '@/features/account/auth';
import { deleteOn, hasEnded, timelineOf, timelineText, type TimelineEntry } from '@/features/sharing/timeline';
import { acceptShare, declineShare, isPickup, markPickedUp, photoUrl, sendMessage, sendPhoto, useMessages, useShare } from '@/features/sharing/shares';
import { C, PAD, SQUIRCLE } from '@/lib/theme';
import { dateFull, dayLabel, formatWhen, hhmm, timeLeft } from '@/lib/time';
import { confirm, perform, showError } from '@/lib/feedback';
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/features/social/trust';
import { UserAvatar } from '@/components/Person';
import { Button, Chip, CircleButton, st, type IconName } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { useDistance } from '@/lib/useDistance';

// A photo sent in the chat: resolve its download URL lazily.
function ChatPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  const [open, setOpen] = useState(false);
  useEffect(() => void photoUrl(path).then(setUrl).catch(() => {}), [path]);
  return (
    <>
      <Pressable onPress={() => url && setOpen(true)} style={[s.chatPhoto, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.card2 }]}>
        {!url && <ActivityIndicator color={C.muted} />}
        {url ? <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </Pressable>
      <ImageViewer uri={url} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

// In the chat: the other person isn't a friend yet? Offer to become friends (or answer their request).
function FriendBanner({ me, other, name }: { me: { uid: string; displayName: string | null; email: string | null }; other: string; name: string }) {
  const { t } = useTranslation();
  const friend = useFriends(me.uid).find((f) => f.other === other);
  if (friend?.status === 'accepted') return null;
  const act = (work: Promise<unknown>, done: string) => perform(work, done, false); // the Button shows the spinner
  const incoming = friend?.status === 'pending' && friend.requester !== me.uid;
  return (
    <View style={s.friendBox}>
      <Ionicons name="person-add-outline" size={22} color={C.gold} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={s.friendText}>
          {!friend ? t('friends.chatAsk', { name }) : incoming ? t('friends.invited', { name }) : t('friends.waiting', { name })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!friend ? (
            <Button label={t('friends.add')} onPress={() => act(sendFriend(me, other), t('friends.requestSent', { name }))} style={s.friendBtn} />
          ) : incoming ? (
            <>
              <Button label={t('friends.acceptShort')} onPress={() => act(acceptFriend(me.uid, other), t('friends.nowFriends', { name }))} style={s.friendBtn} />
              <Button variant="dark" label={t('friends.declineShort')} onPress={() => act(removeFriend(me.uid, other), t('friends.requestDeclined'))} style={s.friendBtn} />
            </>
          ) : (
            <Button variant="dark" label={t('friends.cancel')} onPress={() => act(removeFriend(me.uid, other), t('friends.requestCancelled'))} style={s.friendBtn} />
          )}
        </View>
      </View>
    </View>
  );
}

const EVENT_ICON: Record<TimelineEntry['t'], IconName> = {
  shared: 'paper-plane-outline',
  asked: 'car-outline',
  accepted: 'checkmark-circle-outline',
  pickedUp: 'checkmark-done-circle',
  declined: 'close-circle-outline',
  closed: 'lock-closed-outline',
  revoked: 'remove-circle-outline',
  expired: 'time-outline',
};

// A line in the conversation that isn't a message: who did what, and when.
function EventRow({ entry, text }: { entry: TimelineEntry; text: string }) {
  const tone = entry.t === 'pickedUp' ? C.ok : entry.t === 'declined' ? C.danger : C.muted;
  return (
    <View style={s.event}>
      <Ionicons name={EVENT_ICON[entry.t]} size={16} color={tone} />
      <Text style={[s.eventText, { color: tone === C.muted ? C.text : tone }]}>{text}</Text>
      <Text style={s.eventTime}>{hhmm(entry.at)}</Text>
    </View>
  );
}

// One share = owner ↔ one recipient. Opened from the link (universal link), a push or the Sharing tab.
export default function SharedSpot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const share = useShare(id);
  const distance = useDistance(share?.lat ?? undefined, share?.lng ?? undefined);
  const { go, sheet: directionsSheet } = useDirections();
  const [full, setFull] = useState<string>();
  const [viewer, setViewer] = useState(false);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);

  const isOwner = !!user && share?.ownerId === user.uid;
  const isRecipient = !!user && share?.recipientId === user.uid;
  const member = isOwner || isRecipient;
  const now = useNow();
  const windowOpen = !!share && share.expiresAt > now;
  const active = member && share?.status === 'accepted' && windowOpen; // can chat
  const showChat = member && !!share && share.status !== 'open'; // ended chats stay readable
  const { messages: msgs, loading: msgsLoading } = useMessages(id, showChat);
  const otherUid = isOwner ? share?.recipientId : share?.ownerId;
  const other = useProfile(user && otherUid ? otherUid : undefined);
  const alias = useAlias(otherUid);
  const invitee = useProfile(share?.invitee);
  const isInvitee = !!user && !!share?.invitee && share.invitee === user.uid;

  useEffect(() => {
    if (member && share?.photoPath) photoUrl(share.photoPath).then(setFull).catch(() => {});
  }, [member, share?.photoPath]);
  // The conversation: chat messages and everything that happened to the share (asked, agreed, picked up...), oldest first.
  const canSeeHistory = member || isInvitee;
  const items = [
    ...msgs.map((m) => ({ kind: 'msg' as const, key: m.id, at: m.createdAt, m })),
    ...(share && canSeeHistory ? timelineOf(share).map((e, i) => ({ kind: 'event' as const, key: `e${i}`, at: e.at, e })) : []),
  ].sort((a, b) => a.at - b.at);
  useEffect(() => void scroll.current?.scrollToEnd({ animated: true }), [items.length]);

  if (share === undefined) return <Screen header={{ left: <HeaderBack /> }}><ActivityIndicator color={C.gold} style={{ marginTop: 80 }} /></Screen>;
  if (!share) {
    return (
      <Screen header={{ left: <HeaderBack /> }}>
        <View style={s.center}>
          <Ionicons name="link-outline" size={48} color={C.muted} />
          <Text style={st.hint}>{t('shared.gone')}</Text>
        </View>
      </Screen>
    );
  }

  // a friend asked to pick the car up: only they can accept; anyone else with the link cannot
  const pickup = isPickup(share);
  const left = windowOpen && !share.untilGone && (share.status === 'open' || share.status === 'accepted') ? t('shared.left', { time: timeLeft(share.expiresAt - now) }) : '';
  const canAccept = share.status === 'open' && !isOwner && windowOpen && (!share.invitee || isInvitee);
  const hasLocation = share.lat != null && share.lng != null && (isOwner || windowOpen);
  const state =
    share.status === 'pickedUp' ? t('shared.pickedUp', { name: share.recipientName, time: formatWhen(share.pickedUpAt ?? Date.now()) })
    : share.status === 'closed' ? t('shared.closed')
    : share.status === 'revoked' ? t('shared.revoked', { name: share.ownerName })
    : share.status === 'declined' ? t('shared.declined', { name: invitee?.name ?? '…' })
    : !windowOpen ? t('shared.expired')
    : share.status === 'open' && isInvitee ? t(pickup ? 'shared.askedYou' : 'shared.friendShared', { name: share.ownerName })
    : share.status === 'open' && isOwner && share.invitee ? t('shared.waitingFor', { name: invitee?.name ?? '…' })
    : share.status === 'accepted' ? t('shared.acceptedBy', { name: share.recipientName })
    : isOwner ? t('shared.waiting')
    : !member && share.status !== 'open' ? t('shared.taken')
    : !member && share.invitee ? t('shared.privateInvite')
    : share.untilGone ? t('shared.untilGone')
    : t('shared.until', { time: formatWhen(share.expiresAt) });

  const accept = () => (user ? perform(acceptShare(id, user), t('shared.acceptedDone'), false) : router.push('/login'));
  const takePhoto = async () => {
    if (!user) return;
    try {
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!shot.canceled) await perform(sendPhoto(id, user, shot.assets[0].uri)); // resize + upload; it then shows in the chat
    } catch (e) {
      showError(e);
    }
  };
  // The chat closes once the car is picked up, so offer the "here it is" photo first.
  const finish = () => perform(markPickedUp(id), t('shared.pickedDone'));
  const askPhoto = () =>
    confirm({
      title: t('shared.photoPromptTitle'),
      message: t('shared.photoPromptBody'),
      action: t('shared.takePhoto'),
      cancelLabel: t('shared.skip'),
      destructive: false,
      onCancel: finish,
      onConfirm: () => takePhoto().then(finish),
    });
  const gotIt = () =>
    confirm({ title: t('shared.confirmTitle'), message: t('shared.confirmBody'), action: t('shared.iGotIt'), destructive: false, onConfirm: askPhoto });
  // The person who agreed to pick the car up is busy: withdraw (the owner is notified).
  const withdraw = () =>
    confirm({
      title: t('shared.withdrawTitle'),
      message: t('shared.withdrawBody'),
      action: t('shared.withdraw'),
      onConfirm: () => perform(declineShare(id), t('shared.withdrawnDone')),
    });
  const send = () => {
    if (!user || !text.trim()) return;
    sendMessage(id, user, text).catch(showError);
    setText('');
  };

  // the title is the person on the other side of this conversation (tap it for their profile)
  const title = alias || (isOwner ? share.recipientName : share.ownerName) || t('sharing.noRecipient');
  const carPhoto = full ?? (share.thumb ? `data:image/jpeg;base64,${share.thumb}` : undefined);
  // The person picking the car up gets everything for the job above the message box:
  // the car photo (tap to enlarge), the way to the car, "picked it up", and "I can't".
  const pickupBar =
    isRecipient && active ? (
      <View style={s.pickupBar}>
        <Pressable onPress={() => setViewer(true)} style={s.carThumb} accessibilityLabel={t('shared.viewPhoto')}>
          <Image source={carPhoto} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Pressable>
        {hasLocation && <Button compact variant="dark" icon="navigate" label={t('shared.toCar')} onPress={() => go(share.lat!, share.lng!, share.placeTitle || share.note)} style={s.barButton} />}
        <Button compact icon="checkmark-done" label={t('shared.pickedForThem')} onPress={gotIt} style={s.barButton} />
        <CircleButton icon="close" size={50} bg={C.card} color={C.danger} onPress={withdraw} />
      </View>
    ) : null;
  const inputRow = (
    <View style={s.inputRow}>
      <CircleButton icon="camera" size={50} onPress={takePhoto} />
      <TextInput
        style={[st.input, { flex: 1 }]}
        value={text}
        onChangeText={setText}
        placeholder={t('shared.typeHere')}
        placeholderTextColor={C.muted}
        maxLength={500}
        onSubmitEditing={send}
        returnKeyType="send"
      />
      <CircleButton icon="arrow-up" size={50} bg={C.gold} color={C.bg} onPress={send} />
    </View>
  );
  const footer = active ? (
    <View style={{ gap: 10 }}>
      {pickupBar}
      {inputRow}
    </View>
  ) : undefined;

  return (
    <Screen
      header={{
        title,
        titleLeft: user && otherUid ? <UserAvatar uid={otherUid} size={30} name={title} /> : undefined,
        left: <HeaderBack />,
        onTitlePress: user && otherUid ? () => router.push({ pathname: '/profile/[uid]', params: { uid: otherUid } }) : undefined,
      }}
      scroll
      scrollRef={scroll}
      keyboardAvoiding
      footer={footer}
    >
      {directionsSheet}
      <ImageViewer uri={carPhoto} visible={viewer} onClose={() => setViewer(false)} />
          {user && otherUid && otherUid !== user.uid && (
            <FriendBanner me={user} other={otherUid} name={other?.name ?? (isOwner ? share.recipientName : share.ownerName) ?? '…'} />
          )}

          <Pressable style={s.photo} onPress={() => setViewer(true)} accessibilityLabel={t('shared.viewPhoto')}>
            <Image source={full ?? (share.thumb ? `data:image/jpeg;base64,${share.thumb}` : undefined)} style={StyleSheet.absoluteFill} contentFit="cover" />
            {!share.thumb && !full ? <View style={s.photoGone}><Ionicons name="image-outline" size={40} color={C.muted} /></View> : null}
            {share.placeTitle ? <Chip icon="location" text={share.placeTitle} style={s.chipBL} /> : null}
            {distance !== undefined && hasLocation && <Chip icon="walk" text={formatDistance(distance)} style={s.chipTR} />}
          </Pressable>
          {share.placeAddress && share.placeAddress !== share.placeTitle ? <Text style={s.address}>{share.placeAddress}</Text> : null}
          {share.note ? (
            <View style={s.noteRow}>
              <Ionicons name="document-text" size={18} color={C.gold} />
              <Text style={s.noteText}>{share.note}</Text>
            </View>
          ) : null}

          <Text style={[st.hint, canAccept && { color: C.text }]}>{left ? `${state}\n${left}` : state}</Text>

          {canAccept && <Button label={!user ? t('shared.signInToAccept') : isInvitee && pickup ? t('shared.acceptPickup') : t('shared.accept')} icon="checkmark-circle" onPress={accept} />}
          {canAccept && isInvitee && <Button variant="dark" label={t(pickup ? 'shared.declinePickup' : 'friends.decline')} onPress={() => perform(declineShare(id), t('shared.declinedDone'), false)} />}
          {hasLocation && !(isRecipient && active) && (
            <Button variant={canAccept ? 'dark' : 'primary'} label={t('home.navigate')} icon="navigate" onPress={() => go(share.lat!, share.lng!, share.placeTitle || share.note)} />
          )}

          {canSeeHistory && (
            <View style={s.chat}>
              {msgsLoading && <ActivityIndicator color={C.muted} />}
              {items.map((it, i) => {
                const newDay = i === 0 || new Date(it.at).toDateString() !== new Date(items[i - 1].at).toDateString();
                return (
                  <View key={it.key} style={{ gap: 8 }}>
                    {newDay && <Text style={s.day}>{dayLabel(it.at)}</Text>}
                    {it.kind === 'event' ? (
                      <EventRow entry={it.e} text={timelineText(it.e, share)} />
                    ) : (
                      <View style={[s.bubble, it.m.uid === user?.uid ? s.mine : s.theirs]}>
                        {it.m.photoPath ? <ChatPhoto path={it.m.photoPath} /> : null}
                        {it.m.text ? <Text style={it.m.uid === user?.uid ? s.mineText : s.theirsText}>{it.m.text}</Text> : null}
                        <Text style={it.m.uid === user?.uid ? s.timeMine : s.timeTheirs}>{hhmm(it.at)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {hasEnded(share) && (
                <View style={s.ended}>
                  <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Text style={s.endedText}>{t('shared.chatEnded')}</Text>
                    <Text style={s.endedSub}>{t('shared.deleteOn', { date: dateFull(deleteOn(share)) })}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: PAD },
  header: { flexDirection: 'row', paddingTop: 4, paddingBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  body: { gap: 14, paddingBottom: 20 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  pickupBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  carThumb: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: C.card2, borderWidth: 2, borderColor: C.gold },
  barButton: { flex: 1 },
  friendBox: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderRadius: 22, borderCurve: 'continuous', padding: 14, alignItems: 'flex-start' },
  friendText: { color: C.text, fontSize: 15, fontWeight: '600' },
  friendBtn: { height: 42, borderRadius: 21, paddingHorizontal: 16, flex: 1 },
  fromText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  address: { color: C.muted, fontSize: 14 },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: C.card, ...SQUIRCLE },
  photoGone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  chipBL: { position: 'absolute', left: 16, bottom: 16, maxWidth: '75%' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { color: C.gold, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  chipTR: { position: 'absolute', right: 16, top: 16 },
  chatPhoto: { width: 220, height: 280, borderRadius: 14, borderCurve: 'continuous', backgroundColor: C.card2 },
  chat: { gap: 8, paddingTop: 6 },
  day: { alignSelf: 'center', color: C.muted, fontSize: 12, fontWeight: '700', paddingVertical: 4 },
  bubble: { maxWidth: '80%', borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.gold },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.card },
  mineText: { color: C.bg, fontSize: 16 },
  theirsText: { color: C.text, fontSize: 16 },
  timeMine: { color: 'rgba(10,10,10,0.55)', fontSize: 11, alignSelf: 'flex-end' },
  timeTheirs: { color: C.muted, fontSize: 11, alignSelf: 'flex-end' },
  ended: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: C.card, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 8, maxWidth: '92%' },
  eventText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  eventTime: { color: C.muted, fontSize: 11 },
  endedSub: { color: C.muted, fontSize: 12 },
  endedText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 8 },
});

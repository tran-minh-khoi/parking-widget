import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { HeaderAvatar, HeaderBell } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { useUser } from '@/features/account/auth';
import { deleteOn, hasEnded, timelineOf, timelineText } from '@/features/sharing/timeline';
import { isPickup, revokeShare, useMyShares, type Share } from '@/features/sharing/shares';
import { perform } from '@/lib/feedback';
import { C } from '@/lib/theme';
import { dateFull, dayLabel, formatWhen } from '@/lib/time';
import { useProfile } from '@/features/social/trust';
import { PersonRow } from '@/components/Person';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ErrorNote, Pill, Skeleton, st, usePullRefresh } from '@/components/ui';

type Seg = 'received' | 'sent';

// Coloured status label: what state this share is in, at a glance.
function StatusPill({ share, me }: { share: Share; me: string }) {
  const { t } = useTranslation();
  const ended = share.status === 'accepted' && share.expiresAt <= Date.now();
  const key = ended ? 'expired' : share.status === 'open' && share.invitee === me ? 'invited' : share.status;
  const tone = { open: C.muted, invited: C.gold, accepted: C.gold, pickedUp: C.ok, closed: C.muted, revoked: C.muted, expired: C.muted, declined: C.danger }[key];
  return <Pill text={t(`status.${key}`)} color={tone} />;
}

// One share = one row: who, where, note, when, state.
function ShareRow({ share, mine, me }: { share: Share; mine: boolean; me: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const otherUid = mine ? (share.recipientId ?? share.invitee) : share.ownerId;
  const p = useProfile(otherUid);
  const last = timelineOf(share).at(-1)!; // never empty: a share always starts with "shared" / "asked"
  const who = mine
    ? share.recipientName ? t('sharing.to', { name: share.recipientName })
    : share.invitee ? t(isPickup(share) ? 'sharing.askedTo' : 'sharing.to', { name: p?.name ?? '…' })
    : t('sharing.noRecipient')
    : share.invitee === me ? t(isPickup(share) ? 'sharing.askedYou' : 'sharing.from', { name: share.ownerName })
    : t('sharing.from', { name: share.ownerName });
  const row = (
    <PersonRow
      uid={otherUid}
      size={48}
      title={share.placeTitle || share.note || t('widget.title')}
      onPress={() => router.push({ pathname: '/s/[id]', params: { id: share.id } })}
      right={<StatusPill share={share} me={me} />}
    >
      {share.note && share.placeTitle ? <Text style={s.note} numberOfLines={1}>{share.note}</Text> : null}
      <Text style={st.rowSub} numberOfLines={1}>{who}</Text>
      {/* the latest thing that happened (who agreed / who picked the car up ...), and when it will be deleted */}
      <Text style={s.event} numberOfLines={2}>{`${timelineText(last, share)} · ${formatWhen(last.at)}`}</Text>
      {hasEnded(share) && <Text style={s.when}>{t('shared.deleteOn', { date: dateFull(deleteOn(share)) })}</Text>}
    </PersonRow>
  );
  // a link nobody accepted yet can be taken back with a swipe
  if (!mine || share.status !== 'open') return row;
  return (
    <ReanimatedSwipeable
      overshootRight={false}
      friction={2}
      renderRightActions={() => (
        <Pressable style={s.revoke} onPress={() => perform(revokeShare(share.id), t('sharing.revokedDone'))}>
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={s.revokeText}>{t('sharing.revoke')}</Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

export default function Sharing() {
  const { t } = useTranslation();
  const user = useUser();
  const { owned, received, loading, error, refresh } = useMyShares(user?.uid);
  const refreshControl = usePullRefresh(refresh);
  const [picked, setPicked] = useState<Seg>();
  const seg: Seg = picked ?? (owned.length === 0 && received.length > 0 ? 'received' : 'sent');
  const list = seg === 'sent' ? owned : received;

  // Active shares are pinned on top; everything else is grouped by day (Today, Yesterday, earlier dates).
  const isActive = (sh: Share) => (sh.status === 'open' || sh.status === 'accepted') && sh.expiresAt > Date.now();
  const sections: { key: string; title: string; items: Share[] }[] = [];
  const active = list.filter(isActive);
  if (active.length) sections.push({ key: 'active', title: t('sharing.active'), items: active });
  for (const sh of list.filter((x) => !isActive(x))) {
    const key = new Date(sh.parkedAt).toDateString();
    const last = sections[sections.length - 1];
    if (last?.key === key) last.items.push(sh);
    else sections.push({ key, title: dayLabel(sh.parkedAt), items: [sh] });
  }

  const header = { title: t('sharing.title'), left: <HeaderBell />, right: <HeaderAvatar /> };

  if (!user) {
    return (
      <Screen header={header} tabbed>
        <SignInPrompt icon="people-outline" text={t('sharing.signIn')} />
      </Screen>
    );
  }

  const tab = (key: Seg, label: string, count: number) => (
    <Pressable key={key} style={[s.tab, seg === key && s.tabOn]} onPress={() => setPicked(key)}>
      <Text style={[s.tabText, seg === key && s.tabTextOn]}>{label}</Text>
      {count > 0 && <Text style={[s.count, seg === key && s.countOn]}>{count}</Text>}
    </Pressable>
  );

  return (
    <Screen header={header} tabbed scroll refreshControl={refreshControl}>
        <View style={s.tabs}>
          {tab('received', t('sharing.received'), received.length)}
          {tab('sent', t('sharing.sent'), owned.length)}
        </View>

        {loading && list.length === 0 ? (
          <Skeleton rows={3} />
        ) : error && list.length === 0 ? (
          <ErrorNote text={t('common.loadError')} retry={t('common.retry')} onRetry={refresh} />
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name={seg === 'sent' ? 'paper-plane-outline' : 'download-outline'} size={44} color={C.muted} />
            <Text style={st.hint}>{t(seg === 'sent' ? 'sharing.emptySent' : 'sharing.emptyReceived')}</Text>
          </View>
        ) : (
          sections.map((sec) => (
            <View key={sec.key} style={{ gap: 10 }}>
              <Text style={[st.section, { marginBottom: 0 }, sec.key === 'active' && { color: C.gold }]}>{sec.title}</Text>
              {sec.items.map((sh) => <ShareRow key={sh.id} share={sh} mine={seg === 'sent'} me={user.uid} />)}
            </View>
          ))
        )}
    </Screen>
  );
}

const s = StyleSheet.create({
  block: { gap: 8 },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 24, borderCurve: 'continuous', padding: 4 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 20, borderCurve: 'continuous' },
  tabOn: { backgroundColor: C.gold },
  tabText: { color: C.muted, fontSize: 14, fontWeight: '700' },
  tabTextOn: { color: C.bg },
  count: { color: C.muted, fontSize: 12, fontWeight: '800', backgroundColor: C.card2, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1 },
  countOn: { color: C.gold, backgroundColor: C.bg },
  note: { color: C.gold, fontSize: 14, fontWeight: '800' },
  event: { color: C.text, fontSize: 12, fontWeight: '600', marginTop: 1 },
  when: { color: C.muted, fontSize: 12, marginTop: 1 },
  revoke: { width: 84, marginLeft: 8, borderRadius: 20, borderCurve: 'continuous', backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', gap: 4 },
  revokeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 50 },
});

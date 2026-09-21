import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/Person';
import { useAlias } from '@/features/social/friends';
import { useProfile } from '@/features/social/trust';
import { confirm, perform } from '@/lib/feedback';
import { C } from '@/lib/theme';
import { dateTime, timeLeft } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { retimeShare } from '@/features/parking/share';
import type { Spot } from '@/features/parking/model';
import { DurationSheet } from './DurationSheet';
import { cancelShare, nudgeShare, type Share } from './shares';

// My links for the current parking that are still usable (waiting or accepted).
export const activeShares = (owned: Share[], ids: string[] = [], now = Date.now()) =>
  owned.filter((s) => ids.includes(s.id) && (s.status === 'open' || s.status === 'accepted') && s.expiresAt > now);

function Row({ share, now, onEdit }: { share: Share; now: number; onEdit: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const other = share.recipientId ?? share.invitee;
  const p = useProfile(other);
  const alias = useAlias(other);
  const who = share.recipientName ? t('home.sharedTo', { name: alias || share.recipientName })
    : share.invitee ? t('home.sharedAsked', { name: alias || p?.name || share.inviteeName || '…' })
    : t('home.sharedWaiting');
  const left = share.untilGone ? t('home.sharedUntil') : `${t('home.sharedLeft', { time: timeLeft(share.expiresAt - now) })} · ${t('home.sharedEnds', { when: dateTime(share.expiresAt) })}`;
  // someone to remind: the person who accepted, or the friend it was sent to (at most one nudge a minute)
  const canNudge = !!other && now - (share.nudgedAt ?? 0) > 60 * 1000;
  const nudge = () => perform(nudgeShare(share.id), t('home.nudged', { name: alias || share.recipientName || share.inviteeName || p?.name || '' }));
  const stop = () =>
    confirm({
      title: t('home.stopTitle'),
      message: t(share.recipientId ? 'home.stopBody' : 'home.stopBodyNone'),
      action: t('home.stop'),
      onConfirm: () => perform(cancelShare(share), t('home.stopped')),
    });
  return (
    <View style={{ gap: 10 }}>
    <View style={s.row}>
      <Pressable style={s.main} onPress={() => router.push({ pathname: '/s/[id]', params: { id: share.id } })}>
        {other ? (
          <UserAvatar uid={other} size={40} name={share.recipientName} />
        ) : (
          <View style={s.placeholder}>
            <Ionicons name="paper-plane-outline" size={18} color={C.muted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.who, share.recipientName ? { color: C.ok } : null]} numberOfLines={1}>{who}</Text>
          <Text style={s.left}>{left}</Text>
        </View>
      </Pressable>
      <Pressable hitSlop={10} onPress={stop} accessibilityLabel={t('home.stop')}>
        <Ionicons name="close-circle" size={28} color={C.muted} />
      </Pressable>
    </View>
    <View style={s.actions}>
      <Pressable style={s.pill} onPress={onEdit}>
        <Ionicons name="time-outline" size={16} color={C.gold} />
        <Text style={s.pillText}>{t('home.changeTime')}</Text>
      </Pressable>
      {other ? (
        <Pressable style={[s.pill, !canNudge && { opacity: 0.4 }]} disabled={!canNudge} onPress={nudge}>
          <Ionicons name="notifications-outline" size={16} color={C.gold} />
          <Text style={s.pillText}>{t('home.nudge')}</Text>
        </Pressable>
      ) : null}
    </View>
    </View>
  );
}

// Home screen card: who I'm sharing with, how long the link lasts, and a way to stop.
export function ActiveShares({ shares, spot }: { shares: Share[]; spot: Spot }) {
  const { t } = useTranslation();
  const now = useNow();
  const [editing, setEditing] = useState<Share>();
  const live = shares.filter((x) => x.expiresAt > now);
  if (!live.length) return null;
  return (
    <View style={s.card}>
      <Text style={s.title}>{t('home.sharingTitle')}</Text>
      {live.map((x) => <Row key={x.id} share={x} now={now} onEdit={() => setEditing(x)} />)}
      <DurationSheet
        visible={!!editing}
        title={t('home.changeTitle')}
        onClose={() => setEditing(undefined)}
        onPick={(d) => editing && perform(retimeShare(spot, editing, d), t('home.timeChanged'))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, borderCurve: 'continuous', padding: 14, gap: 12 },
  title: { color: C.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, paddingLeft: 52 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { color: C.text, fontSize: 13, fontWeight: '700' },
  who: { color: C.text, fontSize: 16, fontWeight: '700' },
  left: { color: C.muted, fontSize: 13, marginTop: 2 },
});

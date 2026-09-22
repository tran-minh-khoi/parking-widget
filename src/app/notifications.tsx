import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { SignInPrompt } from '@/components/SignInPrompt';
import { useUser } from '@/features/account/auth';
import { deleteNotices, markAllRead, markRead, useInbox, type Notice } from '@/features/inbox/inbox';
import { confirm, perform } from '@/lib/feedback';
import { C } from '@/lib/theme';
import { formatWhen } from '@/lib/time';
import { CircleButton, ErrorNote, Skeleton, st, usePullRefresh, type IconName } from '@/components/ui';

const ICON: Record<Notice['type'], IconName> = {
  message: 'chatbubble-ellipses', share: 'car', trust: 'shield-checkmark', friend: 'person-add', spot: 'car-sport', system: 'information-circle',
};

// Messages, share updates and system notices in one place.
export default function Notifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const { notices, unread, loading, error, refresh } = useInbox(user?.uid);
  const refreshControl = usePullRefresh(refresh);

  // Long-press a notification to start selecting; tap to add/remove; the header turns into "delete".
  const [sel, setSel] = useState<string[]>([]);
  const selecting = sel.length > 0;
  const toggle = (id: string) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const startSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggle(id);
  };
  const confirmDelete = () =>
    user &&
    confirm({
      title: t('notifications.deleteTitle', { count: sel.length }),
      message: t('notifications.deleteBody'),
      action: t('history.delete'),
      onConfirm: () => {
        perform(deleteNotices(user.uid, sel));
        setSel([]);
      },
    });

  const open = (n: Notice) => {
    if (selecting) return toggle(n.id);
    if (user) markRead(user.uid, n.id).catch(() => {});
    if (n.shareId) router.push({ pathname: '/s/[id]', params: { id: n.shareId } });
    else if (n.refUid) router.push({ pathname: '/profile/[uid]', params: { uid: n.refUid } });
  };

  // "mark all read" lives in the header while something is unread; while selecting it becomes "delete"
  const action = selecting ? (
    <CircleButton icon="trash" size={44} bg={C.danger} color="#fff" onPress={confirmDelete} />
  ) : user && unread ? (
    <CircleButton icon="checkmark-done" size={44} onPress={() => markAllRead(user.uid, notices).catch(() => {})} />
  ) : null;

  return (
    <Screen
      header={{
        title: selecting ? t('notifications.selected', { count: sel.length }) : t('notifications.title'),
        left: selecting ? <CircleButton icon="close" size={44} onPress={() => setSel([])} /> : <HeaderBack />,
        right: action,
      }}
      scroll
      refreshControl={refreshControl}
    >
      {!user ? (
        <SignInPrompt icon="notifications-outline" text={t('notifications.signIn')} />
      ) : loading && notices.length === 0 ? (
        <Skeleton rows={4} />
      ) : error && notices.length === 0 ? (
        <ErrorNote text={t('common.loadError')} retry={t('common.retry')} onRetry={refresh} />
      ) : notices.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-outline" size={48} color={C.muted} />
          <Text style={st.hint}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {notices.map((n) => (
            <Pressable key={n.id} style={[st.row, !n.read && s.unread, sel.includes(n.id) && s.picked]} onPress={() => open(n)} onLongPress={() => startSelect(n.id)} delayLongPress={350}>
              <View style={s.icon}>
                <Ionicons name={ICON[n.type] ?? 'information-circle'} size={22} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle}>{n.title}</Text>
                <Text style={st.rowSub} numberOfLines={2}>{n.body}</Text>
                <Text style={[st.rowSub, { fontSize: 12 }]}>{formatWhen(n.createdAt)}</Text>
              </View>
              {selecting ? (
                <Ionicons name={sel.includes(n.id) ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel.includes(n.id) ? C.gold : C.muted} />
              ) : !n.read ? (
                <View style={s.dot} />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', gap: 14, paddingTop: 100 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  unread: { borderWidth: 1, borderColor: 'rgba(255,214,10,0.35)' },
  picked: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.gold },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold },
});

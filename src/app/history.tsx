import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { HeaderAvatar, HeaderBack } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { useUser } from '@/features/account/auth';
import { deleteHistoryItem, loadHistory } from '@/features/parking/history';
import { type Spot } from '@/features/parking/model';
import { confirm, showDone } from '@/lib/feedback';
import { C } from '@/lib/theme';
import { formatWhen } from '@/lib/time';
import { ImageViewer } from '@/components/ImageViewer';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Skeleton, st, usePullRefresh } from '@/components/ui';

export default function History() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const [items, setItems] = useState<Spot[]>();
  const [viewing, setViewing] = useState<string>();
  useFocusEffect(useCallback(() => void loadHistory().then(setItems), [user?.uid]));
  const refreshControl = usePullRefresh(() => loadHistory().then(setItems));

  const doRemove = async (h: Spot) => {
    setItems((cur) => cur?.filter((x) => x.parkedAt !== h.parkedAt)); // instant; storage follows
    await deleteHistoryItem(h.parkedAt);
  };
  // Deleting a parking wipes it for everyone it was shared with, so always ask.
  const remove = (h: Spot, close: () => void) =>
    confirm({
      title: t('history.deleteTitle'),
      message: t('history.deleteBody'),
      action: t('history.delete'),
      onCancel: close,
      onConfirm: () => doRemove(h).then(() => showDone(t('history.deletedDone'))),
    });

  return (
    <Screen header={{ title: t('history.title'), left: <HeaderBack />, right: <HeaderAvatar /> }} scroll refreshControl={refreshControl}>
        {!user && <SignInPrompt icon="lock-closed-outline" text={t('history.signIn')} />}
        {user && items === undefined && <Skeleton rows={3} />}
        {user && items?.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="time-outline" size={48} color={C.muted} />
            <Text style={st.hint}>{t('history.empty')}</Text>
          </View>
        )}
        {user && items?.map((h) => (
          <ReanimatedSwipeable
            key={h.parkedAt}
            overshootRight={false}
            friction={2}
            renderRightActions={(_p, _t, swipe) => (
              <Pressable style={s.del} onPress={() => remove(h, () => swipe.close())}>
                <Ionicons name="trash" size={24} color="#fff" />
                <Text style={s.delText}>{t('history.delete')}</Text>
              </Pressable>
            )}
          >
            <Pressable style={st.row} onPress={() => router.push({ pathname: '/spot/[id]', params: { id: String(h.parkedAt) } })}>
              <Pressable style={s.photo} disabled={!h.photo} onPress={() => setViewing(h.photo)}>
                {h.photo ? <Image source={h.photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="car-outline" size={26} color={C.muted} />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle} numberOfLines={2}>{h.place?.title ?? t('widget.title')}</Text>
                {h.note ? <Text style={s.note}>{h.note}</Text> : null}
                <Text style={st.rowSub}>{t(h.closeReason === 'expired' ? 'history.expired' : 'history.gotCar')}</Text>
              </View>
              <Text style={s.time}>{formatWhen(h.closedAt ?? h.parkedAt)}</Text>
            </Pressable>
          </ReanimatedSwipeable>
        ))}
      <ImageViewer uri={viewing} visible={!!viewing} onClose={() => setViewing(undefined)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  photo: { width: 64, height: 64, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  note: { color: C.gold, fontSize: 14, fontWeight: '700', marginTop: 2 },
  del: { width: 84, marginLeft: 8, borderRadius: 20, borderCurve: 'continuous', backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', gap: 4 },
  delText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  time: { color: C.muted, fontSize: 12, fontWeight: '600', alignSelf: 'flex-start', textAlign: 'right' },
});

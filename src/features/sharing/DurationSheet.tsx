import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PersonRow } from '@/components/Person';
import { Sheet } from '@/components/Sheet';
import { Button, CircleButton, st } from '@/components/ui';
import { useUser } from '@/features/account/auth';
import type { ShareFor } from '@/features/parking/model';
import { useFriends } from '@/features/social/friends';
import { useProfile } from '@/features/social/trust';
import { SHARE_MAX_HOURS } from '@/config';
import { C } from '@/lib/theme';

// Timed shares last at most SHARE_MAX_HOURS; longer than that is "until the car is gone".
const CUSTOM_HOURS = [2, 3, 4, 6, 8, 10, SHARE_MAX_HOURS];
export type Friend = { uid: string; name: string };

function FriendRow({ uid, onPick }: { uid: string; onPick: (f: Friend) => void }) {
  const p = useProfile(uid);
  return <PersonRow uid={uid} size={40} title={p?.name ?? '…'} onPress={() => onPick({ uid, name: p?.name ?? '?' })} />;
}

// "How long?" for a share. With `friends`, a second step asks who gets it: a link, or one of my friends.
export function DurationSheet({ visible, title, friends, onClose, onPick }: {
  visible: boolean;
  title: string;
  friends?: boolean;
  onClose: () => void;
  onPick: (duration: ShareFor, friend?: Friend) => void;
}) {
  const { t } = useTranslation();
  const me = useUser();
  const mine = useFriends(me?.uid).filter((f) => f.status === 'accepted');
  const [custom, setCustom] = useState(false);
  const [idx, setIdx] = useState(3);
  const [picked, setPicked] = useState<ShareFor>();
  const hours = (h: number) => t('share.hours', { count: h });
  // `onPick` often opens another modal (a confirm alert, the native share sheet): firing it the instant this sheet
  // starts closing can race its dismiss animation on iOS, which then silently drops the second one. So it waits for
  // the Modal's `onDismiss` (fired once the animation is actually done) instead of running right after `close()`.
  const queued = useRef<{ duration: ShareFor; friend?: Friend }>(undefined);
  const close = () => {
    setPicked(undefined);
    setCustom(false);
    onClose();
  };
  const fire = () => {
    const q = queued.current;
    queued.current = undefined;
    if (q) onPick(q.duration, q.friend);
  };
  const queue = (duration: ShareFor, friend?: Friend) => {
    queued.current = { duration, friend };
    close();
    if (Platform.OS !== 'ios') fire(); // Modal's onDismiss is iOS-only
  };
  const choose = (d: ShareFor) => (friends ? setPicked(d) : queue(d));
  const send = (friend?: Friend) => queue(picked!, friend);

  return (
    <Sheet visible={visible} onClose={close} onDismiss={fire}>
          {picked === undefined ? (
            <>
              <Text style={st.title}>{title}</Text>
              <Button variant="dark" icon="time-outline" label={t('share.oneHour')} onPress={() => choose(1)} />
              <Button variant="dark" icon="options-outline" label={t('share.custom')} onPress={() => setCustom(!custom)} />
              {custom && (
                <View style={s.custom}>
                  <View style={s.stepper}>
                    <CircleButton icon="remove" size={44} bg={C.card2} onPress={() => setIdx(Math.max(0, idx - 1))} />
                    <Text style={s.stepValue}>{hours(CUSTOM_HOURS[idx])}</Text>
                    <CircleButton icon="add" size={44} bg={C.card2} onPress={() => setIdx(Math.min(CUSTOM_HOURS.length - 1, idx + 1))} />
                  </View>
                  <Button label={t('share.shareFor', { time: hours(CUSTOM_HOURS[idx]) })} icon="share-outline" onPress={() => choose(CUSTOM_HOURS[idx])} />
                </View>
              )}
              <Button variant="dark" icon="car-outline" label={t('share.untilGone')} onPress={() => choose('until')} />
              <Button variant="dark" label={t('common.cancel')} onPress={close} />
            </>
          ) : (
            <>
              <Text style={st.title}>{t('share.sendTo')}</Text>
              <Button icon="link-outline" label={t('share.sendLink')} onPress={() => send()} />
              {mine.length > 0 && (
                <>
                  <Text style={st.hint}>{t('share.orFriend')}</Text>
                  <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
                    {mine.map((f) => <FriendRow key={f.id} uid={f.other} onPick={send} />)}
                  </ScrollView>
                </>
              )}
              <Button variant="dark" label={t('common.back')} onPress={() => setPicked(undefined)} />
            </>
          )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  custom: { gap: 12, backgroundColor: C.card, borderRadius: 24, borderCurve: 'continuous', padding: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepValue: { color: C.text, fontSize: 20, fontWeight: '800' },
});

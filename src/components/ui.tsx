import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type  { AppUser } from '@/features/account/auth';
import { C } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// A tap that starts async work (onPress returns a promise): show a spinner and ignore taps until it settles.
function usePress(onPress?: () => unknown) {
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const press = () => {
    if (pending) return;
    const work = onPress?.();
    if (!(work instanceof Promise)) return;
    setPending(true);
    const done = () => alive.current && setPending(false);
    work.then(done, done); // errors are the caller's to show
  };
  return { pending, press };
}

export function CircleButton({
  icon, onPress, badge, size = 52, color = C.text, bg = C.card, style,
}: {
  icon: IconName; onPress?: () => unknown; badge?: number; size?: number; color?: string; bg?: string; style?: StyleProp<ViewStyle>;
}) {
  const { pending, press } = usePress(onPress);
  return (
    <Pressable onPress={press} hitSlop={8} style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      {pending ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={size * 0.46} color={color} />}
      {badge ? (
        <View style={st.badge}>
          <Text style={st.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Avatar({ user, size = 52 }: { user: Pick<AppUser, 'displayName' | 'email' | 'photoURL'> | null; size?: number }) {
  const initial = (user?.displayName ?? user?.email ?? '?').trim().charAt(0).toUpperCase();
  return user?.photoURL ? (
    <Image source={user.photoURL} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.card }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: user ? C.gold : C.card, alignItems: 'center', justifyContent: 'center' }}>
      {user ? <Text style={{ color: C.bg, fontSize: size * 0.42, fontWeight: '800' }}>{initial}</Text> : <Ionicons name="person" size={size * 0.46} color={C.text} />}
    </View>
  );
}

export function Button({
  label, icon, onPress, variant = 'primary', busy, style, compact,
}: {
  label: string; icon?: IconName; onPress?: () => unknown; variant?: 'primary' | 'dark' | 'danger'; busy?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const primary = variant === 'primary';
  const fg = primary ? C.bg : variant === 'danger' ? C.danger : C.text;
  const { pending, press } = usePress(onPress);
  const working = busy || pending;
  return (
    <Pressable onPress={press} disabled={working} style={[st.button, compact && st.buttonCompact, { backgroundColor: primary ? C.gold : C.card }, style]}>
      {working ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={compact ? 18 : 22} color={fg} /> : null}
      <Text style={[st.buttonText, compact && st.buttonTextCompact, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// Round icon with a caption underneath (the row of secondary actions on the parked card).
export function ActionButton({ icon, label, onPress, color = C.text }: { icon: IconName; label: string; onPress: () => unknown; color?: string }) {
  const { pending, press } = usePress(onPress);
  return (
    <Pressable onPress={press} style={st.action}>
      <View style={st.actionIcon}>
        {pending ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={24} color={color} />}
      </View>
      <Text style={[st.actionLabel, { color }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ icon, text, style }: { icon?: IconName; text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[st.chip, style]}>
      {icon ? <Ionicons name={icon} size={14} color={C.gold} /> : null}
      <Text style={st.chipText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// A small outlined label ("Waiting", "Friends") or, with onPress and `filled`, a compact button ("Add").
export function Pill({ text, color = C.muted, filled, size = 'sm', onPress }: { text: string; color?: string; filled?: boolean; size?: 'sm' | 'md'; onPress?: () => unknown }) {
  const { pending, press } = usePress(onPress);
  const md = size === 'md';
  return (
    <Pressable
      onPress={press}
      disabled={!onPress || pending}
      style={{ borderWidth: 1.5, borderColor: color, backgroundColor: filled ? color : 'transparent', borderRadius: md ? 16 : 12, paddingHorizontal: md ? 12 : 9, paddingVertical: md ? 6 : 4, alignSelf: 'flex-start' }}
    >
      {pending ? <ActivityIndicator size="small" color={filled ? C.bg : color} /> : <Text style={{ color: filled ? C.bg : color, fontSize: md ? 13 : 11, fontWeight: '800' }}>{text}</Text>}
    </Pressable>
  );
}

// Single-choice list: one row per option, a check on the selected one.
export function OptionList<T extends string>({ options, value, onPick }: { options: { key: T; label: string }[]; value: T; onPick: (key: T) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => (
        <Pressable key={o.key} style={st.row} onPress={() => onPick(o.key)}>
          <Text style={[st.rowTitle, { flex: 1 }]}>{o.label}</Text>
          {value === o.key && <Ionicons name="checkmark-circle" size={22} color={C.gold} />}
        </Pressable>
      ))}
    </View>
  );
}

// A screen that has nothing to show yet (or is only redirecting): a spinner instead of an empty page.
export function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.gold} />
    </View>
  );
}

// Placeholder rows while the first load is in flight (pulsing, same shape as a real row).
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[st.row, { opacity: pulse }]}>
          <View style={sk.avatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[sk.line, { width: '55%' }]} />
            <View style={[sk.line, { width: '80%', height: 10 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// Pull-to-refresh control for a ScrollView (refresh resolves when the data has been re-read).
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <RefreshControl
      refreshing={refreshing}
      tintColor={C.gold}
      colors={[C.gold]}
      progressBackgroundColor={C.card}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await refresh();
        } finally {
          setRefreshing(false);
        }
      }}
    />
  );
}

export function ErrorNote({ text, retry, onRetry }: { text: string; retry: string; onRetry: () => void }) {
  return (
    <View style={sk.error}>
      <Ionicons name="cloud-offline-outline" size={40} color={C.muted} />
      <Text style={st.hint}>{text}</Text>
      <Button variant="dark" label={retry} onPress={onRetry} style={{ height: 46 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card2 },
  line: { height: 14, borderRadius: 7, backgroundColor: C.card2 },
  error: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
});

export const st = StyleSheet.create({
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: C.bg, fontSize: 12, fontWeight: '800' },
  button: { flexDirection: 'row', gap: 8, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buttonText: { fontSize: 17, fontWeight: '800' },
  buttonCompact: { height: 50, borderRadius: 25, paddingHorizontal: 12, gap: 6 },
  buttonTextCompact: { fontSize: 14, flexShrink: 1 },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,10,10,0.72)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: C.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  hint: { color: C.muted, fontSize: 14, textAlign: 'center' },
  title: { color: C.text, fontSize: 22, fontWeight: '800' },
  section: { color: C.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  row: { backgroundColor: C.card, borderRadius: 20, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  input: { backgroundColor: C.card, color: C.text, borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 18, height: 50, fontSize: 16 },
});

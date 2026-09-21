import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/lib/theme';

// One header for every screen: [left] title [right]. Each part is optional and can be switched off
// with its own flag (e.g. a tab screen shows a bell + avatar, a pushed screen shows a back button).
export type HeaderProps = {
  title?: string;
  titleLeft?: ReactNode; // shown next to the title, e.g. the other person's avatar
  left?: ReactNode;
  right?: ReactNode;
  showLeft?: boolean;
  showTitle?: boolean;
  showRight?: boolean;
  onTitlePress?: () => void; // e.g. the chat title opens the person's profile
};

export function Header({ title, titleLeft, left, right, showLeft = true, showTitle = true, showRight = true, onTitlePress }: HeaderProps) {
  return (
    <View style={s.bar}>
      <View style={[s.slot, { alignItems: 'flex-start' }]}>{showLeft ? left : null}</View>
      <View style={s.center}>
        {showTitle && title ? (
          <Pressable disabled={!onTitlePress} onPress={onTitlePress} hitSlop={8} style={s.titleRow}>
            {titleLeft}
            <Text style={[s.title, { flexShrink: 1 }]} numberOfLines={1}>{title}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[s.slot, { alignItems: 'flex-end' }]}>{showRight ? right : null}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingTop: 4, paddingBottom: 6, gap: 8 },
  slot: { width: 64, justifyContent: 'center' }, // equal side slots keep the title centred
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  title: { color: C.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
});

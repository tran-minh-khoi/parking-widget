import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, st } from '@/components/ui';
import { useProfile } from '@/features/social/trust';
import { C } from '@/lib/theme';

// A person's avatar from their public profile (photo + initial). `name` / `photoURL` are used until the profile arrives,
// or when there is no profile (a name typed in a share, a contact match).
export function UserAvatar({ uid, size = 46, name, photoURL }: { uid: string; size?: number; name?: string; photoURL?: string }) {
  const profile = useProfile(uid);
  return <Avatar user={{ displayName: name ?? profile?.name ?? '?', email: null, photoURL: profile?.photoURL || photoURL || null }} size={size} />;
}

// The list row used everywhere people appear (friends, trusted, shares, contacts, search results):
// avatar, title, any extra lines as children, something on the right (a badge, a chevron, a button).
// No `uid` (a link nobody has opened yet) shows a paper-plane placeholder.
export function PersonRow({ uid, name, photoURL, size = 46, title, onPress, right, children }: {
  uid?: string;
  name?: string;
  photoURL?: string;
  size?: number;
  title: string;
  onPress?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Pressable style={st.row} onPress={onPress} disabled={!onPress}>
      {uid ? (
        <UserAvatar uid={uid} size={size} name={name} photoURL={photoURL} />
      ) : (
        <View style={[s.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Ionicons name="paper-plane-outline" size={size * 0.46} color={C.muted} />
        </View>
      )}
      <View style={s.body}>
        <Text style={st.rowTitle} numberOfLines={1}>{title}</Text>
        {children}
      </View>
      {right}
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, gap: 2 },
  placeholder: { backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUser } from '@/features/account/auth';
import { useFriends } from '@/features/social/friends';
import { useMyShares } from '@/features/sharing/shares';
import { C } from '@/lib/theme';
import { useTrusts } from '@/features/social/trust';
import { st, type IconName } from '@/components/ui';

const ICONS: Record<string, [on: IconName, off: IconName]> = {
  friends: ['star', 'star-outline'],
  index: ['car', 'car-outline'],
  sharing: ['chatbubbles', 'chatbubbles-outline'],
};

// Floating pill like Locket's bottom bar.
export function PillTabBar({
  state, navigation,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}) {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const friends = useFriends(user?.uid);
  const trusts = useTrusts(user?.uid);
  const { received } = useMyShares(user?.uid);
  // things waiting for me: friend / trust requests on the star, "pick my car up" invitations on the chat tab
  const waiting = (x: { status: string; requester: string }) => x.status === 'pending' && x.requester !== user?.uid;
  const badges: Record<string, number> = {
    friends: friends.filter(waiting).length + trusts.filter(waiting).length,
    sharing: received.filter((sh) => sh.status === 'open' && sh.invitee === user?.uid).length,
  };
  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={s.pill}>
        {state.routes.map((r, i) => {
          const on = state.index === i;
          const [active, idle] = ICONS[r.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} style={[s.item, on && s.itemOn]}>
              <Ionicons name={on ? active : idle} size={26} color={on ? C.gold : C.text} />
              {badges[r.name] ? (
                <View style={[st.badge, { top: 4, right: 20 }]}>
                  <Text style={st.badgeText}>{badges[r.name] > 9 ? '9+' : badges[r.name]}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', gap: 6, padding: 6, borderRadius: 40, backgroundColor: 'rgba(28,28,30,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#3A3A3C' },
  item: { width: 76, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: '#3A3A3C' },
});

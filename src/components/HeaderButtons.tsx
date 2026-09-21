import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useUser } from '@/features/account/auth';
import { useInbox } from '@/features/inbox/inbox';
import { Avatar, CircleButton } from '@/components/ui';

const SIZE = 44;

// Back: history back, or home if there is nothing to go back to (e.g. opened from a link).
export function HeaderBack({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return <CircleButton icon="chevron-back" size={SIZE} onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />;
}

// Notification bell with the unread count.
export function HeaderBell() {
  const router = useRouter();
  const user = useUser();
  const { unread } = useInbox(user?.uid);
  return <CircleButton icon="notifications-outline" size={SIZE} badge={unread} onPress={() => router.push('/notifications')} />;
}

// My avatar: opens the account screen.
export function HeaderAvatar() {
  const router = useRouter();
  const user = useUser();
  return (
    <Pressable onPress={() => router.push('/account')} hitSlop={8}>
      <Avatar user={user} size={SIZE} />
    </Pressable>
  );
}

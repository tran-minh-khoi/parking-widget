import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Loading } from '@/components/ui';

// Friend invitation link: https://my-parking.mktechvn.com/u/<uid> (or myparking://u/<uid>) opens that person's profile,
// where "Add friend" is one tap away (signed-out visitors get the sign-in button there).
export default function Invite() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  useEffect(() => void router.replace({ pathname: '/profile/[uid]', params: { uid } }), [router, uid]);
  return <Loading />;
}

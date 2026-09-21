import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { auth } from '@/lib/firebase';
import { loadSpot } from '@/features/parking/spot';
import { Loading } from '@/components/ui';

// Deep link from the widget / lock-screen card: myparking://share. It only opens the duration chooser
// (1 hour / custom / until the car is gone), so a stray tap can't create a share.
export default function ShareLink() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await auth.authStateReady(); // cold start: wait for the persisted session
      if (!(await loadSpot())) return router.replace('/');
      if (!auth.currentUser) return router.replace('/login');
      router.replace({ pathname: '/', params: { share: '1' } });
    })();
  }, [router]);
  return <Loading />;
}

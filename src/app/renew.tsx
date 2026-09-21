import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components/ui';
import { loadSpot, renewSpot } from '@/features/parking/spot';
import { confirm, perform } from '@/lib/feedback';
import { auth } from '@/lib/firebase';

// "Still parked" from the widget / lock-screen card / reminder: ask first, then extend and show the home screen.
export default function Renew() {
  const { t } = useTranslation();
  const router = useRouter();
  useEffect(() => {
    const home = () => router.replace('/');
    (async () => {
      await auth.authStateReady(); // cold start: wait for the saved session
      const spot = await loadSpot();
      if (!spot) return home();
      if (!auth.currentUser) return router.replace('/login'); // extending needs an account
      confirm({
        title: t('home.renewTitle'),
        message: t('home.renewMessage'),
        action: t('home.stillHere'),
        destructive: false,
        onCancel: home,
        onConfirm: () => perform(renewSpot(), t('home.renewed')).finally(home),
      });
    })();
  }, [router, t]);
  return <Loading />;
}

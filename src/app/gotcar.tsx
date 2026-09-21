import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components/ui';
import { closeSpot, loadSpot } from '@/features/parking/spot';
import { confirm, perform } from '@/lib/feedback';

// Every "I got my car" entry point that isn't in-app (widget, lock-screen card, reminder button)
// lands here: ask first, so a stray tap can't close the parking.
export default function GotCar() {
  const { t } = useTranslation();
  const router = useRouter();
  useEffect(() => {
    const home = () => router.replace('/');
    loadSpot().then((spot) => {
      if (!spot) return home();
      confirm({
        title: t('home.gotCarTitle'),
        message: t('home.gotCarMessage'),
        action: t('home.gotCar'),
        onCancel: home,
        onConfirm: () => perform(closeSpot(), t('home.gotCarDone')).finally(home),
      });
    });
  }, [router, t]);
  return <Loading />;
}

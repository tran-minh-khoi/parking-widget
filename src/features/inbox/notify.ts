import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

import type  { Who } from '@/features/account/auth';
import { db } from '@/lib/firebase';
import i18n from '@/lib/i18n';
import { dateShort } from '@/lib/time';

const DAY = 24 * 3600 * 1000;
const DAYS = 7; // matches the 7-day auto-delete in parking.ts
const MORNING = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// Both buttons open the app: iOS doesn't reliably run JS for a background action when the app was killed.
export const setupNotifications = () =>
  Notifications.setNotificationCategoryAsync('parking', [
    { identifier: 'got', buttonTitle: i18n.t('notify.got'), options: { opensAppToForeground: true } },
    { identifier: 'renew', buttonTitle: i18n.t('notify.renew'), options: { opensAppToForeground: true } },
  ]);

export const cancelReminders = () => Notifications.cancelAllScheduledNotificationsAsync();

// One "did you get your car?" 3h after parking (first = true), then once every morning for 7 days.
export const scheduleReminders = async (parkedAt: number, expiresAt: number, first = false) => {
  await cancelReminders();
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  await setupNotifications(); // re-register so button labels follow the current language

  const at = (date: Date, body: string) =>
    Notifications.scheduleNotificationAsync({
      content: { title: i18n.t('notify.title'), body, categoryIdentifier: 'parking' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });

  const jobs: Promise<string>[] = [];
  if (first) jobs.push(at(new Date(Date.now() + 3 * 3600 * 1000), i18n.t('notify.bodyHours', { hours: 3 })));
  const start = new Date();
  start.setHours(MORNING, 0, 0, 0);
  if (start.getTime() <= Date.now()) start.setDate(start.getDate() + 1); // next 09:00
  for (let k = 0; k < DAYS; k++) {
    const when = new Date(start);
    when.setDate(start.getDate() + k);
    jobs.push(at(when, i18n.t('notify.bodyDays', { count: Math.max(1, Math.round((when.getTime() - parkedAt) / DAY)), date: dateShort(expiresAt) })));
  }
  await Promise.all(jobs);
};

// Cloud Functions read this token to push "accepted / new message / picked up".
export const registerPush = async (user: Who) => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  await setDoc(doc(db, 'users', user.uid), { expoPushToken, lang: i18n.language, updatedAt: Timestamp.now() }, { merge: true });
};

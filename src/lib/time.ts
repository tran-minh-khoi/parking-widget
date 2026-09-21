import i18n from './i18n';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

// "Today" / "Yesterday" / a specific date (with the year only when it isn't this year).
export const dayLabel = (ms: number) => {
  const d = new Date(ms);
  const now = new Date();
  if (sameDay(d, now)) return i18n.t('time.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return i18n.t('time.yesterday');
  return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
};

// 14:32 today, "Yesterday 14:32", "12/9 14:32".
export const formatWhen = (ms: number) => (sameDay(new Date(ms), new Date()) ? hhmm(ms) : `${dayLabel(ms)} ${hhmm(ms)}`);

export const dateShort = (ms: number) => new Date(ms).toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric' });

// "28/09/2026"
export const dateFull = (ms: number) => new Date(ms).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });

// "28/09/2026 14:32": an exact moment (used for "expires on").
export const dateTime = (ms: number) => `${dateFull(ms)} ${hhmm(ms)}`;

// "42 min", "2h 05m", "3 days": how long is left (rounded up to the minute).
export const timeLeft = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60000));
  if (min < 60) return i18n.t('time.minLeft', { count: min });
  if (min < 48 * 60) return i18n.t('time.hourMin', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
  return i18n.t('time.dayLeft', { count: Math.floor(min / 1440) });
};

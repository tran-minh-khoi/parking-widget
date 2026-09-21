// Data retention: this is an open-source app that keeps as little as possible, so nearly everything expires.
// Server-side twins of these numbers live at the top of functions/index.js — keep the two in sync.
export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

// A timed share lasts at most this long; longer than that it is "until the car is gone". Twin in firestore.rules.
export const SHARE_MAX_HOURS = 12;

export const RETENTION = {
  parking: 7 * DAY, // an active parking is forgotten unless the owner taps "still parked" (needs an account)
  historyRecords: 30 * DAY, // closed parkings kept in History (on the phone only)
  historyPhotos: 3 * DAY, // ...but their photo is deleted after 3 days
  historyMax: 100,
  notifications: 14 * DAY, // in-app notifications
  conversation: 30 * DAY, // a share (chat, timeline) is deleted this long after it ended
} as const;

// The public website (Firebase Hosting): share / invite links, universal links, and the Privacy Policy / Terms
// (web/privacy.html, web/terms.html). Set EXPO_PUBLIC_SITE_URL in .env when you fork.
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://my-parking.mktechvn.com';
export const LEGAL_HOST = SITE_URL;

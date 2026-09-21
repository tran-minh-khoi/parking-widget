import { requireOptionalNativeModule } from 'expo';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { normPhone } from '@/features/account/phone';
import { app } from '@/lib/firebase';

// "Which of my contacts already use My Parking?" The phone's contacts are compared on the server with member phone
// numbers / emails; nothing is stored (see matchContacts in functions/index.js).

export type ContactMatch = { uid: string; name: string; photoURL: string; contact: string }; // contact = their name in my phone
export type SyncResult = 'unavailable' | 'denied' | ContactMatch[];

export const syncContacts = async (): Promise<SyncResult> => {
  // an older install without the native module can't read contacts: it needs a rebuild
  if (!requireOptionalNativeModule('ExpoContacts')) return 'unavailable';
  const Contacts = await import('expo-contacts/legacy');
  if ((await Contacts.requestPermissionsAsync()).status !== 'granted') return 'denied';
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails] });

  const owner = new Map<string, string>(); // phone (E.164) or email -> the contact's name
  for (const c of data) {
    const name = c.name ?? '';
    for (const p of c.phoneNumbers ?? []) {
      const n = normPhone(p.number ?? '');
      if (n) owner.set(n, name);
    }
    for (const e of c.emails ?? []) if (e.email) owner.set(e.email.trim().toLowerCase(), name);
  }
  const keys = [...owner.keys()];
  const call = httpsCallable<{ phones: string[]; emails: string[] }, { key: string; uid: string; name: string; photoURL: string }[]>(
    getFunctions(app, 'asia-southeast1'),
    'matchContacts',
  );
  const { data: hits } = await call({ phones: keys.filter((k) => k.startsWith('+')), emails: keys.filter((k) => k.includes('@')) });
  // one person can match by phone and by email: list them once
  const byUid = new Map<string, ContactMatch>();
  for (const h of hits) if (!byUid.has(h.uid)) byUid.set(h.uid, { uid: h.uid, name: h.name, photoURL: h.photoURL, contact: owner.get(h.key) ?? '' });
  return [...byUid.values()].sort((a, b) => a.name.localeCompare(b.name));
};

import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLive } from '@/lib/live';

// In-app notification centre. Docs are written by Cloud Functions next to each push
// (chat messages, share accepted / picked up / closed).
export type Notice = {
  id: string;
  type: 'message' | 'share' | 'trust' | 'friend' | 'spot' | 'system';
  title: string;
  body: string;
  shareId?: string;
  refUid?: string; // the person a trust / parking notification is about
  read: boolean;
  createdAt: number;
};

const KEEP = 14 * 24 * 3600 * 1000; // Cloud Functions delete older ones; hide them right away too

const NO_NOTICES: Notice[] = [];
export const useInbox = (uid?: string) => {
  const { data, loading, error, refresh } = useLive<Notice[]>(
    uid ? `inbox:${uid}` : null,
    (set, fail) =>
      onSnapshot(
        query(collection(db, 'users', uid!, 'notifications'), orderBy('createdAt', 'desc'), limit(50)),
        (s) =>
          set(
            s.docs
              .map((d) => ({ ...(d.data() as Notice), id: d.id, createdAt: d.data().createdAt?.toMillis?.() ?? Date.now() }))
              .filter((n) => Date.now() - n.createdAt < KEEP),
          ),
        fail,
      ),
    NO_NOTICES,
  );
  return { notices: data, unread: data.filter((n) => !n.read).length, loading, error, refresh };
};

export const markRead = (uid: string, id: string) => updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });

export const markAllRead = (uid: string, notices: Notice[]) => {
  const batch = writeBatch(db);
  notices.filter((n) => !n.read).forEach((n) => batch.update(doc(db, 'users', uid, 'notifications', n.id), { read: true }));
  return batch.commit();
};

export const deleteNotices = (uid: string, ids: string[]) => {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, 'users', uid, 'notifications', id)));
  return batch.commit();
};

import { RETENTION } from '@/config';
import i18n from '@/lib/i18n';
import { isPickup, type Share } from './shares';

// What happened to a share, in order. The entries are stamped by Cloud Functions (nobody can forge them);
// "expired" is derived from the clock. Shares older than the timeline get a best-effort one.
export type TimelineKind = 'shared' | 'asked' | 'accepted' | 'pickedUp' | 'declined' | 'closed' | 'revoked' | 'expired';
export type TimelineEntry = { t: TimelineKind; by: string; to?: string; at: number };

export const timelineOf = (s: Share): TimelineEntry[] => {
  const list: TimelineEntry[] = [...(s.timeline ?? [])];
  if (!list.length) {
    list.push(isPickup(s) ? { t: 'asked', by: s.ownerName, to: s.inviteeName, at: s.parkedAt } : { t: 'shared', by: s.ownerName, at: s.parkedAt });
    if (s.status === 'pickedUp' && s.pickedUpAt) list.push({ t: 'pickedUp', by: s.recipientName ?? '', at: s.pickedUpAt });
  }
  if ((s.status === 'open' || s.status === 'accepted') && s.expiresAt <= Date.now()) list.push({ t: 'expired', by: '', at: s.expiresAt });
  return list.sort((a, b) => a.at - b.at);
};

// "Nam asked Khôi to pick the car up", "Khôi confirmed picking the car up", ...
export const timelineText = (e: TimelineEntry, s: Share) =>
  i18n.t(`timeline.${e.t === 'accepted' && isPickup(s) ? 'acceptedPickup' : e.t}`, { name: e.by, to: e.to });

// When the whole conversation is removed automatically.
export const deleteOn = (s: Share) => s.deleteAt ?? s.expiresAt + RETENTION.conversation;

export const hasEnded = (s: Share) => s.status === 'pickedUp' || s.status === 'closed' || s.status === 'revoked' || s.status === 'declined' || s.expiresAt <= Date.now();

import { RETENTION } from '@/config';

export type Place = { title: string; address: string }; // e.g. "Vincom Center Đồng Khởi" + street address

export type Spot = {
  lat: number;
  lng: number;
  photo: string; // full-size file uri (app sandbox); '' once auto-deleted from History
  thumb: string; // small base64 jpeg, embedded in share docs
  parkedAt: number;
  place?: Place; // nearest place looked up from the coordinates
  note?: string; // optional: pillar / floor, e.g. "B2 - C14"
  renewedAt?: number; // last "still parked" tap; restarts the 7-day countdown
  shareIds?: string[]; // every link sent for this parking, closed when the car is taken
  untilIds?: string[]; // the shares meant to last until the car is gone: extended when the parking is renewed
  closedAt?: number; // set once it moves to History
  closeReason?: 'gotCar' | 'expired';
};

// Share for N hours, or until the car is gone (= as long as this parking lasts, extended on renew).
export type ShareFor = number | 'until';

export const expiresAt = (s: Spot) => (s.renewedAt ?? s.parkedAt) + RETENTION.parking;
export const isLive = (s: Spot) => Date.now() < expiresAt(s);

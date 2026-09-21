import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

import { DAY } from '@/config';
import { widgetDirectionsUrl } from '@/features/directions/nav';
import type { Share } from '@/features/sharing/shares';
import { formatDistance } from '@/lib/geo';
import i18n from '@/lib/i18n';
import { dateShort, hhmm } from '@/lib/time';
import ParkingActivity from '@/widgets/ParkingActivity';
import ParkingWidget from '@/widgets/ParkingWidget';
import { expiresAt, isLive, type Spot } from './model';

// Everything that shows the parking outside the app: the home-screen widget, the lock-screen card and the
// Dynamic Island. They are drawn by the widget runtime from plain props, so this file is the only place that
// turns app state (spot, distance, who was asked to pick it up, a spot shared with me) into those props.

export const widgetThumbFile = () => new File(widgetsDirectory, 'spot.jpg');
const sharedThumbFile = () => new File(widgetsDirectory, 'shared.jpg');

// ---- state pushed in from the rest of the app -------------------------------------------------------
export type PickupInfo = { name: string; status: 'open' | 'accepted' | 'declined' } | null;
let pickup: PickupInfo = null; // a friend I asked to pick this car up
let carDistance: number | undefined; // metres from me to my car
let liveSpot: Spot | null = null;
let shared: Share | null = null; // a spot someone shared with me and I accepted
let synced = false; // has liveSpot been set at least once since launch?
let widgetPushedAt = 0;

// ---- text -------------------------------------------------------------------------------------------
const labels = () => ({
  title: i18n.t('widget.title'),
  empty: i18n.t('widget.empty'),
  gotCar: i18n.t('widget.gotCar'),
  directions: i18n.t('widget.directions'),
  share: i18n.t('widget.share'),
  parkedLabel: i18n.t('widget.parkedAt'),
  stillHere: i18n.t('widget.stillHere'),
});
const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
// "Expires 28/9" (or "Expires at 14:32" inside the last 24h): the parking is forgotten unless renewed.
const expiresText = (spot: Spot) => {
  const exp = expiresAt(spot);
  return exp - Date.now() < DAY ? i18n.t('widget.expiresAt', { time: hhmm(exp) }) : i18n.t('widget.expires', { date: dateShort(exp) });
};
const pickupText = () => (pickup ? i18n.t(`widget.pickup_${pickup.status}`, { name: pickup.name }) : undefined);
const distanceProps = () =>
  carDistance === undefined
    ? {}
    : { distance: i18n.t('widget.away', { d: formatDistance(carDistance) }), distanceShort: formatDistance(carDistance) };

// ---- props ------------------------------------------------------------------------------------------
// "My parked car", described once for the widget and the lock-screen / island card.
const mineProps = (spot: Spot) => ({
  address: clip(spot.place?.title, 28),
  note: spot.note,
  photo: widgetThumbFile().uri,
  parkedAt: spot.parkedAt,
  lat: spot.lat,
  lng: spot.lng,
  mapsUrl: widgetDirectionsUrl(spot.lat, spot.lng, spot.place?.title || spot.note),
  expiresText: expiresText(spot),
  pickup: pickupText(),
  pickupStatus: pickup?.status,
  ...distanceProps(),
});

const activityProps = (spot: Spot) => ({ ...labels(), ...mineProps(spot) });

// The widget shows my car, else the accepted shared spot, else the "tap to photograph" prompt.
const widgetProps = (live: Spot | null) => {
  const base = { ...labels(), hint: i18n.t('widget.tapToPhoto') };
  if (live) return { ...base, kind: 'mine' as const, ...mineProps(live) };
  if (shared && shared.lat != null && shared.lng != null) {
    const label = shared.placeTitle || shared.note;
    return {
      ...base,
      kind: 'shared' as const,
      title: i18n.t('shared.title', { name: shared.ownerName }),
      address: clip(shared.placeTitle || undefined, 28),
      note: shared.note || undefined,
      photo: sharedThumbFile().uri,
      parkedAt: shared.parkedAt,
      lat: shared.lat,
      lng: shared.lng,
      mapsUrl: widgetDirectionsUrl(shared.lat, shared.lng, label),
      url: `myparking://s/${shared.id}`,
    };
  }
  return base;
};

// ---- pushing to the system ---------------------------------------------------------------------------
// iOS ends a Live Activity after 8h, so it is (re)started whenever the app opens with a live spot;
// the home-screen widget covers the rest of the parking.
const syncActivity = (spot: Spot | null) => {
  try {
    const [current] = ParkingActivity.getInstances();
    if (!spot) return void current?.end('immediate');
    if (current) current.update(activityProps(spot));
    else ParkingActivity.start(activityProps(spot), 'myparking://');
  } catch {} // Live Activities disabled by the user / unsupported OS
};

const pushWidget = (live: Spot | null) => {
  const entries = [{ date: new Date(), props: widgetProps(live) }];
  if (live) entries.push({ date: new Date(expiresAt(live)), props: widgetProps(null) }); // blank at expiry even if the app is never opened
  ParkingWidget.updateTimeline(entries);
  widgetPushedAt = Date.now();
};

// The one entry point: call whenever the parking (or anything drawn from it) changed.
export const syncWidget = (spot: Spot | null) => {
  const live = spot && isLive(spot) ? spot : null;
  liveSpot = live;
  synced = true;
  if (!live) carDistance = undefined;
  syncActivity(live);
  pushWidget(live);
};

const refresh = () => {
  if (!synced) return; // the first syncWidget (right after launch) will draw everything
  syncActivity(liveSpot);
  pushWidget(liveSpot);
};

export const setPickup = (info: PickupInfo) => {
  if (info?.name === pickup?.name && info?.status === pickup?.status) return;
  pickup = info;
  refresh();
};

// The lock-screen card updates freely; iOS budgets widget reloads, so the home widget gets at most one per 5 minutes.
export const setCarDistance = (spot: Spot, m: number) => {
  const changed = carDistance === undefined || Math.abs(m - carDistance) >= 20;
  carDistance = m;
  liveSpot = spot;
  synced = true;
  if (!changed) return;
  syncActivity(spot);
  if (Date.now() - widgetPushedAt > 5 * 60 * 1000) pushWidget(spot);
};

// A spot someone shared with me (and I accepted) also goes on the widget while I have no car of my own.
export const setSharedSpot = async (share: Share | null) => {
  if (share?.id === shared?.id && share?.note === shared?.note && share?.placeTitle === shared?.placeTitle) return;
  shared = share;
  if (share?.thumb) {
    try {
      const file = sharedThumbFile();
      if (!file.exists) file.create();
      file.write(new Uint8Array(await (await fetch(`data:image/jpeg;base64,${share.thumb}`)).arrayBuffer()));
    } catch {
      shared = null; // couldn't stage the photo: fall back to the empty prompt
    }
  }
  refresh();
};

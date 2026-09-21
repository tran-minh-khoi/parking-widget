import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

// Which maps app "Directions" opens: ask every time (default) or a remembered choice.
export type NavApp = 'apple' | 'google' | 'waze';
export type NavPref = NavApp | 'ask';
export const NAV_LABELS: Record<NavApp, string> = { apple: 'Apple Maps', google: 'Google Maps', waze: 'Waze' };

let pref: NavPref = 'ask';
export const getNavPref = () => pref;
export const loadNavPref = async () => {
  const v = await AsyncStorage.getItem('navPref').catch(() => null);
  if (v === 'apple' || v === 'google' || v === 'waze') pref = v;
  return pref;
};
export const setNavPref = async (p: NavPref) => {
  pref = p;
  await AsyncStorage.setItem('navPref', p).catch(() => {});
};

// The destination is always the exact saved coordinates; `label` (the place name, e.g. "05 Alley 252 Cao Thang")
// is passed along so the maps app can show a name instead of bare coordinates.
export const directionsUrl = (app: NavApp, lat: number, lng: number, label?: string) => {
  const name = label ? encodeURIComponent(label) : '';
  if (Platform.OS === 'android') return `geo:${lat},${lng}?q=${lat},${lng}${name ? `(${name})` : ''}`; // Android's chooser picks the app
  if (app === 'google') return `comgooglemaps://?daddr=${lat},${lng}&directionsmode=walking${name ? `&q=${name}` : ''}`;
  if (app === 'waze') return `waze://?ll=${lat},${lng}&navigate=yes${name ? `&q=${name}` : ''}`;
  return `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w${name ? `&q=${name}` : ''}`;
};

// Widgets can't run code: hand them the chosen app's URL, or a link back into the app that shows the chooser.
export const widgetDirectionsUrl = (lat: number, lng: number, label?: string) =>
  pref === 'ask' && Platform.OS === 'ios'
    ? `myparking://directions?lat=${lat}&lng=${lng}${label ? `&label=${encodeURIComponent(label)}` : ''}`
    : directionsUrl(pref === 'ask' ? 'apple' : pref, lat, lng, label);

// canOpenURL needs the schemes listed in LSApplicationQueriesSchemes (app.json).
export const installedApps = async (): Promise<NavApp[]> => {
  const apps: NavApp[] = ['apple'];
  if (await Linking.canOpenURL('comgooglemaps://').catch(() => false)) apps.push('google');
  if (await Linking.canOpenURL('waze://').catch(() => false)) apps.push('waze');
  return apps;
};

export const openDirections = (app: NavApp, lat: number, lng: number, label?: string) => Linking.openURL(directionsUrl(app, lat, lng, label));

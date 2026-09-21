import { existsSync, readFileSync } from 'fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Firebase's native config files are per-project and not committed (see README → Firebase). Locally they sit in the repo
// root; on EAS Build they are file secrets and their path arrives in these variables.
const iosFile = process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist';
const androidFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

// REVERSED_CLIENT_ID only appears in the plist once Google sign-in is enabled in the
// Firebase console and GoogleService-Info.plist is re-downloaded.
const plist = existsSync(iosFile) ? readFileSync(iosFile, 'utf8') : '';
const iosUrlScheme =
  plist.match(/REVERSED_CLIENT_ID<\/key>\s*<string>(.+?)<\/string>/)?.[1] ?? 'com.googleusercontent.apps.0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'My Parking',
  slug: config.slug ?? 'my-parking-widget',
  ios: { ...config.ios, googleServicesFile: iosFile },
  android: { ...config.android, googleServicesFile: androidFile },
  plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
});

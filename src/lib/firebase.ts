import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-expect-error firebase's public typings omit the RN entry point; Metro resolves it at runtime
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { SITE_URL } from '@/config';

// The Firebase web config is an identifier, not a secret: access is enforced by firestore.rules / storage.rules.
// It comes from .env (see .env.example) so a fork can point the app at its own project.
// Expo inlines `process.env.EXPO_PUBLIC_*` only when it is written out literally, so each value is read here, not by name.
const need = (name: string, value?: string) => {
  if (!value && __DEV__) console.warn(`[config] ${name} is not set: copy .env.example to .env`);
  return value ?? '';
};

export const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: need('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
      authDomain: need('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
      projectId: need('EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      storageBucket: need('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
      messagingSenderId: need('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      appId: need('EXPO_PUBLIC_FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
    });

export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app); // already initialised (fast refresh)
  }
})();

export const db = getFirestore(app);
export const storage = getStorage(app);

// Public site on Firebase Hosting (custom domain): share / invite links and the universal-link file.
export const SHARE_HOST = SITE_URL;
// Firebase console → Authentication → Google → Web SDK configuration → Web client ID
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

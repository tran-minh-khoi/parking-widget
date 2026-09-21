import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import vi from '../locales/vi.json';

export const LANGS = { vi: 'Tiếng Việt', en: 'English' } as const;
export type Lang = keyof typeof LANGS;

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: getLocales()[0]?.languageCode === 'vi' ? 'vi' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export const loadLang = async () => {
  const saved = await AsyncStorage.getItem('lang').catch(() => null);
  if (saved && saved in LANGS) await i18n.changeLanguage(saved);
};

export const setLang = (l: Lang) => {
  i18n.changeLanguage(l);
  AsyncStorage.setItem('lang', l).catch(() => {});
};

export default i18n;

import { Alert } from 'react-native';

import i18n from './i18n';

// An error whose message is already meant for the user (and already translated).
export class AppError extends Error {
  name = 'AppError';
}

// Turn any thrown value into a short message in the app language. Firebase / native error text is technical
// English, so it is mapped to a friendly translated line; the original is only logged in development.
export const errorText = (e: unknown) => {
  if (e instanceof AppError) return e.message;
  const code = String((e as { code?: string })?.code ?? '');
  const msg = String((e as { message?: string })?.message ?? '');
  if (__DEV__) console.warn('[error]', code, msg);
  if (/permission-denied|unauthorized|forbidden/.test(code)) return i18n.t('errors.permission');
  if (/unauthenticated|requires-recent-login/.test(code)) return i18n.t('errors.signIn');
  if (/unavailable|network|deadline|timeout/.test(code) || /network|offline|timed out/i.test(msg)) return i18n.t('errors.network');
  if (/not-found|object-not-found/.test(code)) return i18n.t('errors.notFound');
  return i18n.t('errors.generic');
};

export const showError = (e: unknown) => Alert.alert(i18n.t('common.error'), errorText(e));

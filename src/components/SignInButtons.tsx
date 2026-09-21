import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { signInApple, signInGoogle } from '@/features/account/auth';
import { Button } from '@/components/ui';
import { showError } from '@/lib/feedback';

export function SignInButtons({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false); // signing in: one attempt at a time, and say so
  useEffect(() => void AppleAuthentication.isAvailableAsync().then(setApple), []);

  const run = (fn: () => Promise<boolean>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await fn()) onDone?.();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.col}>
      {apple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={28}
          style={[s.apple, busy && { opacity: 0.5 }]}
          onPress={run(signInApple)}
        />
      )}
      <Button label={t('login.google')} icon="logo-google" busy={busy} onPress={run(signInGoogle)} />
    </View>
  );
}

const s = StyleSheet.create({ col: { gap: 12, alignSelf: 'stretch' }, apple: { height: 56 } });

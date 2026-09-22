import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resetPassword, signInApple, signInEmail, signInGoogle, signUpEmail } from '@/features/account/auth';
import { Button, st } from '@/components/ui';
import { AppError } from '@/lib/errors';
import { showDone, showError } from '@/lib/feedback';
import { C } from '@/lib/theme';

export function SignInButtons({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false); // signing in: one attempt at a time, and say so
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const submitEmail = run(() => {
    if (!email.trim() || !password) throw new AppError(t('errors.badEmail'));
    return (signUp ? signUpEmail : signInEmail)(email, password);
  });

  const forgot = run(async () => {
    if (!email.trim()) throw new AppError(t('errors.badEmail'));
    await resetPassword(email);
    showDone(t('login.resetSent'));
    return false; // stay on screen
  });

  return (
    <View style={s.col}>
      <TextInput
        style={st.input}
        placeholder={t('login.email')}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={st.input}
        placeholder={t('login.password')}
        placeholderTextColor={C.muted}
        secureTextEntry
        textContentType={signUp ? 'newPassword' : 'password'}
        value={password}
        onChangeText={setPassword}
      />
      <Button label={t(signUp ? 'login.createAccount' : 'login.signIn')} busy={busy} onPress={submitEmail} />
      <View style={s.links}>
        <Text style={s.link} onPress={() => setSignUp((v) => !v)}>{t(signUp ? 'login.haveAccount' : 'login.noAccount')}</Text>
        {!signUp && <Text style={s.link} onPress={forgot}>{t('login.forgot')}</Text>}
      </View>
      <Text style={s.or}>{t('login.or')}</Text>
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

const s = StyleSheet.create({
  col: { gap: 12, alignSelf: 'stretch' },
  apple: { height: 56 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: C.gold, fontSize: 13, fontWeight: '600' },
  or: { color: C.muted, fontSize: 13, textAlign: 'center' },
});

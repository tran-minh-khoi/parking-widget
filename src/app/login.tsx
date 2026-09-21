import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LegalAgree } from '@/components/LegalLinks';
import { SignInButtons } from '@/components/SignInButtons';
import { C, PAD } from '@/lib/theme';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={s.root}>
      <Text style={s.emoji}>🚗</Text>
      <Text style={s.title}>{t('login.title')}</Text>
      <Text style={s.sub}>{t('login.subtitle')}</Text>
      <SignInButtons onDone={() => router.back()} />
      <LegalAgree />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: PAD + 4, justifyContent: 'center', gap: 14 },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { color: C.gold, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.muted, fontSize: 15, textAlign: 'center', marginBottom: 20 },
});

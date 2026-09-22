import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LegalAgree } from '@/components/LegalLinks';
import { SignInButtons } from '@/components/SignInButtons';
import { C, PAD } from '@/lib/theme';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
        <View style={s.handle} />
        <Text style={s.emoji}>🚗</Text>
        <Text style={s.title}>{t('login.title')}</Text>
        <Text style={s.sub}>{t('login.subtitle')}</Text>
        <SignInButtons onDone={() => router.back()} />
        <LegalAgree />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  root: { flexGrow: 1, padding: PAD + 4, justifyContent: 'center', gap: 14 },
  handle: { position: 'absolute', top: 8, alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.card2 },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { color: C.gold, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.muted, fontSize: 15, textAlign: 'center', marginBottom: 20 },
});

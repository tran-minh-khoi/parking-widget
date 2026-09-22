import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, st } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { C } from '@/lib/theme';

// What a screen shows a guest instead of its content: an icon, one sentence, and the sign-in button.
export function SignInPrompt({ icon, text }: { icon: IconName; text: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={s.box}>
      <Ionicons name={icon} size={48} color={C.muted} />
      <Text style={st.hint}>{text}</Text>
      <Button label={t('account.signInUp')} onPress={() => router.push('/login')} />
    </View>
  );
}

const s = StyleSheet.create({ box: { alignItems: 'center', gap: 14, paddingTop: 80 } });

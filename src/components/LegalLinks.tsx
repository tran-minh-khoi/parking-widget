import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { st } from '@/components/ui';
import { LEGAL_HOST } from '@/config';
import { C } from '@/lib/theme';

type Doc = '/privacy' | '/terms';

const openDoc = (doc: Doc, lang: string) =>
  WebBrowser.openBrowserAsync(`${LEGAL_HOST}${doc}?lang=${lang}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: C.gold,
    toolbarColor: C.bg,
  }).catch(() => {});

// "By continuing you agree to the Terms of Use and the Privacy Policy." with both names tappable.
export function LegalAgree() {
  const { i18n } = useTranslation();
  return (
    <Text style={s.agree}>
      <Trans
        i18nKey="legal.agree"
        components={{
          terms: <Text style={s.link} onPress={() => openDoc('/terms', i18n.language)} />,
          privacy: <Text style={s.link} onPress={() => openDoc('/privacy', i18n.language)} />,
        }}
      />
    </Text>
  );
}

// The two documents as rows (Account screen).
export function LegalRows() {
  const { t, i18n } = useTranslation();
  const rows: { doc: Doc; icon: 'document-text-outline' | 'shield-checkmark-outline'; label: string }[] = [
    { doc: '/terms', icon: 'document-text-outline', label: t('legal.terms') },
    { doc: '/privacy', icon: 'shield-checkmark-outline', label: t('legal.privacy') },
  ];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <Pressable key={r.doc} style={st.row} onPress={() => openDoc(r.doc, i18n.language)}>
          <Ionicons name={r.icon} size={22} color={C.gold} />
          <Text style={[st.rowTitle, { flex: 1 }]}>{r.label}</Text>
          <Ionicons name="open-outline" size={18} color={C.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  agree: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  link: { color: C.gold, fontWeight: '700' },
});

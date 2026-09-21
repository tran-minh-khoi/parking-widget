import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CountryPicker } from '@/components/CountryPicker';
import { st } from '@/components/ui';
import { dialOf, flag, type CountryCode } from '@/features/account/phone';
import { C } from '@/lib/theme';

// Country code button (opens the searchable picker) + the national number.
export function PhoneField({ country, national, onCountry, onNational }: {
  country: CountryCode; national: string; onCountry: (c: CountryCode) => void; onNational: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={s.row}>
      <Pressable style={s.dial} onPress={() => setOpen(true)}>
        <Text style={s.flag}>{flag(country)}</Text>
        <Text style={s.dialText}>{dialOf(country)}</Text>
        <Ionicons name="chevron-down" size={14} color={C.muted} />
      </Pressable>
      <TextInput
        style={[st.input, { flex: 1 }]}
        value={national}
        onChangeText={(v) => onNational(v.replace(/[^\d\s]/g, ''))}
        placeholder={t('account.phone')}
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        maxLength={16}
      />
      <CountryPicker visible={open} country={country} onClose={() => setOpen(false)} onPick={(c) => (onCountry(c), setOpen(false))} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  dial: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 50, borderRadius: 24, borderCurve: 'continuous', backgroundColor: C.card, paddingHorizontal: 14 },
  flag: { fontSize: 20 },
  dialText: { color: C.text, fontSize: 16, fontWeight: '700' },
});

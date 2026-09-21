import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { flag, listCountries, searchCountries, type CountryCode } from '@/features/account/phone';
import { C } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { st } from '@/components/ui';

// Bottom sheet with every country (searchable by name, code or dial code) to pick a phone country.
export function CountryPicker({
  visible, country, onPick, onClose,
}: { visible: boolean; country: CountryCode; onPick: (code: CountryCode) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const all = useMemo(() => listCountries(i18n.language), [i18n.language]);
  const shown = useMemo(() => searchCountries(all, q), [all, q]);
  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} height="78%" keyboardAvoiding>
            <Text style={st.title}>{t('account.countryCode')}</Text>
            <View style={s.search}>
              <Ionicons name="search" size={18} color={C.muted} />
              <TextInput
                style={s.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder={t('account.countrySearch')}
                placeholderTextColor={C.muted}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <FlatList
              data={shown}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={s.list}
              initialNumToRender={20}
              ListEmptyComponent={<Text style={s.empty}>{t('account.countryNone')}</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={s.row}
                  onPress={() => {
                    setQ('');
                    onPick(item.code);
                  }}
                >
                  <Text style={s.flag}>{flag(item.code)}</Text>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.dial}>{item.dial}</Text>
                  {country === item.code && <Ionicons name="checkmark-circle" size={20} color={C.gold} />}
                </Pressable>
              )}
            />
    </Sheet>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 22, borderCurve: 'continuous', paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, color: C.text, fontSize: 16 },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  flag: { fontSize: 24 },
  name: { color: C.text, fontSize: 16, flex: 1 },
  dial: { color: C.muted, fontSize: 15, fontWeight: '700' },
  empty: { color: C.muted, textAlign: 'center', paddingTop: 30 },
});

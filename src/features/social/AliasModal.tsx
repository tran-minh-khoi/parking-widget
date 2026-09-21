import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, st } from '@/components/ui';
import { C, PAD } from '@/lib/theme';

// Give a friend a nickname only I can see. Empty = back to their real name.
export function AliasModal({ visible, realName, initial, onSave, onClose }: {
  visible: boolean;
  realName: string;
  initial: string;
  onSave: (alias: string) => unknown; // a promise shows a spinner on the Save button
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <View style={s.card} onStartShouldSetResponder={() => true}>
            <Text style={st.title}>{t('alias.title')}</Text>
            <Text style={st.hint}>{t('alias.hint', { name: realName })}</Text>
            <TextInput
              style={st.input}
              value={text}
              onChangeText={setText}
              placeholder={realName}
              placeholderTextColor={C.muted}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => onSave(text)}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button variant="dark" label={t('common.cancel')} onPress={onClose} style={{ flex: 1 }} />
              <Button label={t('common.save')} onPress={() => onSave(text)} style={{ flex: 1 }} />
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: PAD },
  card: { backgroundColor: C.bg, borderRadius: 28, borderCurve: 'continuous', padding: PAD, gap: 14 },
});

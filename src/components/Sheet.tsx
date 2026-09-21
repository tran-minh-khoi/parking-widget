import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type DimensionValue } from 'react-native';

import { C, PAD } from '@/lib/theme';

// The bottom sheet every chooser uses (share duration, maps app, country code): dimmed backdrop, rounded top,
// tap outside to close. `height` for a tall list, `keyboardAvoiding` when the sheet has a text field.
export function Sheet({ visible, onClose, height, keyboardAvoiding, children }: {
  visible: boolean;
  onClose: () => void;
  height?: DimensionValue;
  keyboardAvoiding?: boolean;
  children: ReactNode;
}) {
  const body = (
    <Pressable style={s.backdrop} onPress={onClose}>
      <View style={[s.sheet, height ? { height } : null]} onStartShouldSetResponder={() => true}>
        {children}
      </View>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', padding: PAD, paddingBottom: 40, gap: 12 },
});

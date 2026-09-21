import { Image } from 'expo-image';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/ui';

// Full-screen photo: pinch to zoom, tap the X (or swipe the sheet away) to close.
export function ImageViewer({ uri, visible, onClose }: { uri?: string; visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.root}>
        <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} /> {/* under the photo: visible only while it loads */}
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height, justifyContent: 'center' }}
        >
          <Pressable onPress={onClose}>
            <Image source={uri} style={{ width, height }} contentFit="contain" />
          </Pressable>
        </ScrollView>
        <View style={[s.close, { top: insets.top + 8 }]}>
          <CircleButton icon="close" size={44} bg="rgba(28,28,30,0.85)" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: 16 },
});

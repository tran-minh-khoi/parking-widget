import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showError } from './errors';
import i18n from './i18n';
import { C, PAD } from './theme';

// How the app talks back to the person. Every screen uses these four (nothing calls Alert / builds its own toast):
//   confirm()    ask before something that can't be undone
//   trackBusy()  "working…" overlay for a slow action that starts from an alert / menu
//   showDone()   a short confirmation once something worked and the result isn't obvious on screen
//   showError()  something failed (errors.ts, re-exported here)
// perform() ties them together: busy overlay while the work runs, the confirmation on success, the error on failure.
export { showError };

// ── confirm ─────────────────────────────────────────────────────────────────
export const confirm = ({ title, message, action, cancelLabel, destructive = true, onConfirm, onCancel }: {
  title: string;
  message?: string;
  action: string; // the button that does it ("Delete", "Send request"...)
  cancelLabel?: string; // when "Cancel" isn't the right word for the other choice ("Skip")
  destructive?: boolean;
  onConfirm: () => unknown;
  onCancel?: () => void;
}) =>
  Alert.alert(title, message, [
    { text: cancelLabel ?? i18n.t('common.cancel'), style: 'cancel', onPress: onCancel },
    { text: action, style: destructive ? 'destructive' : 'default', onPress: () => void onConfirm() },
  ]);

// ── busy overlay ────────────────────────────────────────────────────────────
// Shows after a short delay (quick actions never flash it) and blocks taps until the work settles.
let working = 0;
let overlayVisible = false; // the Modal is actually on screen right now (after its 250ms delay)
const busySubs = new Set<() => void>();
const busyEmit = () => busySubs.forEach((f) => f());
const dismissWaiters: (() => void)[] = [];

export const trackBusy = async <T,>(work: Promise<T>): Promise<T> => {
  working++;
  busyEmit();
  try {
    return await work;
  } finally {
    working--;
    busyEmit();
    // The overlay was actually shown, so its close animation may still be running (iOS): wait for it to really be
    // gone before the caller goes on to open anything else (an alert, another sheet, the native share sheet) — doing
    // that while our modal is still dismissing is exactly what makes iOS silently drop the next one.
    if (working === 0 && overlayVisible) await new Promise<void>((resolve) => dismissWaiters.push(resolve));
  }
};

export function BusyOverlay() {
  const n = useSyncExternalStore((cb) => (busySubs.add(cb), () => void busySubs.delete(cb)), () => working);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!n) return setShow(false);
    const id = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(id);
  }, [n]);
  useEffect(() => {
    overlayVisible = show;
  }, [show]);
  return (
    <Modal
      visible={show}
      transparent
      animationType="fade"
      onDismiss={() => dismissWaiters.splice(0).forEach((r) => r())}
      onRequestClose={() => {}} // Android hardware back while busy: swallow it, don't pop the screen mid-action
    >
      <View style={s.back}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    </Modal>
  );
}

// ── done toast ──────────────────────────────────────────────────────────────
type Toast = { id: number; text: string };
let toastId = 0;
const toastSubs = new Set<(t: Toast) => void>();

// Something worked: a check mark and one sentence at the top of the screen, gone after a moment.
export const showDone = (text: string) => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  toastSubs.forEach((f) => f({ id: ++toastId, text }));
};

export function DoneToast() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast>();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    toastSubs.add(setToast);
    return () => void toastSubs.delete(setToast);
  }, []);
  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const id = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(), 2800);
    return () => clearTimeout(id);
  }, [toast, opacity]);
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.toastWrap, { top: insets.top + 8, opacity }]}>
      <View style={s.toast}>
        <Ionicons name="checkmark-circle" size={22} color={C.ok} />
        <Text style={s.toastText}>{toast.text}</Text>
      </View>
    </Animated.View>
  );
}

// ── perform ─────────────────────────────────────────────────────────────────
// Run an action the usual way. Resolves to whether it worked (a failure was already shown to the person).
// Do anything with the result inside `work` (perform(load().then(setState), ...)), so it runs before the confirmation.
// overlay=false when the caller shows its own spinner (a Button) or the action opens a system sheet (Sign in with Apple).
export const perform = async (work: Promise<unknown>, done?: string, overlay = true): Promise<boolean> => {
  try {
    await (overlay ? trackBusy(work) : work);
    if (done) showDone(done);
    return true;
  } catch (e) {
    showError(e);
    return false;
  }
};

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', left: PAD, right: PAD, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card2, borderRadius: 24, borderCurve: 'continuous',
    borderWidth: 1, borderColor: C.gold, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '100%',
  },
  toastText: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
});

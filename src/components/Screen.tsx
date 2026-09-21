import type { ReactElement, ReactNode, Ref } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, PAD } from '@/lib/theme';
import { Header, type HeaderProps } from './Header';

// Shared screen shell: safe area, background, side padding, the header, optional scrolling
// (with pull-to-refresh and keyboard handling), room for the floating tab bar, and a pinned footer.
export type ScreenProps = {
  header?: HeaderProps;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollRef?: Ref<ScrollView>;
  tabbed?: boolean; // one of the tab screens: leave room for the floating tab bar
  keyboardAvoiding?: boolean; // e.g. a chat with an input pinned in `footer`
  footer?: ReactNode; // pinned below the content
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const TAB_BAR_ROOM = 120;

export function Screen({ header, scroll, refreshControl, scrollRef, tabbed, keyboardAvoiding, footer, contentStyle, children }: ScreenProps) {
  const bottom = tabbed ? TAB_BAR_ROOM : 32;
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={s.flex}
      contentContainerStyle={[s.content, { paddingBottom: bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets={!keyboardAvoiding}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, s.content, { paddingBottom: footer ? 0 : bottom }, contentStyle]}>{children}</View>
  );

  const content = (
    <>
      {body}
      {footer}
    </>
  );

  return (
    <SafeAreaView edges={tabbed ? ['top'] : ['top', 'bottom']} style={s.root}>
      {header && <Header {...header} />}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: PAD },
  flex: { flex: 1 },
  content: { gap: 14 },
});

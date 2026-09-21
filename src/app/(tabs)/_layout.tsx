import { Tabs } from 'expo-router';

import { PillTabBar } from '@/components/PillTabBar';
import { C } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <PillTabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="sharing" />
    </Tabs>
  );
}

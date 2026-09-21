import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { getNavPref, installedApps, NAV_LABELS, openDirections, setNavPref, type NavApp } from '@/features/directions/nav';
import { loadSpot } from '@/features/parking/spot';
import { syncWidget } from '@/features/parking/surfaces';
import { C } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { Button, st } from '@/components/ui';

// "Directions": opens the remembered maps app, or asks once (with an option to remember the choice).
export function useDirections(onDone?: () => void) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<{ lat: number; lng: number; label?: string }>();
  const [apps, setApps] = useState<NavApp[]>([]);
  const [remember, setRemember] = useState(false);

  const go = async (lat: number, lng: number, label?: string) => {
    const pref = getNavPref();
    const installed = Platform.OS === 'ios' ? await installedApps() : ['apple' as const];
    // nothing to choose between (or already chosen): open straight away
    if (pref !== 'ask' || installed.length === 1) {
      await openDirections(pref === 'ask' ? installed[0] : pref, lat, lng, label);
      return onDone?.();
    }
    setApps(installed);
    setRemember(false);
    setTarget({ lat, lng, label });
  };

  const close = () => {
    setTarget(undefined);
    onDone?.();
  };
  const choose = async (app: NavApp) => {
    if (!target) return;
    if (remember) {
      await setNavPref(app);
      loadSpot().then(syncWidget); // widgets get the chosen app's link
    }
    openDirections(app, target.lat, target.lng, target.label);
    close();
  };

  const sheet = (
    <Sheet visible={!!target} onClose={close}>
      <Text style={st.title}>{t('directions.title')}</Text>
      {apps.map((a) => (
        <Button key={a} variant="dark" icon="navigate-outline" label={NAV_LABELS[a]} onPress={() => choose(a)} />
      ))}
      <View style={s.remember}>
        <Text style={s.rememberText}>{t('directions.remember')}</Text>
        <Switch value={remember} onValueChange={setRemember} trackColor={{ true: C.gold }} />
      </View>
      <Button variant="dark" label={t('common.cancel')} onPress={close} />
    </Sheet>
  );

  return { go, sheet };
}

const s = StyleSheet.create({
  remember: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 },
  rememberText: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
});

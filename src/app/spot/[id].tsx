import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadHistory } from '@/features/parking/history';
import { type Spot } from '@/features/parking/model';
import { C, SQUIRCLE } from '@/lib/theme';
import { RETENTION } from '@/config';
import { useDirections } from '@/features/directions/DirectionsSheet';
import { dateFull } from '@/lib/time';
import { HeaderBack } from '@/components/HeaderButtons';
import { ImageViewer } from '@/components/ImageViewer';
import { Screen } from '@/components/Screen';
import { Button, st } from '@/components/ui';

const HOUR = 3600 * 1000;

// One past parking from History. The photo is gone after 7 days; everything else stays.
export default function PastSpot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [spot, setSpot] = useState<Spot | null>();
  const [viewer, setViewer] = useState(false);
  const { go, sheet: directionsSheet } = useDirections();
  useEffect(() => void loadHistory().then((h) => setSpot(h.find((x) => String(x.parkedAt) === id) ?? null)), [id]);

  const fmt = (ms: number) => new Date(ms).toLocaleString(i18n.language, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric', year: 'numeric' });

  const hours = spot ? Math.max(1, Math.round(((spot.closedAt ?? spot.parkedAt) - spot.parkedAt) / HOUR)) : 0;
  const duration = hours >= 24 ? t('home.days', { count: Math.round(hours / 24) }) : t('history.hours', { count: hours });

  return (
    <Screen header={{ title: t('history.detailTitle'), left: <HeaderBack /> }} scroll>
      {directionsSheet}
      {spot === undefined ? (
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
      ) : spot ? (
        <View style={{ gap: 16 }}>
          <Pressable style={s.photo} disabled={!spot.photo} onPress={() => setViewer(true)}>
            {spot.photo ? (
              <Image source={spot.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={s.gone}>
                <Ionicons name="image-outline" size={44} color={C.muted} />
                <Text style={st.hint}>{t('history.photoGone')}</Text>
              </View>
            )}
          </Pressable>
          <ImageViewer uri={spot.photo} visible={viewer} onClose={() => setViewer(false)} />

          <View style={{ gap: 4 }}>
            <Text style={st.title}>{spot.place?.title ?? t('widget.title')}</Text>
            {spot.place?.address && spot.place.address !== spot.place.title ? <Text style={s.address}>{spot.place.address}</Text> : null}
            {spot.note ? <Text style={s.note}>{spot.note}</Text> : null}
          </View>

          <View style={{ gap: 10 }}>
            {row(t('history.parked'), fmt(spot.parkedAt))}
            {row(t('history.closed'), fmt(spot.closedAt ?? spot.parkedAt))}
            {row(t('history.duration'), duration)}
            {row(t('history.result'), t(spot.closeReason === 'expired' ? 'history.expired' : 'history.gotCar'))}
            {row(t('history.deleteOn'), dateFull((spot.closedAt ?? spot.parkedAt) + RETENTION.historyRecords))}
          </View>

          <Button variant="dark" label={t('history.viewLocation')} icon="location" onPress={() => go(spot.lat, spot.lng, spot.place?.title || spot.note)} />
        </View>
      ) : (
        <View style={s.gone}>
          <Text style={st.hint}>{spot === null ? t('history.missing') : ''}</Text>
        </View>
      )}
    </Screen>
  );
}

const row = (label: string, value: string) => (
  <View key={label} style={st.row}>
    <Text style={[st.rowSub, { flex: 1, marginTop: 0 }]}>{label}</Text>
    <Text style={st.rowTitle}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, backgroundColor: C.card, ...SQUIRCLE },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  address: { color: C.muted, fontSize: 14 },
  note: { color: C.gold, fontSize: 18, fontWeight: '800', marginTop: 2 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Share, StyleSheet, Text, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { PersonRow } from '@/components/Person';
import { Button, Pill, st } from '@/components/ui';
import { useUser, type Who } from '@/features/account/auth';
import { acceptFriend, sendFriend, useFriends } from '@/features/social/friends';
import { syncContacts, type ContactMatch, type SyncResult } from '@/features/social/contacts';
import { SHARE_HOST } from '@/lib/firebase';
import { perform, showError } from '@/lib/feedback';
import { C } from '@/lib/theme';

// One contact who uses the app, with what I can do about it: add, accept, or nothing (already friends / waiting).
function MatchRow({ m, me }: { m: ContactMatch; me: Who }) {
  const { t } = useTranslation();
  const router = useRouter();
  const friend = useFriends(me.uid).find((f) => f.other === m.uid);
  const action = !friend ? { label: t('friends.add'), gold: true, run: () => perform(sendFriend(me, m.uid), t('friends.requestSent', { name: m.name }), false) }
    : friend.status === 'pending' && friend.requester !== me.uid ? { label: t('friends.accept'), gold: true, run: () => perform(acceptFriend(me.uid, m.uid), t('friends.nowFriends', { name: m.name }), false) }
    : { label: t(friend.status === 'accepted' ? 'friends.friends' : 'friends.pending'), gold: false, run: undefined };
  return (
    <PersonRow
      uid={m.uid}
      name={m.name}
      photoURL={m.photoURL}
      title={m.name}
      onPress={() => router.push({ pathname: '/profile/[uid]', params: { uid: m.uid } })}
      right={<Pill text={action.label} size="md" color={action.gold ? C.gold : C.muted} filled={action.gold} onPress={action.run} />}
    >
      {m.contact && m.contact !== m.name ? <Text style={st.rowSub} numberOfLines={1}>{t('contacts.as', { name: m.contact })}</Text> : null}
    </PersonRow>
  );
}

// Friends from the phone's contacts: ask for access, then list who already uses My Parking.
export default function Contacts() {
  const { t } = useTranslation();
  const me = useUser();
  const [result, setResult] = useState<SyncResult>();
  const [busy, setBusy] = useState(true);
  const run = () => {
    setBusy(true);
    syncContacts()
      .then(setResult)
      .catch(showError)
      .finally(() => setBusy(false));
  };
  useEffect(run, []);

  const invite = () => Share.share({ message: t('friends.inviteMessage', { url: `${SHARE_HOST}/u/${me?.uid}` }) }).catch(() => {});

  return (
    <Screen header={{ title: t('friends.fromContacts'), left: <HeaderBack /> }} scroll contentStyle={{ gap: 10 }}>
      {busy ? (
        <View style={s.center}>
          <ActivityIndicator color={C.gold} />
          <Text style={st.hint}>{t('contacts.syncing')}</Text>
        </View>
      ) : result === 'denied' || result === 'unavailable' ? (
        <View style={s.center}>
          <Ionicons name="book-outline" size={48} color={C.muted} />
          <Text style={st.hint}>{t(result === 'denied' ? 'contacts.denied' : 'friends.contactsMissingBody')}</Text>
          {result === 'denied' && <Button label={t('contacts.settings')} icon="settings-outline" onPress={() => Linking.openSettings()} />}
        </View>
      ) : result && me ? (
        <>
          <Text style={st.hint}>{t(result.length ? 'contacts.found' : 'contacts.none', { count: result.length })}</Text>
          {result.map((m) => <MatchRow key={m.uid} m={m} me={me} />)}
          <Button variant="dark" icon="share-outline" label={t('friends.inviteShare')} onPress={invite} style={{ marginTop: 8 }} />
          <Button variant="dark" icon="refresh" label={t('contacts.refresh')} onPress={run} />
          <Text style={s.privacy}>{t('contacts.privacy')}</Text>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', gap: 14, paddingTop: 80 },
  privacy: { color: C.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 12, paddingTop: 4 },
});

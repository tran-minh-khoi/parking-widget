import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { HeaderAvatar, HeaderBell } from '@/components/HeaderButtons';
import { Screen } from '@/components/Screen';
import { useUser } from '@/features/account/auth';
import { findUser, useAlias, useContact, useFriendsLive, type Found, type Friend } from '@/features/social/friends';
import { SHARE_HOST } from '@/lib/firebase';
import { C } from '@/lib/theme';
import { formatWhen } from '@/lib/time';
import { useProfile, useTrustedSpot, useTrustsLive, type Trust } from '@/features/social/trust';
import { PersonRow } from '@/components/Person';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Button, ErrorNote, Pill, Skeleton, st, usePullRefresh } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { useDistance } from '@/lib/useDistance';
import { showError } from '@/lib/feedback';

// Someone I trust: are they parked right now, where, when, and how far is their car from me. Tap for the details.
function TrustedRow({ trust, me }: { trust: Trust; me: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = useProfile(trust.other);
  const alias = useAlias(trust.other);
  const active = trust.status === 'accepted';
  const email = useContact(active ? trust.other : undefined)?.email;
  const spot = useTrustedSpot(trust.other, active);
  const distance = useDistance(spot?.lat, spot?.lng);
  const incoming = trust.status === 'pending' && trust.requester !== me;
  const name = alias || p?.name || '…';
  return (
    <PersonRow
      uid={trust.other}
      size={48}
      title={name}
      onPress={() => router.push({ pathname: '/profile/[uid]', params: { uid: trust.other } })}
      right={
        spot && distance !== undefined ? (
          <View style={s.away}>
            <Ionicons name="walk" size={14} color={C.gold} />
            <Text style={s.awayText}>{formatDistance(distance)}</Text>
          </View>
        ) : !active ? (
          <Pill text={t(incoming ? 'trust.invite' : 'trust.pending')} color={incoming ? C.gold : C.muted} />
        ) : null
      }
    >
      {email ? <Text style={st.rowSub} numberOfLines={1}>{email}</Text> : null}
      {active ? (
        spot ? (
          <>
            <View style={s.status}>
              <View style={[s.dot, { backgroundColor: C.ok }]} />
              <Text style={s.statusText} numberOfLines={1}>{t('trust.parkedNow')}{spot.placeTitle ? ` · ${spot.placeTitle}` : ''}</Text>
            </View>
            <Text style={s.sub} numberOfLines={1}>{t('home.parkedAt', { time: formatWhen(spot.parkedAt) })}</Text>
          </>
        ) : (
          <View style={s.status}>
            <View style={[s.dot, { backgroundColor: C.muted }]} />
            <Text style={[s.statusText, { color: C.muted }]}>{t('trust.notParkedShort')}</Text>
          </View>
        )
      ) : (
        <Text style={st.rowSub}>{t(incoming ? 'trust.invited' : 'trust.waiting', { name })}</Text>
      )}
    </PersonRow>
  );
}

// A friend (or a pending friend request), with a shield when we also trust each other.
function FriendRow({ friend, me, trusted }: { friend: Friend; me: string; trusted: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = useProfile(friend.other);
  const alias = useAlias(friend.other);
  const email = useContact(friend.status === 'accepted' ? friend.other : undefined)?.email;
  const incoming = friend.status === 'pending' && friend.requester !== me;
  return (
    <PersonRow
      uid={friend.other}
      size={44}
      name={alias || p?.name}
      title={alias || p?.name || '…'}
      onPress={() => router.push({ pathname: '/profile/[uid]', params: { uid: friend.other } })}
      right={
        friend.status === 'accepted' ? (
          <Ionicons name={trusted ? 'shield-checkmark' : 'chevron-forward'} size={trusted ? 20 : 18} color={trusted ? C.ok : C.muted} />
        ) : (
          <Pill text={t(incoming ? 'friends.invite' : 'friends.pending')} color={incoming ? C.gold : C.muted} />
        )
      }
    >
      {email || p?.about ? <Text style={st.rowSub} numberOfLines={1}>{email ?? p?.about}</Text> : null}
    </PersonRow>
  );
}

// Star tab: find people, the ones I trust (with their parking), and my friends.
export default function FriendsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const { items: friends, loading: friendsLoading, error: friendsError, refresh: refreshFriends } = useFriendsLive(user?.uid);
  const { items: trusts, loading: trustsLoading, error: trustsError, refresh: refreshTrusts } = useTrustsLive(user?.uid);
  const refreshAll = () => Promise.all([refreshFriends(), refreshTrusts()]);

  // Invitation text with my personal link: opening it in the app lands on my profile with "Add friend".
  const inviteMessage = () => t('friends.inviteMessage', { url: `${SHARE_HOST}/u/${user?.uid}` });
  // Any app that takes text: Zalo, Messenger, Messages, Mail, copy the link...
  const inviteViaShare = () => Share.share({ message: inviteMessage() }).catch(() => {});
  const refreshControl = usePullRefresh(refreshAll);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found | null | undefined>();
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (q.trim().length < 5) return;
    setSearching(true);
    try {
      setFound(await findUser(q.trim()));
    } catch (e) {
      showError(e);
    } finally {
      setSearching(false);
    }
  };

  const header = { title: t('friends.title'), left: <HeaderBell />, right: <HeaderAvatar /> };

  if (!user) {
    return (
      <Screen header={header} tabbed>
        <SignInPrompt icon="star-outline" text={t('friends.signIn')} />
      </Screen>
    );
  }

  // invitations waiting for me first
  const waiting = (x: { status: string; requester: string }) => Number(x.status === 'pending' && x.requester !== user.uid);
  const sortedTrusts = [...trusts].sort((a, b) => waiting(b) - waiting(a));
  const sortedFriends = [...friends].sort((a, b) => waiting(b) - waiting(a));

  return (
    <Screen header={header} tabbed scroll refreshControl={refreshControl} contentStyle={s.list}>
        <View style={s.block}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={C.muted} />
            <TextInput
              style={s.searchInput}
              value={q}
              onChangeText={(v) => {
                setQ(v);
                setFound(undefined);
              }}
              placeholder={t('friends.search')}
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="search"
              onSubmitEditing={search}
            />
            {searching ? <ActivityIndicator color={C.gold} /> : q ? <Pressable onPress={search} hitSlop={8}><Text style={s.go}>{t('friends.find')}</Text></Pressable> : null}
          </View>
          {found ? (
            <PersonRow
              uid={found.uid}
              name={found.name}
              photoURL={found.photoURL}
              size={44}
              title={found.name}
              onPress={() => router.push({ pathname: '/profile/[uid]', params: { uid: found.uid } })}
              right={<Ionicons name="chevron-forward" size={18} color={C.muted} />}
            >
              {found.email ? <Text style={st.rowSub}>{found.email}</Text> : null}
            </PersonRow>
          ) : found === null ? (
            <Text style={s.notFound}>{t('friends.notFound')}</Text>
          ) : null}
        </View>

        <View style={s.invite}>
          <Button compact variant="dark" icon="book-outline" label={t('friends.fromContacts')} onPress={() => router.push('/contacts')} style={{ flex: 1 }} />
          <Button compact variant="dark" icon="share-outline" label={t('friends.inviteShare')} onPress={inviteViaShare} style={{ flex: 1 }} />
        </View>

        <View style={s.block}>
          <Text style={st.section}>{t('trust.title')}</Text>
          {trustsLoading && !trusts.length ? (
            <Skeleton rows={2} />
          ) : sortedTrusts.length ? (
            sortedTrusts.map((x) => <TrustedRow key={x.id} trust={x} me={user.uid} />)
          ) : trustsError ? (
            <ErrorNote text={t('common.loadError')} retry={t('common.retry')} onRetry={refreshAll} />
          ) : (
            <Text style={s.empty}>{t('trust.empty')}</Text>
          )}
        </View>

        <View style={s.block}>
          <Text style={st.section}>{t('friends.title')}</Text>
          {friendsLoading && !friends.length ? (
            <Skeleton rows={3} />
          ) : friendsError && !friends.length ? (
            <ErrorNote text={t('common.loadError')} retry={t('common.retry')} onRetry={refreshAll} />
          ) : sortedFriends.length ? (
            sortedFriends.map((f) => <FriendRow key={f.id} friend={f} me={user.uid} trusted={trusts.some((x) => x.other === f.other && x.status === 'accepted')} />)
          ) : (
            <Text style={s.empty}>{t('friends.empty')}</Text>
          )}
        </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { gap: 14 },
  block: { gap: 8 },
  invite: { flexDirection: 'row', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 16, height: 50 },
  searchInput: { flex: 1, color: C.text, fontSize: 15 },
  go: { color: C.gold, fontWeight: '800', fontSize: 14 },
  notFound: { color: C.muted, fontSize: 14, paddingHorizontal: 6 },
  empty: { color: C.muted, fontSize: 14, paddingVertical: 4, paddingHorizontal: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  sub: { color: C.gold, fontSize: 13, fontWeight: '600' },
  away: { alignItems: 'center', gap: 2 },
  awayText: { color: C.text, fontSize: 14, fontWeight: '800' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderButtons';
import { LegalAgree, LegalRows } from '@/components/LegalLinks';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { SignInButtons } from '@/components/SignInButtons';
import { Avatar, Button, OptionList, st } from '@/components/ui';
import { changeAvatar, logout, resetPassword, setDisplayName, useUser } from '@/features/account/auth';
import { deleteAccount } from '@/features/account/delete';
import { buildPhone, parsePhone } from '@/features/account/phone';
import { getNavPref, installedApps, NAV_LABELS, setNavPref, type NavApp, type NavPref } from '@/features/directions/nav';
import { loadSpot } from '@/features/parking/spot';
import { syncWidget } from '@/features/parking/surfaces';
import { saveExtras, useContact } from '@/features/social/friends';
import { useProfile } from '@/features/social/trust';
import { AppError } from '@/lib/errors';
import { confirm, perform, showDone, showError } from '@/lib/feedback';
import { LANGS, setLang, type Lang } from '@/lib/i18n';
import { C } from '@/lib/theme';
import { useDraft } from '@/lib/useDraft';

// Everything on this screen (profile, language, maps app) is a draft until the Save button (top right).
export default function Account() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const profile = useProfile(user?.uid);
  const phone = parsePhone(useContact(user?.uid)?.phone);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [apps, setApps] = useState<NavApp[]>(['apple']);
  useEffect(() => void installedApps().then(setApps), []);
  const [langOpen, setLangOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Signing in / out swaps this screen's content for a very differently sized one, in place, in the same
  // ScrollView (no navigation happens). Scrolled mid-swap, iOS can leave the view showing a stale, blank region
  // until it re-settles. Snapping back to the top when that boundary flips avoids it ever having to reconcile.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => void scrollRef.current?.scrollTo({ y: 0, animated: false }), [!!user]);

  const { val, set, dirty, reset } = useDraft({
    name: user?.displayName ?? '',
    country: phone.country,
    national: phone.national,
    gender: profile?.gender ?? '',
    about: profile?.about ?? '',
    lang: i18n.language as Lang,
    nav: getNavPref(),
  });
  const cur = { name: user?.displayName ?? '', phone: buildPhone(phone.country, phone.national) };
  const newPhone = buildPhone(val.country, val.national);

  const saveAll = async () => {
    if (!dirty || saving) return;
    if (user && val.national.trim() && !newPhone) return showError(new AppError(t('account.phoneInvalid')));
    setSaving(true);
    try {
      const appChanged = val.lang !== i18n.language || val.nav !== getNavPref();
      if (val.lang !== i18n.language) setLang(val.lang);
      if (val.nav !== getNavPref()) await setNavPref(val.nav);
      if (appChanged) loadSpot().then(syncWidget); // the widget carries translated labels and the chosen maps app
      if (user) {
        if (val.name.trim() && val.name.trim() !== cur.name) await setDisplayName(val.name);
        await saveExtras(user, { phone: newPhone, gender: val.gender, about: val.about.trim() });
      }
      reset();
      showDone(t('account.savedDone'));
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () =>
    dirty
      ? confirm({ title: t('account.discardTitle'), message: t('account.discardBody'), action: t('account.discard'), onCancel: undefined, onConfirm: () => router.back() })
      : router.back();
  // Permanent: explain what goes, ask once, and tell the person when it worked.
  const confirmDelete = () =>
    confirm({
      title: t('account.deleteTitle'),
      message: t('account.deleteBody'),
      action: t('account.delete'),
      onConfirm: async () => {
        setDeleting(true);
        // the full-screen overlay (default) also blocks the header back button and Android's hardware back while this runs
        await perform(deleteAccount(), t('account.deleted'));
        setDeleting(false);
      },
    });
  const confirmLogout = () =>
    confirm({ title: t('account.signOutTitle'), message: t('account.signOutBody'), action: t('account.signOut'), onConfirm: () => logout() });
  const newAvatar = async () => {
    setUploading(true);
    try {
      if (await changeAvatar()) showDone(t('account.avatarDone'));
    } catch (e) {
      showError(e);
    } finally {
      setUploading(false);
    }
  };
  const changePassword = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      showDone(t('account.passwordResetSent'));
    } catch (e) {
      showError(e);
    }
  };

  const saveButton = (
    <Pressable onPress={saveAll} disabled={!dirty || saving} hitSlop={10} style={s.saveBtn}>
      {saving ? (
        <ActivityIndicator color={C.gold} />
      ) : (
        <Text style={[s.save, !dirty && s.saveOff]}>{t('common.save')}</Text>
      )}
    </Pressable>
  );

  return (
    <Screen
      header={{ title: t('account.title'), left: <HeaderBack onPress={deleting ? () => {} : goBack} />, right: saveButton }}
      scroll
      scrollRef={scrollRef}
    >
      {user ? (
        <View style={s.profile}>
          <Pressable onPress={newAvatar} disabled={uploading}>
            <Avatar user={user} size={110} />
            <View style={s.camera}>
              <Ionicons name={uploading ? 'hourglass' : 'camera'} size={18} color={C.bg} />
            </View>
          </Pressable>
          <Text style={st.hint}>{t('account.changePhoto')}</Text>
          <TextInput
            style={[st.input, s.name]}
            value={val.name}
            onChangeText={(v) => set('name', v)}
            placeholder={t('account.namePlaceholder')}
            placeholderTextColor={C.muted}
            maxLength={40}
            returnKeyType="done"
          />
          <View style={s.emailRow}>
            <Ionicons name="mail-outline" size={16} color={C.muted} />
            <Text style={s.email}>{user.email ?? '—'}</Text>
          </View>
          {user.hasPassword && <Text style={s.link} onPress={changePassword}>{t('account.changePassword')}</Text>}

          <View style={s.details}>
            <Text style={st.section}>{t('account.details')}</Text>
            <PhoneField country={val.country} national={val.national} onCountry={(c) => set('country', c)} onNational={(v) => set('national', v)} />
            <Text style={s.hintSmall}>{t('account.phoneHint')}</Text>
            <View style={s.genders}>
              {(['male', 'female', 'other'] as const).map((g) => (
                <Pressable key={g} style={[s.gender, val.gender === g && s.genderOn]} onPress={() => set('gender', val.gender === g ? '' : g)}>
                  <Text style={[s.genderText, val.gender === g && s.genderTextOn]}>{t(`account.${g}`)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[st.input, s.about]}
              value={val.about}
              onChangeText={(v) => set('about', v)}
              placeholder={t('account.about')}
              placeholderTextColor={C.muted}
              multiline
              maxLength={140}
            />
          </View>
        </View>
      ) : (
        <View style={s.profile}>
          <Avatar user={null} size={90} />
          <Text style={st.hint}>{t('login.subtitle')}</Text>
          <SignInButtons />
          <LegalAgree />
        </View>
      )}

      <Pressable style={[st.row, { marginTop: 6 }]} onPress={() => router.push('/history')}>
        <Ionicons name="time-outline" size={22} color={C.gold} />
        <Text style={[st.rowTitle, { flex: 1 }]}>{t('history.title')}</Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Pressable>

      <Pressable style={st.row} onPress={() => setLangOpen(true)}>
        <Text style={[st.rowTitle, { flex: 1 }]}>{t('account.language')}</Text>
        <Text style={s.value}>{LANGS[val.lang]}</Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Pressable>

      {Platform.OS === 'ios' && (
        <Pressable style={st.row} onPress={() => setNavOpen(true)}>
          <Text style={[st.rowTitle, { flex: 1 }]}>{t('account.navApp')}</Text>
          <Text style={s.value}>{val.nav === 'ask' ? t('account.navAsk') : NAV_LABELS[val.nav]}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      )}

      <Text style={st.section}>{t('legal.title')}</Text>
      <LegalRows />

      {user && <Button variant="dark" label={t('account.signOut')} icon="log-out-outline" onPress={confirmLogout} style={{ marginTop: 20 }} />}
      {user && <Button variant="danger" busy={deleting} label={t('account.delete')} icon="trash-outline" onPress={confirmDelete} />}

      <Sheet visible={langOpen} onClose={() => setLangOpen(false)}>
        <Text style={st.title}>{t('account.language')}</Text>
        <OptionList
          options={(Object.keys(LANGS) as Lang[]).map((l) => ({ key: l, label: LANGS[l] }))}
          value={val.lang}
          onPick={(l) => {
            set('lang', l);
            setLangOpen(false);
          }}
        />
      </Sheet>
      <Sheet visible={navOpen} onClose={() => setNavOpen(false)}>
        <Text style={st.title}>{t('account.navApp')}</Text>
        <OptionList<NavPref>
          options={(['ask', ...apps] as NavPref[]).map((p) => ({ key: p, label: p === 'ask' ? t('account.navAsk') : NAV_LABELS[p] }))}
          value={val.nav}
          onPick={(p) => {
            set('nav', p);
            setNavOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { alignItems: 'center', gap: 12, paddingTop: 8 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg },
  name: { alignSelf: 'stretch', textAlign: 'center', fontSize: 20, fontWeight: '800' },
  saveBtn: { minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  save: { color: C.gold, fontSize: 17, fontWeight: '800' },
  saveOff: { color: C.muted },
  details: { alignSelf: 'stretch', gap: 10 },
  hintSmall: { color: C.muted, fontSize: 12, marginTop: -4, paddingHorizontal: 6 },
  genders: { flexDirection: 'row', gap: 8 },
  gender: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  genderOn: { backgroundColor: C.gold },
  genderText: { color: C.text, fontSize: 15, fontWeight: '700' },
  genderTextOn: { color: C.bg },
  about: { height: 84, paddingTop: 14, textAlignVertical: 'top' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  email: { color: C.muted, fontSize: 15 },
  link: { color: C.gold, fontSize: 13, fontWeight: '600' },
  value: { color: C.muted, fontSize: 15 },
});

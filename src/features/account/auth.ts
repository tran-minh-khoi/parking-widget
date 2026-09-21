import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
  GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signInWithCredential, signOut, updateProfile, type User,
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { auth, GOOGLE_WEB_CLIENT_ID, storage } from '@/lib/firebase';
import { resizeJpeg } from '@/lib/image';

// What the UI needs from a user. A fresh snapshot object per change, so memoised components re-render
// after updateProfile (Firebase mutates the same User instance).
export type Who = Pick<User, 'uid' | 'displayName' | 'email'>;
export type AppUser = Who & { photoURL: string | null };

const snap = (u: User | null): AppUser | null =>
  u && { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL };

const refreshers = new Set<() => void>();
const refresh = () => refreshers.forEach((f) => f());

export const useUser = () => {
  const [user, setUser] = useState(() => snap(auth.currentUser));
  useEffect(() => {
    const sync = () => setUser(snap(auth.currentUser));
    refreshers.add(sync);
    const off = onAuthStateChanged(auth, sync);
    return () => (off(), void refreshers.delete(sync));
  }, []);
  return user;
};

export const signInGoogle = async () => {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  const res = await GoogleSignin.signIn();
  if (res.type !== 'success' || !res.data.idToken) return false;
  await signInWithCredential(auth, GoogleAuthProvider.credential(res.data.idToken));
  return true;
};

export const signInApple = async () => {
  const rawNonce = Crypto.randomUUID();
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce,
  });
  if (!apple.identityToken) return false;
  await signInWithCredential(auth, new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce }));
  // Apple only sends the name on the very first sign-in: keep it.
  if (apple.fullName?.givenName && !auth.currentUser?.displayName) {
    await updateProfile(auth.currentUser!, { displayName: [apple.fullName.givenName, apple.fullName.familyName].filter(Boolean).join(' ') });
    refresh();
  }
  return true;
};

export const logout = () => signOut(auth);

export const setDisplayName = async (name: string) => {
  if (!auth.currentUser || !name.trim()) return;
  await updateProfile(auth.currentUser, { displayName: name.trim() });
  refresh();
  return true;
};

export const changeAvatar = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (pick.canceled) return false;
  const small = await resizeJpeg(pick.assets[0].uri, 256, 0.7);
  const file = ref(storage, `avatars/${user.uid}.jpg`);
  await uploadBytes(file, await (await fetch(small.uri)).blob(), { contentType: 'image/jpeg' });
  await updateProfile(user, { photoURL: `${await getDownloadURL(file)}&v=${Date.now()}` }); // v= busts the image cache
  refresh();
  return true;
};

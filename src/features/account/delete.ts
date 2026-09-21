import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { revokeAccessToken, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { wipeLocalData } from '@/features/parking/spot';
import { app, auth } from '@/lib/firebase';

// Apple asks apps that offer Sign in with Apple to revoke its token when the account is deleted. That needs a fresh
// authorization code (hence Apple's own sheet) AND the Apple key configured in the Firebase console (Authentication →
// Sign-in method → Apple → OAuth code flow). It is a courtesy on top of the deletion, never a condition of it: if the
// person backs out of the sheet or Firebase can't revoke, the account is still deleted.
const revokeAppleToken = async () => {
  try {
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, Crypto.randomUUID());
    const apple = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce });
    if (apple.authorizationCode) await revokeAccessToken(auth, apple.authorizationCode);
  } catch (e) {
    if (__DEV__) console.warn('[delete] Apple token not revoked, deleting anyway', e);
  }
};

// Delete the account for good, for every sign-in method. The server removes everything (deleteAccount in
// functions/index.js) and the sign-in account itself; then this phone forgets its own copy and signs out.
export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (user.providerData.some((p) => p.providerId === 'apple.com')) await revokeAppleToken();
  // deleting many shares with photos can take a while: allow the whole 5 minutes the function has
  await httpsCallable(getFunctions(app, 'asia-southeast1'), 'deleteAccount', { timeout: 300000 })();
  await wipeLocalData().catch(() => {});
  await GoogleSignin.signOut().catch(() => {}); // forget the Google account so the next sign-in asks again
  await signOut(auth).catch(() => {}); // the account is already gone on the server
};

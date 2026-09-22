import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { wipeLocalData } from '@/features/parking/spot';
import { app, auth } from '@/lib/firebase';

// Delete the account for good, for every sign-in method. The server removes everything (deleteAccount in
// functions/index.js) and the sign-in account itself; then this phone forgets its own copy and signs out.
//
// Apple's guidelines also ask apps to revoke the Sign in with Apple token on deletion, which needs a fresh
// authorization code — only obtainable by showing Apple's own "choose an account" sheet again, which reads as
// "sign back in to delete your account" and confused testers. Skipped on purpose: the account (Apple's included) is
// still fully deleted below, just without that extra revocation call. Revisit if App Review flags it.
export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) return;
  // deleting many shares with photos can take a while: allow the whole 5 minutes the function has
  await httpsCallable(getFunctions(app, 'asia-southeast1'), 'deleteAccount', { timeout: 300000 })();
  await wipeLocalData().catch(() => {});
  await GoogleSignin.signOut().catch(() => {}); // forget the Google account so the next sign-in asks again
  await signOut(auth).catch(() => {}); // the account is already gone on the server
};

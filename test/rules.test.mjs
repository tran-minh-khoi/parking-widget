// Run: firebase emulators:exec --only firestore --project demo-parking "node test/rules.test.mjs"
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-parking',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
});
const owner = env.authenticatedContext('owner').firestore();
const friend = env.authenticatedContext('friend').firestore();
const other = env.authenticatedContext('other').firestore();
const anon = env.unauthenticatedContext().firestore();
const hours = (h) => Timestamp.fromMillis(Date.now() + h * 3600e3);
const base = { scrubbed: false, ownerId: 'owner', ownerName: 'O', note: 'D31', lat: 1, lng: 2, thumb: 'x', status: 'open', parkedAt: Timestamp.now(), expiresAt: hours(4) };

let n = 0;
const check = async (name, p) => { await p; console.log('ok', ++n, name); };

await check('owner creates', assertSucceeds(setDoc(doc(owner, 'shares/s1'), base)));
await check('cannot create for someone else', assertFails(setDoc(doc(friend, 'shares/s2'), base)));
await check('cannot create with >8 day expiry', assertFails(setDoc(doc(owner, 'shares/s3'), { ...base, expiresAt: hours(24 * 9) })));
await check('can share for 7 days (until the car is gone)', assertSucceeds(setDoc(doc(owner, 'shares/u1'), { ...base, untilGone: true, expiresAt: hours(24 * 7) })));
await check('owner marks a share as sent', assertSucceeds(updateDoc(doc(owner, 'shares/u1'), { sent: true })));
await check('stranger cannot mark as sent', assertFails(updateDoc(doc(friend, 'shares/u1'), { sent: true })));
await check('owner extends an until-gone share', assertSucceeds(updateDoc(doc(owner, 'shares/u1'), { expiresAt: hours(24 * 7 + 1) })));
await check('owner shortens an until-gone share to 3 hours', assertSucceeds(updateDoc(doc(owner, 'shares/u1'), { untilGone: false, expiresAt: hours(3) })));
await check('timed share cannot be changed to 13 hours', assertFails(updateDoc(doc(owner, 'shares/u1'), { expiresAt: hours(13) })));
await check('timed share can be changed to 12 hours', assertSucceeds(updateDoc(doc(owner, 'shares/u1'), { expiresAt: hours(12) })));
await check('recipient-to-be cannot change the time', assertFails(updateDoc(doc(friend, 'shares/u1'), { expiresAt: hours(1) })));
await check('cannot create a 13 hour timed share', assertFails(setDoc(doc(owner, 'shares/t13'), { ...base, expiresAt: hours(13) })));
await check('can create a 12 hour timed share', assertSucceeds(setDoc(doc(owner, 'shares/t12'), { ...base, expiresAt: hours(12) })));
await check('owner edits the note', assertSucceeds(updateDoc(doc(owner, 'shares/t12'), { note: 'B2 pillar 5' })));
await check('note edit cannot carry other fields', assertFails(updateDoc(doc(owner, 'shares/t12'), { note: 'x', status: 'closed' })));
await check('other people cannot edit the note', assertFails(updateDoc(doc(friend, 'shares/t12'), { note: 'hax' })));
await check('owner nudges', assertSucceeds(updateDoc(doc(owner, 'shares/t12'), { nudgedAt: serverTimestamp() })));
await check('owner cannot nudge twice in a minute', assertFails(updateDoc(doc(owner, 'shares/t12'), { nudgedAt: serverTimestamp() })));
await check('cannot extend beyond 8 days', assertFails(updateDoc(doc(owner, 'shares/u1'), { expiresAt: hours(24 * 9) })));
await check('cannot extend a timed share', assertFails(updateDoc(doc(owner, 'shares/s1'), { expiresAt: hours(24) })));
await check('stranger cannot extend', assertFails(updateDoc(doc(friend, 'shares/u1'), { expiresAt: hours(24 * 7 + 2) })));
await check('owner revokes (deletes) a share', assertSucceeds(deleteDoc(doc(owner, 'shares/u1'))));
await check('cannot forge a timeline on create', assertFails(setDoc(doc(owner, 'shares/forged'), { ...base, timeline: [{ t: 'pickedUp', by: 'F', at: 1 }] })));
await check('cannot set retention dates on create', assertFails(setDoc(doc(owner, 'shares/forged2'), { ...base, deleteAt: hours(1) })));
await check('anonymous can get by id', assertSucceeds(getDoc(doc(anon, 'shares/s1'))));
await check('anonymous cannot list', assertFails(getDocs(collection(anon, 'shares'))));
await check('owner lists own', assertSucceeds(getDocs(query(collection(owner, 'shares'), where('ownerId', '==', 'owner')))));
await check('cannot list others', assertFails(getDocs(query(collection(friend, 'shares'), where('ownerId', '==', 'owner')))));
await check('accept must be as self', assertFails(updateDoc(doc(friend, 'shares/s1'), { recipientId: 'other', recipientName: 'X', status: 'accepted' })));
await check('owner cannot accept own', assertFails(updateDoc(doc(owner, 'shares/s1'), { recipientId: 'owner', recipientName: 'O', status: 'accepted' })));
await check('friend accepts', assertSucceeds(updateDoc(doc(friend, 'shares/s1'), { recipientId: 'friend', recipientName: 'F', status: 'accepted' })));
await check('once accepted, a stranger with the link cannot read it', assertFails(getDoc(doc(other, 'shares/s1'))));
await check('once accepted, anonymous cannot read it', assertFails(getDoc(doc(anon, 'shares/s1'))));
await check('the recipient still reads it', assertSucceeds(getDoc(doc(friend, 'shares/s1'))));
await check('second person cannot accept', assertFails(updateDoc(doc(other, 'shares/s1'), { recipientId: 'other', recipientName: 'X', status: 'accepted' })));
await check('friend chats', assertSucceeds(addDoc(collection(friend, 'shares/s1/messages'), { uid: 'friend', name: 'F', text: 'hi', createdAt: Timestamp.now() })));
await check('photo-only message ok', assertSucceeds(addDoc(collection(friend, 'shares/s1/messages'), { uid: 'friend', name: 'F', text: '', photoPath: 'shares/s1/msgs/1.jpg', createdAt: Timestamp.now() })));
await check('empty message rejected', assertFails(addDoc(collection(friend, 'shares/s1/messages'), { uid: 'friend', name: 'F', text: '', createdAt: Timestamp.now() })));
await check('owner reads chat', assertSucceeds(getDocs(collection(owner, 'shares/s1/messages'))));
await check('stranger cannot read chat', assertFails(getDocs(collection(other, 'shares/s1/messages'))));
await check('cannot spoof sender', assertFails(addDoc(collection(friend, 'shares/s1/messages'), { uid: 'owner', name: 'O', text: 'hi', createdAt: Timestamp.now() })));
await check('owner cannot mark picked up', assertFails(updateDoc(doc(owner, 'shares/s1'), { status: 'pickedUp', pickedUpAt: Timestamp.now() })));
await check('recipient cannot edit the timeline', assertFails(updateDoc(doc(friend, 'shares/s1'), { status: 'pickedUp', pickedUpAt: Timestamp.now(), timeline: [] })));
await check('friend marks picked up', assertSucceeds(updateDoc(doc(friend, 'shares/s1'), { status: 'pickedUp', pickedUpAt: Timestamp.now() })));
await check('no chat after pickup', assertFails(addDoc(collection(friend, 'shares/s1/messages'), { uid: 'friend', name: 'F', text: 'thanks', createdAt: Timestamp.now() })));
await check('owner cannot close a picked-up share', assertFails(updateDoc(doc(owner, 'shares/s1'), { status: 'closed' })));
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'shares/s4'), { ...base, status: 'accepted', recipientId: 'friend', recipientName: 'F' }));
await check('owner closes accepted share', assertSucceeds(updateDoc(doc(owner, 'shares/s4'), { status: 'closed' })));
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'shares/s5'), { ...base, status: 'accepted', recipientId: 'friend', recipientName: 'F' }));
await check('recipient cannot revoke', assertFails(updateDoc(doc(friend, 'shares/s5'), { status: 'revoked' })));
await check('owner revokes accepted share', assertSucceeds(updateDoc(doc(owner, 'shares/s5'), { status: 'revoked' })));
await check('owner cannot revoke twice', assertFails(updateDoc(doc(owner, 'shares/s5'), { status: 'revoked' })));
await check('owner writes a nickname', assertSucceeds(setDoc(doc(owner, 'users/owner/aliases/friend'), { name: 'Mum' })));
await check('nobody reads my nicknames', assertFails(getDoc(doc(friend, 'users/owner/aliases/friend'))));
await check('nobody writes my nicknames', assertFails(setDoc(doc(friend, 'users/owner/aliases/x'), { name: 'hax' })));
await check('nickname must be short', assertFails(setDoc(doc(owner, 'users/owner/aliases/friend'), { name: 'x'.repeat(61) })));
await check('owner reads own nicknames', assertSucceeds(getDoc(doc(owner, 'users/owner/aliases/friend'))));
await check('owner lists own nicknames', assertSucceeds(getDocs(collection(owner, 'users/owner/aliases'))));
await check('others cannot list my nicknames', assertFails(getDocs(collection(friend, 'users/owner/aliases'))));
await check('owner deletes a nickname', assertSucceeds(deleteDoc(doc(owner, 'users/owner/aliases/friend'))));
await check('cannot write my own email into contacts', assertFails(setDoc(doc(owner, 'contacts/owner'), { email: 'o@x.com' }, { merge: true })));
await check('can write my phone into contacts', assertSucceeds(setDoc(doc(owner, 'contacts/owner'), { phone: '+84912345678' }, { merge: true })));
await check('own push token only', assertSucceeds(setDoc(doc(friend, 'users/friend'), { expoPushToken: 't' })));
await check('cannot touch others push token', assertFails(setDoc(doc(friend, 'users/owner'), { expoPushToken: 't' })));

await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/friend/notifications/n1'), { type: 'share', title: 't', body: 'b', read: false, createdAt: Timestamp.now() }));
await check('reads own inbox', assertSucceeds(getDocs(collection(friend, 'users/friend/notifications'))));
await check('cannot read others inbox', assertFails(getDocs(collection(other, 'users/friend/notifications'))));
await check('can mark read', assertSucceeds(updateDoc(doc(friend, 'users/friend/notifications/n1'), { read: true })));
await check('cannot edit inbox text', assertFails(updateDoc(doc(friend, 'users/friend/notifications/n1'), { title: 'x' })));
await check('cannot forge inbox entry', assertFails(setDoc(doc(friend, 'users/friend/notifications/n2'), { type: 'share', title: 'x', body: 'y', read: false })));

// --- expired share: conversation stays readable for members only
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'shares/old'), { ...base, status: 'accepted', recipientId: 'friend', recipientName: 'F', expiresAt: Timestamp.fromMillis(Date.now() - 3600e3) }));
await check('member reads expired share', assertSucceeds(getDoc(doc(friend, 'shares/old'))));
await check('stranger cannot read expired share', assertFails(getDoc(doc(other, 'shares/old'))));
await check('no chat after the window', assertFails(addDoc(collection(friend, 'shares/old/messages'), { uid: 'friend', name: 'F', text: 'late', createdAt: Timestamp.now() })));

// --- profiles
await check('anyone signed in reads a profile', assertSucceeds(setDoc(doc(owner, 'profiles/owner'), { name: 'Owner', photoURL: '' })));
await check('read someone else profile', assertSucceeds(getDoc(doc(other, 'profiles/owner'))));
await check('cannot edit someone else profile', assertFails(setDoc(doc(other, 'profiles/owner'), { name: 'Hacked' })));
await check('anonymous cannot read profiles', assertFails(getDoc(doc(anon, 'profiles/owner'))));

// --- trust + published spots
const pair = 'friend_owner'; // sorted uids
const spot = { name: 'Owner', lat: 1, lng: 2, thumb: 'x', parkedAt: Timestamp.now(), expiresAt: hours(24) };
await check('owner publishes own spot', assertSucceeds(setDoc(doc(owner, 'spots/owner'), spot)));
await check('untrusted cannot see the spot', assertFails(getDoc(doc(friend, 'spots/owner'))));
await check('cannot publish as someone else', assertFails(setDoc(doc(friend, 'spots/owner'), spot)));
await check('bad pair id rejected', assertFails(setDoc(doc(owner, 'trusts/owner_friend'), { members: ['owner', 'friend'], requester: 'owner', status: 'pending' })));
await check('cannot request as someone else', assertFails(setDoc(doc(other, 'trusts/' + pair), { members: ['friend', 'owner'], requester: 'owner', status: 'pending' })));
await check('cannot trust without being friends', assertFails(setDoc(doc(owner, 'trusts/' + pair), { members: ['friend', 'owner'], requester: 'owner', status: 'pending', createdAt: Timestamp.now() })));
await check('owner sends friend request', assertSucceeds(setDoc(doc(owner, 'friends/' + pair), { members: ['friend', 'owner'], requester: 'owner', status: 'pending', createdAt: Timestamp.now() })));
await check('requester cannot accept own friend request', assertFails(updateDoc(doc(owner, 'friends/' + pair), { status: 'accepted' })));
await check('stranger cannot read the friendship', assertFails(getDoc(doc(other, 'friends/' + pair))));
await check('pending friend cannot see contact phone', assertFails(getDoc(doc(friend, 'contacts/owner'))));
await check('friend accepts friendship', assertSucceeds(updateDoc(doc(friend, 'friends/' + pair), { status: 'accepted' })));
await check('owner writes own contact', assertSucceeds(setDoc(doc(owner, 'contacts/owner'), { phone: '0912345678' })));
await check('friend reads contact phone', assertSucceeds(getDoc(doc(friend, 'contacts/owner'))));
await check('stranger cannot read contact phone', assertFails(getDoc(doc(other, 'contacts/owner'))));
await check('cannot write someone elses contact', assertFails(setDoc(doc(other, 'contacts/owner'), { phone: '1' })));
await check('friends can ask a favour (invitee)', assertSucceeds(setDoc(doc(owner, 'shares/inv1'), { ...base, invitee: 'friend', untilGone: true, expiresAt: hours(24 * 7) })));
await check('a friend-only invitation is hidden from anonymous', assertFails(getDoc(doc(anon, 'shares/inv1'))));
await check('a friend-only invitation is hidden from other people', assertFails(getDoc(doc(other, 'shares/inv1'))));
await check('the invited friend can read the invitation', assertSucceeds(getDoc(doc(friend, 'shares/inv1'))));
await check('cannot invite a non-friend', assertFails(setDoc(doc(owner, 'shares/inv2'), { ...base, invitee: 'other', expiresAt: hours(4) })));
await check('non-invitee cannot accept an invitation', assertFails(updateDoc(doc(other, 'shares/inv1'), { recipientId: 'other', recipientName: 'X', status: 'accepted' })));
await check('invitee lists own invitations', assertSucceeds(getDocs(query(collection(friend, 'shares'), where('invitee', '==', 'friend')))));
await check('invitee declines', assertSucceeds(updateDoc(doc(friend, 'shares/inv1'), { status: 'declined' })));
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'shares/inv3'), { ...base, invitee: 'friend', expiresAt: hours(24) }));
await check('invitee accepts', assertSucceeds(updateDoc(doc(friend, 'shares/inv3'), { recipientId: 'friend', recipientName: 'F', status: 'accepted' })));
await check('owner cannot withdraw for the recipient', assertFails(updateDoc(doc(owner, 'shares/inv3'), { status: 'declined' })));
await check('stranger cannot withdraw', assertFails(updateDoc(doc(other, 'shares/inv3'), { status: 'declined' })));
await check('recipient withdraws after agreeing', assertSucceeds(updateDoc(doc(friend, 'shares/inv3'), { status: 'declined' })));
await check('owner sends trust request', assertSucceeds(setDoc(doc(owner, 'trusts/' + pair), { members: ['friend', 'owner'], requester: 'owner', status: 'pending', createdAt: Timestamp.now() })));
await check('pending trust does not reveal the spot', assertFails(getDoc(doc(friend, 'spots/owner'))));
await check('requester cannot accept own request', assertFails(updateDoc(doc(owner, 'trusts/' + pair), { status: 'accepted' })));
await check('stranger cannot accept', assertFails(updateDoc(doc(other, 'trusts/' + pair), { status: 'accepted' })));
await check('stranger cannot read the trust', assertFails(getDoc(doc(other, 'trusts/' + pair))));
await check('friend lists own trusts', assertSucceeds(getDocs(query(collection(friend, 'trusts'), where('members', 'array-contains', 'friend')))));
await check('friend accepts', assertSucceeds(updateDoc(doc(friend, 'trusts/' + pair), { status: 'accepted' })));
await check('trusted friend sees the spot', assertSucceeds(getDoc(doc(friend, 'spots/owner'))));
await check('stranger still cannot see the spot', assertFails(getDoc(doc(other, 'spots/owner'))));
await check('either side can remove trust', assertSucceeds(deleteDoc(doc(friend, 'trusts/' + pair))));
await check('spot hidden again after removal', assertFails(getDoc(doc(friend, 'spots/owner'))));

await env.cleanup();
console.log('all', n, 'passed');

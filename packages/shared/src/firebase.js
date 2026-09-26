// Firebase initialisation + Firestore/Auth adapters.
//
// Each app passes its own config (read from Vite / CRA env variables), so the
// shared package never hard-codes project credentials.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  runTransaction,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { shouldWrite } from './merge.js';

let services = null;

export const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function isConfigValid(config) {
  return Boolean(config) && REQUIRED_CONFIG_KEYS.every((k) => Boolean(config[k]));
}

/**
 * @param {object} config Firebase web config
 * @param {{ emulatorHost?: string }} [opts] e.g. "127.0.0.1" to use local emulators
 */
export function initFirebase(config, opts = {}) {
  if (services) return services;
  const app = getApps()[0] || initializeApp(config);
  const auth = getAuth(app);
  // Long polling auto-detection keeps Firestore working behind proxies/VPNs
  // and inside Electron.
  const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  if (opts.emulatorHost) {
    connectAuthEmulator(auth, `http://${opts.emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, opts.emulatorHost, 8080);
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  services = { app, auth, db };
  return services;
}

export function getServices() {
  if (!services) throw new Error('Firebase has not been initialised. Call initFirebase() first.');
  return services;
}

// ---- auth -----------------------------------------------------------------

export async function signUp(email, password, displayName) {
  const { auth } = getServices();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName) await updateProfile(cred.user, { displayName: displayName.trim() });
  // Root profile document; per-user data lives in sub-collections below it.
  await setDoc(
    doc(getServices().db, 'users', cred.user.uid),
    { email: cred.user.email, displayName: displayName?.trim() || '', createdAt: Date.now() },
    { merge: true },
  ).catch(() => {}); // non-fatal: offline signups sync their data later
  return cred.user;
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(getServices().auth, email.trim(), password).then((c) => c.user);
}

export function signOut() {
  return fbSignOut(getServices().auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(getServices().auth, email.trim());
}

export function onAuth(cb) {
  return onAuthStateChanged(getServices().auth, cb);
}

export function authErrorMessage(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/missing-password': 'Please enter your password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
    'auth/configuration-not-found': 'Email/password sign-in is not enabled in this Firebase project.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled in this Firebase project.',
  };
  return map[code] || err?.message || 'Something went wrong.';
}

// ---- firestore ------------------------------------------------------------

const userDoc = (db, uid, path) => doc(db, 'users', uid, ...path.split('/'));

/** Backend adapter for SyncQueue: a last-write-wins conditional write. */
export function firestoreAdapter(uid) {
  const { db } = getServices();
  return {
    async write(path, data) {
      const ref = userDoc(db, uid, path);
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists() && !shouldWrite(snap.data(), data)) return 'stale';
        tx.set(ref, data);
        return 'written';
      });
    },
  };
}

/**
 * Real-time listener for a user sub-collection.
 * @param {(changes: Array<{id, type, data}>) => void} onChanges
 */
export function subscribeCollection(uid, name, onChanges, onError, { max, orderField = 'date' } = {}) {
  const { db } = getServices();
  let ref = collection(db, 'users', uid, name);
  if (max) ref = query(ref, orderBy(orderField, 'desc'), limit(max));
  return onSnapshot(
    ref,
    (snap) => {
      const changes = snap.docChanges().map((c) => ({ id: c.doc.id, type: c.type, data: c.doc.data() }));
      if (changes.length) onChanges(changes);
    },
    (err) => onError?.(err),
  );
}

export function subscribeDoc(uid, path, onData, onError) {
  const { db } = getServices();
  return onSnapshot(
    userDoc(db, uid, path),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  );
}

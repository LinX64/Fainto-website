/**
 * Fainto Web Connect — Firebase Web SDK bootstrap.
 *
 * FIREBASE_WEB_CONFIG below holds PLACEHOLDER values. These are not secrets —
 * Firebase Web config is meant to ship in client code; access is enforced by
 * firestore.rules and Firebase Auth, not by hiding this file — but the real,
 * project-specific values still have to come from you:
 *
 *   1. Open the Firebase Console for project "vaultai-26d8f".
 *   2. Project settings (gear icon) → General → "Your apps".
 *   3. If there's no Web app yet, click "Add app" → Web (</>) and register one
 *      (any nickname, e.g. "Fainto Web Connect"; Firebase Hosting is optional).
 *   4. Copy the firebaseConfig object it shows you and paste the four
 *      REPLACE_WITH_* values below with the real ones. authDomain,
 *      projectId, storageBucket and messagingSenderId are already filled in
 *      from the Android app's google-services.json (same Firebase project).
 *
 * Do NOT commit real values to a public repo if this file is ever open-sourced
 * separately from a private deploy — see the deploy note this task reports.
 */
import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

export const FIREBASE_WEB_CONFIG = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "vaultai-26d8f.firebaseapp.com",
  projectId: "vaultai-26d8f",
  storageBucket: "vaultai-26d8f.firebasestorage.app",
  messagingSenderId: "860764082981",
  appId: "REPLACE_WITH_FIREBASE_WEB_APP_ID",
};

const PLACEHOLDER_PREFIX = "REPLACE_WITH_";

export function isFirebaseConfigured() {
  return (
    !FIREBASE_WEB_CONFIG.apiKey.startsWith(PLACEHOLDER_PREFIX) &&
    !FIREBASE_WEB_CONFIG.appId.startsWith(PLACEHOLDER_PREFIX)
  );
}

let cachedApp = null;
export function getFirebaseApp() {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  return cachedApp;
}

let cachedAuth = null;
export function getFirebaseAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

let cachedFirestore = null;
export function getFirebaseFirestore() {
  if (cachedFirestore) return cachedFirestore;
  cachedFirestore = getFirestore(getFirebaseApp());
  return cachedFirestore;
}

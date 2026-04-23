// Firebase Realtime Database initialization.
// Lazily imported on first use — not loaded for L1–L5 unless Firebase is configured.

import { firebaseConfig } from '../../config.js';

const FIREBASE_VER = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}`;

let _db  = null;
let _fns = null; // cached database helper functions

export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
         Boolean(firebaseConfig.databaseURL);
}

export async function getDB() {
  if (_db) return _db;

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase not configured. Open config.js and fill in your project credentials. ' +
      'See README.md for setup instructions.'
    );
  }

  const [{ initializeApp, getApps }, { getDatabase }] = await Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-database.js`),
  ]);

  // Avoid "duplicate app" error if module is re-imported
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _db = getDatabase(app);
  return _db;
}

export async function getFirebaseDB() {
  if (_fns) return _fns;
  _fns = await import(`${BASE}/firebase-database.js`);
  return _fns;
}

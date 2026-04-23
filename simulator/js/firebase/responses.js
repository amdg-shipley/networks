// Student response storage for L1–L5 reflection answers.
// Silently no-ops when Firebase is not configured.

import { getDB, getFirebaseDB, isFirebaseConfigured } from './db.js';

/**
 * Save a student's reflection answer for a level.
 * Silently skips if Firebase is not configured.
 *
 * @param {string} userId
 * @param {string} studentName
 * @param {number} levelNum   1–5
 * @param {string} answer
 */
export async function saveResponse(userId, studentName, levelNum, answer) {
  if (!isFirebaseConfigured()) return;

  try {
    const [db, { ref, set, serverTimestamp }] = await Promise.all([
      getDB(),
      getFirebaseDB(),
    ]);

    await set(ref(db, `responses/${userId}/levels/${levelNum}`), {
      answer,
      submittedAt:     serverTimestamp(),
      levelCompleted:  true,
    });

    // Write/update name separately so it's always current
    await set(ref(db, `responses/${userId}/name`), studentName);
  } catch (err) {
    // Don't surface Firebase errors to students — offline-first
    console.warn('Response save failed (non-critical):', err.message);
  }
}

/**
 * Watch all student responses in real time.
 * Returns an unsubscribe function.
 * Shape of data: { [userId]: { name, levels: { [n]: { answer, submittedAt, levelCompleted } } } }
 *
 * @param {Function} callback
 * @returns {Promise<Function>} unsubscribe
 */
export async function watchResponses(callback) {
  const [db, { ref, onValue }] = await Promise.all([
    getDB(),
    getFirebaseDB(),
  ]);

  return onValue(ref(db, 'responses'), snap => {
    callback(snap.val() || {});
  });
}

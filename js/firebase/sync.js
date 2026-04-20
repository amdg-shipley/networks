// Firebase sync helpers for Level 6 multiplayer topology.
// All functions are async and return data or void.

import { getDB, getFirebaseDB } from './db.js';

// ── Helpers ───────────────────────────────────────────────
async function fb() {
  const [db, fns] = await Promise.all([getDB(), getFirebaseDB()]);
  return { db, ...fns };
}

// ── Presence ──────────────────────────────────────────────

export async function joinRoom(roomCode, userId, displayName) {
  const { db, ref, set, onDisconnect, serverTimestamp } = await fb();
  const presenceRef = ref(db, `rooms/${roomCode}/presence/${userId}`);
  await set(presenceRef, { name: displayName, lastSeen: serverTimestamp() });
  onDisconnect(presenceRef).remove();
}

export async function watchPresence(roomCode, callback) {
  const { db, ref, onValue } = await fb();
  const presenceRef = ref(db, `rooms/${roomCode}/presence`);
  const unsub = onValue(presenceRef, snap => {
    const data = snap.val() || {};
    callback(Object.entries(data).map(([uid, p]) => ({ uid, ...p })));
  });
  return unsub;
}

// ── Nodes ─────────────────────────────────────────────────

export async function addNode(roomCode, nodeData) {
  const { db, ref, push, runTransaction, serverTimestamp } = await fb();

  // Atomic IP counter
  const counterRef = ref(db, `rooms/${roomCode}/meta/nodeCount`);
  let count = 1;
  await runTransaction(counterRef, current => {
    count = (current || 0) + 1;
    return count;
  });

  // Room octet from room code hash
  let hash = 0;
  for (const c of roomCode) hash = (hash * 31 + c.charCodeAt(0)) & 0xff;
  const roomOctet = (hash % 254) + 1;
  const ip = `192.168.${roomOctet}.${count}`;

  const nodesRef = ref(db, `rooms/${roomCode}/nodes`);
  const snap = await push(nodesRef, {
    ...nodeData,
    ip,
    alive:     true,
    createdAt: serverTimestamp(),
  });
  return snap.key;
}

export async function updateNode(roomCode, nodeId, updates) {
  const { db, ref, update } = await fb();
  await update(ref(db, `rooms/${roomCode}/nodes/${nodeId}`), updates);
}

export async function removeNode(roomCode, nodeId) {
  const { db, ref, remove } = await fb();
  await remove(ref(db, `rooms/${roomCode}/nodes/${nodeId}`));
}

export async function watchNodes(roomCode, callback) {
  const { db, ref, onValue } = await fb();
  const nodesRef = ref(db, `rooms/${roomCode}/nodes`);
  return onValue(nodesRef, snap => {
    const data = snap.val() || {};
    callback(data);
  });
}

// ── Edges ─────────────────────────────────────────────────

export async function addEdge(roomCode, fromId, toId, bandwidth = 'medium') {
  const { db, ref, set } = await fb();
  const edgeId = [fromId, toId].sort().join('_');
  await set(ref(db, `rooms/${roomCode}/edges/${edgeId}`), {
    from: fromId,
    to:   toId,
    bandwidth,
  });
  return edgeId;
}

export async function removeEdge(roomCode, edgeId) {
  const { db, ref, remove } = await fb();
  await remove(ref(db, `rooms/${roomCode}/edges/${edgeId}`));
}

export async function watchEdges(roomCode, callback) {
  const { db, ref, onValue } = await fb();
  return onValue(ref(db, `rooms/${roomCode}/edges`), snap => {
    const data = snap.val() || {};
    callback(data);
  });
}

// ── Messages ──────────────────────────────────────────────

export async function sendMessage(roomCode, fromId, toId, content) {
  const { db, ref, push, serverTimestamp } = await fb();
  await push(ref(db, `rooms/${roomCode}/messages`), {
    from:      fromId,
    to:        toId,
    content,
    timestamp: serverTimestamp(),
    status:    'sending',
  });
}

export async function watchMessages(roomCode, callback) {
  const { db, ref, onValue } = await fb();
  return onValue(ref(db, `rooms/${roomCode}/messages`), snap => {
    const data = snap.val() || {};
    callback(data);
  });
}

// Level 6 — Multiplayer Collaborative Network Lab
// Firebase Realtime Database synced topology builder + fault tolerance challenges.

import { log }                                    from '../utils/terminal.js';
import { animatePacket, showDrop, showBanner, delay } from '../utils/animation.js';
import { bfs, findSinglePointsOfFailure, isFaultTolerant } from '../utils/pathfinding.js';
import { onContextMenu }                          from '../utils/pointer-events.js';
import { setConceptLevel }                        from '../components/concept-panel.js';
import { completeLevel, openModal, closeModal }   from '../app.js';
import * as sync                                  from '../firebase/sync.js';

// ── State ─────────────────────────────────────────────────
let roomCode    = null;
let userId      = null;
let displayName = null;
let myDeviceId  = null;   // the user's "My Device" end-device node ID

let nodesData   = {};     // id → node record (from Firebase)
let edgesData   = {};     // edgeId → edge record (from Firebase)

let unsubNodes    = null;
let unsubEdges    = null;
let unsubPresence = null;
let unsubMessages = null;
let removeCtxMenu = null; // cleanup for context menu listener
let removeLongPress= null;

let pendingEdgeFrom = null; // nodeId of first click in edge draw mode
let svgEl = null;
let running = false;
let cancelFns = [];
let completed = false;

// Node type metadata
const NODE_TYPES = {
  router:    { label: 'Router',     icon: '⬡', shape: 'hex'     },
  endDevice: { label: 'End Device', icon: '●', shape: 'circle'  },
  dns:       { label: 'DNS Server', icon: '◆', shape: 'diamond' },
  webServer: { label: 'Web Server', icon: '▬', shape: 'rect'    },
};

export function mount(container) {
  setConceptLevel(6);

  // Load userId / displayName from localStorage
  const stored = loadIdentity();
  userId = stored.userId;

  // Show join modal
  const joinModal = document.getElementById('join-modal');
  const joinName  = document.getElementById('join-name');
  const joinCode  = document.getElementById('join-code');
  const joinBtn   = document.getElementById('join-submit');
  const joinErr   = document.getElementById('join-error');

  if (stored.name)     joinName.value = stored.name;
  if (stored.roomCode) joinCode.value = stored.roomCode;

  openModal(joinModal);

  joinBtn.onclick = async () => {
    const name = joinName.value.trim();
    const code = joinCode.value.trim().toUpperCase();
    if (!name) { showJoinError('Enter your display name.'); return; }
    if (!code) { showJoinError('Enter the room code from the board.'); return; }

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';

    try {
      displayName = name;
      roomCode    = code;
      saveIdentity({ userId, name, roomCode: code });

      await sync.joinRoom(roomCode, userId, displayName);
      closeModal(joinModal);
      mountLab(container);
    } catch (err) {
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join Room';
      const isUnconfigured = err.message?.includes('not configured');
      showJoinError(
        isUnconfigured
          ? 'Firebase is not configured. Ask your teacher to fill in config.js — see README.md for setup steps.'
          : `Connection failed: ${err.message}`
      );
    }
  };

  function showJoinError(msg) {
    joinErr.textContent = msg;
    joinErr.hidden      = false;
  }
}

export function unmount() {
  unsubNodes?.();
  unsubEdges?.();
  unsubPresence?.();
  unsubMessages?.();
  removeCtxMenu?.();
  removeLongPress?.();
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl     = null;
  nodesData = {};
  edgesData = {};
  pendingEdgeFrom = null;
  const joinModal = document.getElementById('join-modal');
  if (joinModal) joinModal.hidden = true;
}

// ── Identity ──────────────────────────────────────────────
function loadIdentity() {
  try {
    const raw = localStorage.getItem('netsim_identity');
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  // Generate new userId
  const id = 'u_' + Math.random().toString(36).slice(2, 10);
  return { userId: id };
}

function saveIdentity(data) {
  localStorage.setItem('netsim_identity', JSON.stringify(data));
}

// ── Mount the actual lab UI ───────────────────────────────
async function mountLab(container) {
  container.innerHTML = buildHTML();
  svgEl = container.querySelector('#l6-svg');
  attachMouseMove();

  log(`Joined room ${roomCode} as ${displayName}`, 'success');
  log('Click the canvas to place a node. Click a node to start drawing an edge.', 'info');

  // Subscribe Firebase streams
  unsubNodes    = await sync.watchNodes(roomCode, onNodesUpdate);
  unsubEdges    = await sync.watchEdges(roomCode, onEdgesUpdate);
  unsubPresence = await sync.watchPresence(roomCode, onPresenceUpdate);
  unsubMessages = await sync.watchMessages(roomCode, onMessagesUpdate);

  // Canvas click: place node or second-click edge
  svgEl.addEventListener('click', onCanvasClick);

  // Context menu on SVG (for node actions)
  removeCtxMenu = onContextMenu(svgEl, onContextMenuRequest);

  // Node type selector
  container.querySelector('#l6-node-type').addEventListener('change', e => {
    // nodeType is set from the selector, used when placing next node
  });

  // Send message
  container.querySelector('#l6-send-msg-btn').addEventListener('click', onSendMessage);

  // Fault tolerance buttons
  container.querySelector('#l6-spof-btn').addEventListener('click', onFaultCheck);
  container.querySelector('#l6-ft-btn').addEventListener('click', onFTCheck);

  // Mark complete button (shown after ft-check passes)
  container.querySelector('#l6-complete-btn').addEventListener('click', onMarkComplete);
}

// ── HTML ─────────────────────────────────────────────────
function buildHTML() {
  return `
    <div class="level-controls">
      <span class="level-title">L6 — COLLABORATIVE NETWORK LAB</span>
      <span id="l6-room-badge" style="font-family:var(--font-mono);font-size:0.65rem;
        color:var(--green);border:1px solid var(--green);padding:0.15rem 0.5rem;border-radius:3px">
        ROOM: ${roomCode}
      </span>
      <select id="l6-node-type" class="field-input" style="width:auto;padding:0.3rem 0.5rem">
        <option value="endDevice">● End Device</option>
        <option value="router">⬡ Router</option>
        <option value="dns">◆ DNS Server</option>
        <option value="webServer">▬ Web Server</option>
      </select>
      <span id="l6-instruction" style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted)">
        Click canvas → place node
      </span>
    </div>

    <!-- Canvas -->
    <div id="l6-canvas-wrap" style="flex:1;min-height:340px;position:relative">
      <svg id="l6-svg" style="width:100%;height:100%;min-height:340px;cursor:crosshair">
        <line id="pending-edge" x1="0" y1="0" x2="0" y2="0"
              stroke="var(--blue)" stroke-width="1.5" stroke-dasharray="6 4"
              pointer-events="none" style="display:none" />
      </svg>
    </div>

    <!-- Bottom controls -->
    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-top:0.75rem">
      <!-- Message send -->
      <div style="display:flex;gap:0.5rem;align-items:center">
        <select id="l6-dest-select" class="field-input" style="width:auto;padding:0.3rem 0.5rem">
          <option value="">— select destination —</option>
        </select>
        <input id="l6-msg-input" class="field-input" type="text"
          placeholder="Message…" maxlength="40" style="max-width:160px" autocomplete="off" />
        <button id="l6-send-msg-btn" class="btn btn--secondary">SEND</button>
      </div>

      <!-- Fault tolerance -->
      <button id="l6-spof-btn" class="btn btn--ghost">Run Fault Tolerance Check</button>
      <button id="l6-ft-btn" class="btn btn--ghost">Check Fault Tolerance</button>
    </div>

    <!-- Presence sidebar -->
    <div id="l6-presence" class="presence-list" style="margin-top:0.5rem;
      font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono)">
      Connected: loading…
    </div>

    <!-- FT result -->
    <div id="l6-ft-result" style="margin-top:0.5rem"></div>

    <!-- Complete button (hidden until FT passes) -->
    <div style="margin-top:0.75rem">
      <button id="l6-complete-btn" class="btn btn--primary" style="display:none">
        Mark Complete — Level 6
      </button>
    </div>
    <div id="l6-complete"></div>

    <!-- Context menu (hidden by default) -->
    <div id="l6-ctx-menu" class="ctx-menu" style="display:none;position:fixed;z-index:60"></div>
  `;
}

// ── Firebase callbacks ────────────────────────────────────
function onNodesUpdate(data) {
  nodesData = data || {};
  renderTopology();
  updateDestinationSelect();
}

function onEdgesUpdate(data) {
  edgesData = data || {};
  renderTopology();
}

function onPresenceUpdate(users) {
  const el = document.querySelector('#l6-presence');
  if (!el) return;
  if (!users.length) { el.textContent = 'No one else in the room.'; return; }
  el.innerHTML = users.map(u => `
    <div class="presence-item">
      <div class="presence-dot"></div>
      <span>${escapeHtml(u.name)}${u.uid === userId ? ' (you)' : ''}</span>
    </div>`).join('');
}

function onMessagesUpdate(data) {
  if (!data) return;
  const msgs = Object.values(data);
  const mine = msgs.filter(m => m.to === myDeviceId && m.status !== 'seen');
  if (mine.length) {
    mine.forEach(m => {
      log(`Message from ${m.from}: "${m.content}"`, 'success');
    });
  }
}

// ── Topology rendering ────────────────────────────────────
function renderTopology() {
  if (!svgEl) return;

  const rect  = svgEl.getBoundingClientRect();
  const W     = rect.width  || 740;
  const H     = rect.height || 340;

  // Clear all rendered nodes/edges (keep pending-edge line)
  svgEl.querySelectorAll('.rendered-node, .rendered-edge').forEach(el => el.remove());

  // Draw edges
  for (const [edgeId, edge] of Object.entries(edgesData)) {
    const from = nodesData[edge.from];
    const to   = nodesData[edge.to];
    if (!from || !to) continue;

    const x1 = from.x * W, y1 = from.y * H;
    const x2 = to.x   * W, y2 = to.y   * H;
    const alive = (from.alive !== false) && (to.alive !== false);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path.setAttribute('class', `rendered-edge edge ${alive ? 'edge--inactive' : ''}`);
    if (!alive) path.style.opacity = '0.3';
    path.setAttribute('data-edge-id', edgeId);
    path.setAttribute('x1', x1); path.setAttribute('y1', y1);
    path.setAttribute('x2', x2); path.setAttribute('y2', y2);
    path.style.stroke      = alive ? 'var(--gray-muted)' : 'var(--red)';
    path.style.strokeWidth = edge.bandwidth === 'high' ? '4' :
                             edge.bandwidth === 'low'  ? '1.5' : '2.5';

    // Bandwidth label
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    const bwLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    bwLabel.setAttribute('x', midX);
    bwLabel.setAttribute('y', midY - 6);
    bwLabel.setAttribute('fill', 'var(--text-muted)');
    bwLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
    bwLabel.setAttribute('font-size', '8');
    bwLabel.setAttribute('text-anchor', 'middle');
    bwLabel.setAttribute('pointer-events', 'none');
    bwLabel.setAttribute('class', 'rendered-edge');
    bwLabel.textContent = edge.bandwidth || 'med';

    svgEl.insertBefore(path, svgEl.firstChild);
    svgEl.insertBefore(bwLabel, svgEl.firstChild.nextSibling);
  }

  // Draw nodes
  for (const [nodeId, node] of Object.entries(nodesData)) {
    const cx = node.x * W;
    const cy = node.y * H;
    const typeInfo = NODE_TYPES[node.type] || NODE_TYPES.endDevice;
    const isKilled = node.alive === false;
    const isMyDevice = nodeId === myDeviceId;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `node-group rendered-node${isKilled ? ' node--killed' : ''}${isMyDevice ? ' node--active' : ''}`);
    g.setAttribute('data-node-id', nodeId);
    g.setAttribute('transform', `translate(${cx},${cy})`);

    // Shape
    let shapeEl;
    if (typeInfo.shape === 'hex') {
      shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      shapeEl.setAttribute('class', 'node-hex');
      shapeEl.setAttribute('points', '0,-24 20,-12 20,12 0,24 -20,12 -20,-12');
    } else if (typeInfo.shape === 'diamond') {
      shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      shapeEl.setAttribute('class', 'node-diamond');
      shapeEl.setAttribute('points', '0,-26 22,0 0,26 -22,0');
    } else if (typeInfo.shape === 'rect') {
      shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shapeEl.setAttribute('class', 'node-rect');
      shapeEl.setAttribute('x', -32); shapeEl.setAttribute('y', -22);
      shapeEl.setAttribute('width', 64); shapeEl.setAttribute('height', 44);
    } else {
      shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shapeEl.setAttribute('class', 'node-circle');
      shapeEl.setAttribute('cx', 0); shapeEl.setAttribute('cy', 0);
      shapeEl.setAttribute('r', 26);
    }
    g.appendChild(shapeEl);

    // Pulse ring
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('class', 'node-pulse-ring');
    pulse.setAttribute('cx', 0); pulse.setAttribute('cy', 0);
    pulse.setAttribute('r', 30);
    g.appendChild(pulse);

    // Kill X
    if (isKilled) {
      const x1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      x1.setAttribute('class', 'node-kill-x');
      x1.setAttribute('x1', -12); x1.setAttribute('y1', -12);
      x1.setAttribute('x2',  12); x1.setAttribute('y2',  12);
      const x2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      x2.setAttribute('class', 'node-kill-x');
      x2.setAttribute('x1',  12); x2.setAttribute('y1', -12);
      x2.setAttribute('x2', -12); x2.setAttribute('y2',  12);
      g.appendChild(x1);
      g.appendChild(x2);
    }

    // Label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'node-label');
    label.setAttribute('x', 0); label.setAttribute('y', -4);
    label.textContent = node.label || typeInfo.label;
    g.appendChild(label);

    // IP sublabel
    const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sub.setAttribute('class', 'node-sublabel');
    sub.setAttribute('x', 0); sub.setAttribute('y', 11);
    sub.textContent = node.ip || '';
    g.appendChild(sub);

    // "My Device" indicator
    if (isMyDevice) {
      const ind = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ind.setAttribute('x', 0); ind.setAttribute('y', -32);
      ind.setAttribute('fill', 'var(--green)');
      ind.setAttribute('font-family', 'JetBrains Mono, monospace');
      ind.setAttribute('font-size', '8');
      ind.setAttribute('text-anchor', 'middle');
      ind.textContent = '★ MY DEVICE';
      g.appendChild(ind);
    }

    // Click handler: edge drawing
    g.addEventListener('click', e => {
      e.stopPropagation();
      onNodeClick(nodeId, cx, cy);
    });

    svgEl.appendChild(g);
  }
}

// ── Canvas / node click ───────────────────────────────────
function onCanvasClick(e) {
  if (e.target !== svgEl) return; // clicked on a node — handled by node click handler
  if (pendingEdgeFrom) {
    // Cancel edge draw
    pendingEdgeFrom = null;
    hidePendingEdge();
    setInstruction('Click canvas → place node');
    return;
  }

  const rect = svgEl.getBoundingClientRect();
  const x    = (e.clientX - rect.left) / rect.width;
  const y    = (e.clientY - rect.top)  / rect.height;

  placeNode(x, y);
}

function onNodeClick(nodeId, cx, cy) {
  const node = nodesData[nodeId];
  if (!node || node.alive === false) return;

  if (!pendingEdgeFrom) {
    // Start edge draw
    pendingEdgeFrom = nodeId;
    showPendingEdge(cx, cy, cx, cy);
    setInstruction(`Drawing edge from ${node.label || nodeId} — click another node`);
    log(`Edge draw started from ${node.label || nodeId}`, 'info');
  } else {
    if (pendingEdgeFrom === nodeId) {
      // Cancel
      pendingEdgeFrom = null;
      hidePendingEdge();
      setInstruction('Click canvas → place node');
      return;
    }
    // Complete the edge
    const fromNode = nodesData[pendingEdgeFrom];
    log(`Edge: ${fromNode?.label || pendingEdgeFrom} ↔ ${node.label || nodeId}`, 'info');
    sync.addEdge(roomCode, pendingEdgeFrom, nodeId, 'medium');
    pendingEdgeFrom = null;
    hidePendingEdge();
    setInstruction('Click canvas → place node');
  }
}

function attachMouseMove() {
  if (!svgEl) return;
  svgEl.addEventListener('mousemove', e => {
    if (!pendingEdgeFrom) return;
    const rect = svgEl.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const fromNode = nodesData[pendingEdgeFrom];
    if (!fromNode) return;
    const x1 = fromNode.x * W, y1 = fromNode.y * H;
    const x2 = e.clientX - rect.left, y2 = e.clientY - rect.top;
    showPendingEdge(x1, y1, x2, y2);
  });
}

function showPendingEdge(x1, y1, x2, y2) {
  const line = svgEl?.querySelector('#pending-edge');
  if (!line) return;
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.style.display = '';
}

function hidePendingEdge() {
  const line = svgEl?.querySelector('#pending-edge');
  if (line) line.style.display = 'none';
}

function setInstruction(text) {
  const el = document.querySelector('#l6-instruction');
  if (el) el.textContent = text;
}

// ── Place node ────────────────────────────────────────────
async function placeNode(xRatio, yRatio) {
  const existing = Object.keys(nodesData).length;
  if (existing >= 8) {
    log('Maximum 8 nodes per room.', 'warn');
    return;
  }

  const typeEl  = document.querySelector('#l6-node-type');
  const type    = typeEl?.value || 'endDevice';
  const typeInfo= NODE_TYPES[type];

  // Snap to ~20px grid (ratio-based)
  const W = svgEl?.getBoundingClientRect().width || 740;
  const H = svgEl?.getBoundingClientRect().height || 340;
  const snapX = Math.round(xRatio * W / 20) * 20 / W;
  const snapY = Math.round(yRatio * H / 20) * 20 / H;

  const nodeCount = Object.keys(nodesData).length + 1;
  const label     = `${typeInfo.label} ${nodeCount}`;

  const nodeId = await sync.addNode(roomCode, {
    type, label,
    x: Math.min(Math.max(snapX, 0.05), 0.95),
    y: Math.min(Math.max(snapY, 0.05), 0.95),
    addedBy: userId,
  });

  // If first end device placed by this user, mark as "My Device"
  if (type === 'endDevice' && !myDeviceId) {
    myDeviceId = nodeId;
    log(`"${label}" set as your device.`, 'success');
  }

  log(`Placed ${label}`, 'success');
}

// ── Context menu ──────────────────────────────────────────
function onContextMenuRequest({ x, y, target }) {
  const nodeEl = target.closest('[data-node-id]');
  if (!nodeEl) return;

  const nodeId = nodeEl.dataset.nodeId;
  const node   = nodesData[nodeId];
  if (!node) return;

  const menu = document.querySelector('#l6-ctx-menu');
  if (!menu) return;

  const alive = node.alive !== false;
  menu.innerHTML = `
    <div style="padding:0.3rem 0.75rem;font-family:var(--font-mono);font-size:0.6rem;
      color:var(--text-muted);border-bottom:1px solid var(--gray-muted);letter-spacing:0.1em">
      ${escapeHtml(node.label || nodeId)}
    </div>
    ${alive ? `<button class="ctx-item ctx-item--danger" data-action="kill">Kill Node</button>` : ''}
    ${!alive ? `<button class="ctx-item" data-action="revive">Revive Node</button>` : ''}
    <button class="ctx-item" data-action="rename">Rename…</button>
    <button class="ctx-item ctx-item--danger" data-action="delete">Delete Node</button>
  `;

  menu.style.left    = x + 'px';
  menu.style.top     = y + 'px';
  menu.style.display = '';

  menu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      onContextAction(btn.dataset.action, nodeId, node);
      menu.style.display = 'none';
    });
  });

  // Dismiss on outside click
  const dismiss = () => { menu.style.display = 'none'; document.removeEventListener('click', dismiss); };
  setTimeout(() => document.addEventListener('click', dismiss), 10);
}

async function onContextAction(action, nodeId, node) {
  if (action === 'kill') {
    await sync.updateNode(roomCode, nodeId, { alive: false });
    log(`Node "${node.label}" killed.`, 'error');
  } else if (action === 'revive') {
    await sync.updateNode(roomCode, nodeId, { alive: true });
    log(`Node "${node.label}" revived.`, 'success');
  } else if (action === 'delete') {
    await sync.removeNode(roomCode, nodeId);
    // Remove attached edges
    for (const [edgeId, edge] of Object.entries(edgesData)) {
      if (edge.from === nodeId || edge.to === nodeId) {
        await sync.removeEdge(roomCode, edgeId);
      }
    }
    log(`Node "${node.label}" deleted.`, 'warn');
  } else if (action === 'rename') {
    const newName = prompt(`Rename "${node.label}":`, node.label);
    if (newName?.trim()) {
      await sync.updateNode(roomCode, nodeId, { label: newName.trim() });
      log(`Node renamed to "${newName.trim()}"`, 'info');
    }
  }
}

// ── Send message ──────────────────────────────────────────
async function onSendMessage() {
  if (!myDeviceId) {
    log('Place an End Device node first — it will become "My Device".', 'warn');
    return;
  }

  const destSel = document.querySelector('#l6-dest-select');
  const msgInp  = document.querySelector('#l6-msg-input');
  const destId  = destSel?.value;
  const content = msgInp?.value?.trim();

  if (!destId) { log('Select a destination node.', 'warn'); return; }
  if (!content){ log('Enter a message.', 'warn'); return; }

  const nodeMap = new Map(
    Object.entries(nodesData).map(([id, n]) => [id, { alive: n.alive !== false }])
  );
  const edgeList = Object.values(edgesData).map(e => ({ from: e.from, to: e.to }));
  const path     = bfs(nodeMap, edgeList, myDeviceId, destId);

  if (!path) {
    log(`Network unreachable: no path from ${nodesData[myDeviceId]?.label} to ${nodesData[destId]?.label}`, 'error');
    return;
  }

  log(`Routing "${content}" via ${path.map(id => nodesData[id]?.label || id).join(' → ')}`, 'info');
  await sync.sendMessage(roomCode, myDeviceId, destId, content);
  msgInp.value = '';

  // Animate along path
  for (let i = 0; i < path.length - 1; i++) {
    const fromNode = nodesData[path[i]];
    const toNode   = nodesData[path[i + 1]];
    if (!fromNode || !toNode) continue;

    const rect = svgEl.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const x1 = fromNode.x * W, y1 = fromNode.y * H;
    const x2 = toNode.x   * W, y2 = toNode.y   * H;

    // Create a temporary SVG path for the animation
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    tempPath.style.display = 'none';
    svgEl.appendChild(tempPath);

    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, tempPath, {
        label:    content.slice(0, 4),
        color:    'green',
        duration: 600,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    tempPath.remove();
  }

  log(`"${content}" delivered to ${nodesData[destId]?.label || destId}`, 'success');
}

function updateDestinationSelect() {
  const sel = document.querySelector('#l6-dest-select');
  if (!sel) return;

  const prevVal = sel.value;
  sel.innerHTML = '<option value="">— select destination —</option>';

  for (const [id, node] of Object.entries(nodesData)) {
    if (id === myDeviceId) continue;
    if (node.type !== 'endDevice') continue;
    if (node.alive === false) continue;
    const opt = document.createElement('option');
    opt.value       = id;
    opt.textContent = node.label || id;
    if (id === prevVal) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ── Fault tolerance challenges ────────────────────────────
async function onFaultCheck() {
  const nodeMap  = new Map(Object.entries(nodesData).map(([id, n]) => [id, { alive: n.alive !== false }]));
  const edgeList = Object.values(edgesData).map(e => ({ from: e.from, to: e.to }));
  const spofs    = findSinglePointsOfFailure(nodeMap, edgeList);

  const resultEl = document.querySelector('#l6-ft-result');

  if (!spofs.length) {
    log('No single points of failure found — network is robust!', 'success');
    if (resultEl) {
      resultEl.innerHTML = `<div class="callout callout--green">No single points of failure found.</div>`;
    }
    return;
  }

  log(`Single points of failure: ${spofs.map(id => nodesData[id]?.label || id).join(', ')}`, 'warn');

  if (resultEl) {
    resultEl.innerHTML = `<div class="callout callout--amber">
      Single point(s) of failure found: <strong>${spofs.map(id => nodesData[id]?.label || id).join(', ')}</strong>
      <br/>Discuss with your group: how would you fix this?
    </div>`;
  }

  // Highlight SPOFs in amber
  spofs.forEach(nodeId => {
    svgEl?.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('node--spof');
  });

  setTimeout(() => {
    spofs.forEach(nodeId => {
      svgEl?.querySelector(`[data-node-id="${nodeId}"]`)?.classList.remove('node--spof');
    });
  }, 5000);
}

async function onFTCheck() {
  const nodeMap  = new Map(Object.entries(nodesData).map(([id, n]) => [id, { alive: n.alive !== false }]));
  const edgeList = Object.values(edgesData).map(e => ({ from: e.from, to: e.to }));
  const ft       = isFaultTolerant(nodeMap, edgeList);

  const resultEl = document.querySelector('#l6-ft-result');
  const complBtn = document.querySelector('#l6-complete-btn');

  if (ft) {
    log('Network is fault tolerant — every node has 2+ independent paths!', 'success');
    if (resultEl) {
      resultEl.innerHTML = `<div class="callout callout--green sim-banner ft-banner--ok">
        Network is fault tolerant ✓
      </div>`;
    }
    showBanner(svgEl?.parentElement || document.getElementById('level-canvas'),
              'Network is fault tolerant!', 3000);
    if (complBtn) complBtn.style.display = '';
  } else {
    log('Network is NOT fault tolerant — some nodes lack redundant paths.', 'error');
    if (resultEl) {
      resultEl.innerHTML = `<div class="callout callout--red">
        Not fault tolerant yet. Add more edges to create redundant paths.
      </div>`;
    }
  }
}

function onMarkComplete() {
  if (!completed) {
    completed = true;
    markComplete(document.getElementById('level-canvas'));
    completeLevel(6);
    log('Level 6 complete! Well done.', 'success');
  }
}

function markComplete(container) {
  const el = container?.querySelector('#l6-complete');
  if (!el || el.querySelector('.complete-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 6 COMPLETE — All levels finished!</span>
  `;
  el.appendChild(banner);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

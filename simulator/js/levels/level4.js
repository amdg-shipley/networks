// Level 4 — Packets, Routing & TCP Handshake
// Topology: CLIENT ── ROUTER-A ── ROUTER-B ── SERVER
//                          └──── ROUTER-C ────┘

import { log }                                      from '../utils/terminal.js';
import { animatePacket, showBanner, showDrop, delay } from '../utils/animation.js';
import { bfs }                                       from '../utils/pathfinding.js';
import { setConceptLevel }                           from '../components/concept-panel.js';
import { completeLevel }                             from '../app.js';
import { getIdentity }                               from '../utils/identity.js';
import { saveResponse }                              from '../firebase/responses.js';

// ── SVG topology ─────────────────────────────────────────
// Nodes
const NODES = {
  client:  { x: 80,  y: 110, label: 'CLIENT',   sub: '10.0.0.1' },
  routerA: { x: 240, y: 110, label: 'ROUTER',   sub: 'A' },
  routerB: { x: 430, y: 60,  label: 'ROUTER',   sub: 'B' },
  routerC: { x: 430, y: 160, label: 'ROUTER',   sub: 'C' },
  server:  { x: 610, y: 110, label: 'SERVER',   sub: '10.0.0.9' },
};

// Edges as {from, to, id}
const EDGES = [
  { from: 'client',  to: 'routerA', id: 'e-ca' },
  { from: 'routerA', to: 'routerB', id: 'e-ab' },
  { from: 'routerA', to: 'routerC', id: 'e-ac' },
  { from: 'routerB', to: 'server',  id: 'e-bs' },
  { from: 'routerC', to: 'server',  id: 'e-cs' },
];

// Topology maps for BFS
function toNodeMap() {
  return new Map(Object.keys(NODES).map(id => [id, { alive: true }]));
}
function toEdgeList() {
  return EDGES.map(e => ({ from: e.from, to: e.to }));
}

// Path α: client→A→B→server, Path β: client→A→C→server
const PATH_ALPHA = ['client','routerA','routerB','server'];
const PATH_BETA  = ['client','routerA','routerC','server'];

const SVG_W = 720, SVG_H = 240;

let svgEl    = null;
let running  = false;
let cancelFns= [];
let completed= false;

export function mount(container) {
  setConceptLevel(4);
  container.innerHTML = buildHTML();
  svgEl = container.querySelector('#l4-svg');

  container.querySelector('#l4-send-btn').addEventListener('click', onSend);
  container.querySelector('#l4-submit-btn').addEventListener('click', onSubmitChallenge);

  try {
    const p = JSON.parse(localStorage.getItem('netsim_progress') || '{}');
    if (p.completed?.includes(4)) markComplete(container);
  } catch (_) { /* ignore */ }

  log('Level 4 loaded — TCP/IP & Packet Routing', 'muted');
  log('Click SEND to begin the TCP three-way handshake, then data transfer.', 'info');
}

export function unmount() {
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl     = null;
}

// ── SVG path helpers ─────────────────────────────────────
function getPath(edgeId) {
  return svgEl?.querySelector(`#${edgeId}`);
}

// Return the SVG path that connects nodeA→nodeB (direction matters for animation)
function pathBetween(fromId, toId) {
  // Find the edge — may need to be traversed in reverse
  const edge = EDGES.find(e =>
    (e.from === fromId && e.to === toId) ||
    (e.from === toId   && e.to === fromId)
  );
  if (!edge) return null;
  const p = svgEl?.querySelector(`#${edge.id}`);
  if (!p) return null;

  // If direction is reversed, we need a reversed path clone
  if (edge.from !== fromId) {
    return reversedPath(p);
  }
  return p;
}

function reversedPath(pathEl) {
  const d = pathEl.getAttribute('d');
  // For straight lines: M x1 y1 L x2 y2 → M x2 y2 L x1 y1
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return pathEl;
  const clone = pathEl.cloneNode();
  clone.setAttribute('d', `M ${m[3]} ${m[4]} L ${m[1]} ${m[2]}`);
  clone.id = ''; // don't duplicate id
  svgEl.appendChild(clone);
  // Remove clone after use via a tiny timeout
  setTimeout(() => clone.remove(), 10000);
  return clone;
}

// ── HTML ─────────────────────────────────────────────────
function buildHTML() {
  // Build edge <path> elements
  const edgePaths = EDGES.map(e => {
    const a = NODES[e.from], b = NODES[e.to];
    return `<path id="${e.id}" class="edge edge--inactive" stroke-width="2.5"
                  d="M ${a.x + (a.x < b.x ? 30 : -30)} ${a.y} L ${b.x + (b.x < a.x ? 30 : -30)} ${b.y}" />`;
  }).join('\n');

  // Build node elements
  const nodeEls = Object.entries(NODES).map(([id, n]) => {
    const isRouter = id.startsWith('router');
    if (isRouter) {
      return `
        <g class="node-group" id="n-${id}" transform="translate(${n.x},${n.y})">
          <polygon class="node-hex" points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" />
          <circle class="node-pulse-ring" cx="0" cy="0" r="28" />
          <text class="node-label" x="0" y="-3">${n.label}</text>
          <text class="node-sublabel" x="0" y="11">${n.sub}</text>
        </g>`;
    }
    return `
      <g class="node-group" id="n-${id}">
        <circle class="node-circle" cx="${n.x}" cy="${n.y}" />
        <circle class="node-pulse-ring" cx="${n.x}" cy="${n.y}" r="30" />
        <text class="node-label" x="${n.x}" y="${n.y - 4}">${n.label}</text>
        <text class="node-sublabel" x="${n.x}" y="${n.y + 11}">${n.sub}</text>
      </g>`;
  }).join('\n');

  return `
    <div class="level-controls">
      <span class="level-title">L4 — TCP/IP ROUTING</span>
      <label class="checkbox-label">
        <input type="checkbox" id="l4-loss-toggle" />
        Simulate 20% packet loss
      </label>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem">
      <input id="l4-msg-input" class="field-input" type="text"
        placeholder="Message to send" maxlength="16"
        style="max-width:220px" autocomplete="off" value="Hello World" />
      <button id="l4-send-btn" class="btn btn--primary">SEND</button>
      <span id="l4-status" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted)"></span>
    </div>

    <div style="position:relative">
      <svg id="l4-svg" class="sim-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
           style="height:${SVG_H}px;max-width:100%">
        ${edgePaths}
        ${nodeEls}
      </svg>
    </div>

    <!-- Handshake callout -->
    <div id="l4-callout" class="callout callout--blue" style="margin-top:0.75rem;display:none"></div>

    <!-- Packet reassembly grid -->
    <div style="margin-top:0.75rem">
      <div class="settings-label" style="margin-bottom:0.35rem;font-size:0.65rem">
        PACKET REASSEMBLY (Receiver Buffer)
      </div>
      <div id="l4-reassembly" class="reassembly-grid">
        ${[1,2,3,4].map(i => `
          <div class="reassembly-slot" id="l4-slot-${i}">
            <span class="reassembly-slot-num">PKT ${i}/4</span>
            <span class="reassembly-slot-content" id="l4-slot-content-${i}"></span>
          </div>`).join('')}
      </div>
      <div id="l4-reassembled" class="receiver-display" style="margin-top:0.5rem">—</div>
    </div>

    <!-- Challenge -->
    <div class="challenge-box" style="margin-top:1rem">
      <div class="challenge-prompt">
        <strong style="color:var(--blue);font-family:var(--font-mono);font-size:0.7rem">CHALLENGE</strong><br/>
        Enable packet loss, send a message, then answer:<br/>
        What would happen if TCP did not request retransmission of lost packets?
        (Minimum 20 characters)
      </div>
      <textarea id="l4-answer" class="challenge-textarea"
        placeholder="Your answer here…" maxlength="500"></textarea>
      <div class="challenge-actions">
        <button id="l4-submit-btn" class="btn btn--secondary">SUBMIT</button>
        <span id="l4-feedback" class="challenge-feedback"></span>
      </div>
    </div>
    <div id="l4-complete"></div>
  `;
}

// ── Helpers ───────────────────────────────────────────────
function setStatus(text, type = 'info') {
  const el = document.querySelector('#l4-status');
  if (el) {
    el.textContent = text;
    el.style.color = type === 'success' ? 'var(--green)'
                   : type === 'error'   ? 'var(--red)'
                   : 'var(--text-muted)';
  }
}

function setCallout(text, type = 'blue') {
  const el = document.querySelector('#l4-callout');
  if (!el) return;
  if (!text) { el.style.display = 'none'; return; }
  el.className = `callout callout--${type}`;
  el.textContent = text;
  el.style.display = '';
}

function activateNode(id) {
  svgEl?.querySelector(`#n-${id}`)?.classList.add('node--active');
}
function deactivateNode(id) {
  svgEl?.querySelector(`#n-${id}`)?.classList.remove('node--active');
}

async function sendPacketAlong(pathIds, opts) {
  // pathIds: e.g. ['client','routerA','routerB','server']
  for (let i = 0; i < pathIds.length - 1; i++) {
    if (!running) return false;
    const p = pathBetween(pathIds[i], pathIds[i + 1]);
    if (!p) continue;
    activateNode(pathIds[i]);
    p.classList.add('edge--active');

    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, p, { ...opts, onComplete: resolve });
      cancelFns.push(cancel);
    });

    p.classList.remove('edge--active');
    deactivateNode(pathIds[i]);
  }
  activateNode(pathIds[pathIds.length - 1]);
  await delay(150);
  deactivateNode(pathIds[pathIds.length - 1]);
  return true;
}

// ── Main send handler ─────────────────────────────────────
async function onSend() {
  if (running) return;

  const msgEl      = document.querySelector('#l4-msg-input');
  const lossToggle = document.querySelector('#l4-loss-toggle');
  const msg        = msgEl?.value?.trim() || 'Hello';
  const packetLoss = lossToggle?.checked || false;

  running   = true;
  cancelFns = [];

  // Reset reassembly UI
  for (let i = 1; i <= 4; i++) {
    const slot = document.querySelector(`#l4-slot-${i}`);
    const content = document.querySelector(`#l4-slot-content-${i}`);
    if (slot) { slot.className = 'reassembly-slot'; }
    if (content) { content.textContent = ''; }
  }
  document.querySelector('#l4-reassembled').textContent = '—';

  // ── TCP Three-Way Handshake ───────────────────────────
  setStatus('Handshake…');
  log('TCP Three-Way Handshake starting…', 'info');

  // SYN: client → server (via A→B)
  setCallout('Step 1/3 — SYN: "Client says: I want to connect. Here\'s my sequence number."', 'blue');
  log('[SYN] Client → Server (via A→B)', 'info');
  await sendPacketAlong(PATH_ALPHA, { label: 'SYN', color: 'blue', duration: 800 });
  activateNode('server');
  await delay(900);
  deactivateNode('server');

  // SYN-ACK: server → client (via B→A)
  setCallout('Step 2/3 — SYN-ACK: "Server says: Got it. I\'m ready. Here\'s my sequence number."', 'green');
  log('[SYN-ACK] Server → Client (via B→A)', 'success');
  await sendPacketAlong([...PATH_ALPHA].reverse(), { label: 'SYN-ACK', color: 'green', duration: 800 });
  activateNode('client');
  await delay(900);
  deactivateNode('client');

  // ACK: client → server
  setCallout('Step 3/3 — ACK: "Client says: Confirmed. Connection established."', 'green');
  log('[ACK] Client → Server (via A→B)', 'success');
  await sendPacketAlong(PATH_ALPHA, { label: 'ACK', color: 'green', duration: 800 });
  await delay(400);

  setCallout('');
  showBanner(svgEl.parentElement, 'Connection established — beginning data transfer', 2200);
  log('Connection established. Beginning data transfer.', 'success');
  await delay(1800);

  // ── Data Transfer ────────────────────────────────────
  setStatus('Sending packets…');

  // Split message into 4 parts
  const parts        = splitMsg(msg, 4);
  const paths        = [PATH_ALPHA, PATH_BETA, PATH_ALPHA, PATH_BETA];
  const arrivedSlots = {};

  for (let i = 0; i < 4; i++) {
    if (!running) break;
    const pktNum  = i + 1;
    const content = parts[i] || '';
    const path    = paths[i];
    const color   = path === PATH_ALPHA ? 'blue' : 'green';

    log(`[PKT ${pktNum}/4] Sending via ${path[1] === 'routerA' && path[2] === 'routerB' ? 'α' : 'β'}: "${content}"`, 'info');

    // Simulate packet loss at 20%
    if (packetLoss && Math.random() < 0.20) {
      // Animate to midpoint then drop
      const firstEdge = pathBetween(path[0], path[1]);
      if (firstEdge) {
        let dropped = false;
        await new Promise(resolve => {
          const { cancel } = animatePacket(svgEl, firstEdge, {
            label:      `PKT ${pktNum}`,
            color,
            duration:   700,
            onMidpoint: ({ x, y, cancel: c }) => {
              if (!dropped) {
                dropped = true;
                c();
                showDrop(svgEl, x, y);
                resolve();
              }
            },
            onComplete: resolve,
          });
          cancelFns.push(cancel);
        });
      }

      log(`[PKT ${pktNum}/4] LOST — sending retransmission request…`, 'error');
      setStatus(`Packet ${pktNum} lost — retransmitting…`, 'error');

      // Retransmit: dashed red path back to sender
      const retransPath = pathBetween(path[1], path[0]);
      if (retransPath) {
        retransPath.classList.add('edge--retrans');
        await new Promise(resolve => {
          const { cancel } = animatePacket(svgEl, retransPath, {
            label: 'NACK', color: 'red', duration: 600, onComplete: resolve,
          });
          cancelFns.push(cancel);
        });
        retransPath.classList.remove('edge--retrans');
      }

      log(`[PKT ${pktNum}/4] Retransmitting…`, 'warn');
    }

    // Send packet (fresh or retransmit)
    const slotDelay = i * 180; // stagger so β packets arrive after α
    setTimeout(async () => {
      await sendPacketAlong(path, {
        label:    `${pktNum}/4`,
        color,
        duration: path === PATH_BETA ? 850 : 700,
      });

      const arriveIdx = pktNum;
      arrivedSlots[arriveIdx] = content;

      const slot    = document.querySelector(`#l4-slot-${arriveIdx}`);
      const slotCon = document.querySelector(`#l4-slot-content-${arriveIdx}`);
      if (slot && slotCon) {
        slot.className   = 'reassembly-slot filled';
        slotCon.textContent = content;
      }

      log(`[PKT ${pktNum}/4] Arrived at server (slot ${arriveIdx}): "${content}"`, 'success');

      // Check if all 4 arrived
      if (Object.keys(arrivedSlots).length === 4) {
        await delay(500);
        const reassembled = [1,2,3,4].map(k => arrivedSlots[k]).join('');
        document.querySelector('#l4-reassembled').textContent = reassembled;
        log(`All packets arrived. Reassembled: "${reassembled}"`, 'success');
        setStatus('Complete!', 'success');

        // Unlock challenge submission if packet loss was used
        if (packetLoss && !completed) {
          document.querySelector('#l4-answer')?.removeAttribute('disabled');
          log('Packet loss demo complete. Answer the challenge question below.', 'info');
        }
      }
    }, slotDelay);

    await delay(slotDelay + 300);
  }

  running   = false;
  cancelFns = [];
}

function splitMsg(msg, n) {
  const len   = Math.ceil(msg.length / n);
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(msg.slice(i * len, (i + 1) * len));
  }
  return parts;
}

function onSubmitChallenge() {
  const answer   = document.querySelector('#l4-answer')?.value?.trim() || '';
  const feedback = document.querySelector('#l4-feedback');

  if (answer.length < 20) {
    feedback.className = 'challenge-feedback challenge-feedback--err';
    feedback.textContent = `✗ Too short (${answer.length}/20 min).`;
    return;
  }

  feedback.className = 'challenge-feedback challenge-feedback--ok';
  feedback.textContent = '✓ Submitted!';
  log('Challenge answer submitted.', 'success');

  if (!completed) {
    completed = true;
    markComplete(document.getElementById('level-canvas'));
    completeLevel(4);
    showBanner(document.getElementById('level-canvas'), 'Challenge complete!', 2500);
    const { userId, name } = getIdentity();
    if (name) saveResponse(userId, name, 4, answer);
  }
}

function markComplete(container) {
  const el = container.querySelector('#l4-complete');
  if (!el || el.querySelector('.complete-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 4 COMPLETE — Level 5 unlocked</span>
  `;
  el.appendChild(banner);
}

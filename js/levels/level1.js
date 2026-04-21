// Level 1 — Binary Wire
// Learning goal: bits as the lowest-level representation of data.

import { log }                              from '../utils/terminal.js';
import { animatePacket, glowWire, showBanner, delay } from '../utils/animation.js';
import { stringToBits, bitsToString }       from '../utils/encoding.js';
import { setConceptLevel }                  from '../components/concept-panel.js';
import { completeLevel }                    from '../app.js';
import { getIdentity }                      from '../utils/identity.js';
import { saveResponse }                     from '../firebase/responses.js';

// ── SVG layout constants ─────────────────────────────────
const SVG_W = 700, SVG_H = 220;
const SENDER_X = 80,  NODE_Y = 110;
const RECV_X   = 620, WIRE_Y = NODE_Y;

// ── Module state ─────────────────────────────────────────
let svgEl      = null;
let wirePath   = null;
let running    = false;
let cancelFns  = [];    // active packet cancel functions
let completed  = false;

// Speed slider value → ms per bit
const SPEED_MAP = { 1: 1400, 2: 700, 3: 300 };

// ── Mount / Unmount ──────────────────────────────────────
export function mount(container) {
  setConceptLevel(1);
  container.innerHTML = buildHTML();

  svgEl    = container.querySelector('#l1-svg');
  wirePath = container.querySelector('#l1-wire');

  container.querySelector('#l1-send-btn').addEventListener('click', onSend);
  container.querySelector('#l1-msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onSend();
  });

  // Check prior completion
  try {
    const p = JSON.parse(localStorage.getItem('netsim_progress') || '{}');
    if (p.completed?.includes(1)) markComplete(container);
  } catch (_) { /* ignore */ }

  log('Level 1 loaded — Binary Wire', 'muted');
  log('Type a message and click SEND to begin transmission.', 'info');
}

export function unmount() {
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl     = null;
  wirePath  = null;
}

// ── HTML template ────────────────────────────────────────
function buildHTML() {
  return `
    <div class="level-controls">
      <span class="level-title">L1 — BINARY WIRE</span>
      <div class="speed-control">
        <span class="speed-label">SPEED</span>
        <input id="l1-speed" type="range" min="1" max="3" value="2" step="1" />
        <span class="speed-label" id="l1-speed-label">MED</span>
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem">
      <input id="l1-msg-input" class="field-input" type="text"
        placeholder="Type a message (try: HI)" maxlength="12"
        style="max-width:220px" autocomplete="off" />
      <button id="l1-send-btn" class="btn btn--primary">SEND</button>
    </div>

    <!-- SVG topology -->
    <div style="position:relative">
      <svg id="l1-svg" class="sim-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
           style="height:${SVG_H}px;max-width:100%">

        <!-- Wire -->
        <path id="l1-wire"
              d="M ${SENDER_X + 34} ${WIRE_Y} L ${RECV_X - 34} ${WIRE_Y}"
              class="edge edge--inactive" stroke-width="3" />

        <!-- Sender node -->
        <g class="node-group" id="l1-sender">
          <circle class="node-circle" cx="${SENDER_X}" cy="${NODE_Y}" />
          <circle class="node-pulse-ring" cx="${SENDER_X}" cy="${NODE_Y}" r="30" />
          <text class="node-label" x="${SENDER_X}" y="${NODE_Y - 4}">SEND</text>
          <text class="node-sublabel" x="${SENDER_X}" y="${NODE_Y + 11}">NODE</text>
        </g>

        <!-- Receiver node -->
        <g class="node-group" id="l1-receiver">
          <circle class="node-circle" cx="${RECV_X}" cy="${NODE_Y}" />
          <text class="node-label" x="${RECV_X}" y="${NODE_Y - 4}">RECV</text>
          <text class="node-sublabel" x="${RECV_X}" y="${NODE_Y + 11}">NODE</text>
        </g>

        <!-- Packets render here -->
      </svg>
    </div>

    <!-- Live bit stream display -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.75rem">
      <div>
        <div class="settings-label" style="margin-bottom:0.3rem;font-size:0.65rem;letter-spacing:0.1em">TRANSMITTING</div>
        <div id="l1-bits-out" class="bit-stream">—</div>
      </div>
      <div>
        <div class="settings-label" style="margin-bottom:0.3rem;font-size:0.65rem;letter-spacing:0.1em">RECEIVED</div>
        <div id="l1-bits-in" class="bit-stream">—</div>
        <div id="l1-decoded" class="receiver-display" style="margin-top:0.4rem">—</div>
      </div>
    </div>

    <!-- Challenge -->
    <div id="l1-challenge" class="challenge-box" style="margin-top:1rem">
      <div class="challenge-prompt">
        <strong style="color:var(--blue);font-family:var(--font-mono);font-size:0.7rem">CHALLENGE</strong><br/>
        Send the word <span style="color:var(--green);font-family:var(--font-mono)">"HI"</span> and
        wait for the receiver to display it correctly. The Mark Complete button will appear.
      </div>
    </div>
  `;
}

// ── Speed slider ─────────────────────────────────────────
function getSpeed(container) {
  const slider = document.querySelector('#l1-speed');
  const val    = Number(slider?.value || 2);
  const labels = { 1: 'SLOW', 2: 'MED', 3: 'FAST' };
  if (container) {
    document.querySelector('#l1-speed-label').textContent = labels[val];
  }
  return SPEED_MAP[val];
}

// ── Send handler ─────────────────────────────────────────
async function onSend() {
  if (running) return;
  const input = document.querySelector('#l1-msg-input');
  const msg   = input?.value?.trim();
  if (!msg) return;

  running = true;
  cancelFns = [];

  const container   = document.getElementById('level-canvas');
  const bitsOutEl   = document.querySelector('#l1-bits-out');
  const bitsInEl    = document.querySelector('#l1-bits-in');
  const decodedEl   = document.querySelector('#l1-decoded');
  const senderNode  = document.querySelector('#l1-sender');
  const recvNode    = document.querySelector('#l1-receiver');

  bitsOutEl.innerHTML = '';
  bitsInEl.innerHTML  = '';
  decodedEl.textContent = '—';
  senderNode.classList.add('node--active');

  const bits    = stringToBits(msg);
  const msBit   = getSpeed(container);
  const received = [];

  log(`Sending "${msg}" (${msg.length} chars = ${bits.length} bits)`, 'info');

  // Render pending bits
  bitsOutEl.innerHTML = bits.map(b =>
    `<span class="bit-pending">${b}</span>`
  ).join('');
  const pendingSpans = bitsOutEl.querySelectorAll('.bit-pending');

  for (let i = 0; i < bits.length; i++) {
    if (!running) break;
    const bit = bits[i];

    // Highlight current bit in TX panel
    if (pendingSpans[i]) {
      pendingSpans[i].className = bit === '1' ? 'bit-1' : 'bit-0';
    }

    // Wire glow on '1'
    if (bit === '1' && wirePath) {
      glowWire(wirePath, 'green', msBit * 0.7);
      wirePath.classList.add('edge--active');
    } else if (wirePath) {
      wirePath.classList.remove('edge--active');
    }

    log(`Bit ${i + 1}/${bits.length}: ${bit}`, bit === '1' ? 'success' : 'muted');

    // Animate packet
    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, wirePath, {
        label:      bit,
        color:      bit === '1' ? 'green' : 'blue',
        duration:   msBit * 0.9,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    // Receiver gets the bit
    received.push(bit);
    const span = document.createElement('span');
    span.className = bit === '1' ? 'bit-1' : 'bit-0';
    span.textContent = bit;
    bitsInEl.appendChild(span);

    // Insert byte-boundary space
    if ((i + 1) % 8 === 0) {
      bitsInEl.appendChild(document.createTextNode(' '));
    }

    // Decode completed bytes
    if ((i + 1) % 8 === 0) {
      const decoded = bitsToString(received);
      decodedEl.textContent = decoded;
      recvNode.classList.add('node--active');
      log(`Decoded so far: "${decoded}"`, 'success');
    }
  }

  if (!running) return;

  // Final decode
  const finalDecoded = bitsToString(received);
  decodedEl.textContent = finalDecoded;

  wirePath.classList.remove('edge--active');
  senderNode.classList.remove('node--active');
  setTimeout(() => recvNode.classList.remove('node--active'), 800);

  log(`Transmission complete. Received: "${finalDecoded}"`, 'success');

  // Check challenge: sent "HI" and decoded correctly
  if (msg.toUpperCase() === 'HI' && finalDecoded === 'HI' && !completed) {
    completed = true;
    showBanner(document.querySelector('#l1-svg').parentElement, 'Challenge complete!', 2500);
    markComplete(document.getElementById('level-canvas'));
    completeLevel(1);
    log('Challenge complete! Level 1 unlocked Level 2.', 'success');
    const { userId, name } = getIdentity();
    if (name) saveResponse(userId, name, 1, 'Demonstrated binary transmission of "HI"');
  }

  running = false;
  cancelFns = [];
}

// ── Mark complete UI ─────────────────────────────────────
function markComplete(container) {
  const challengeBox = container.querySelector('#l1-challenge');
  if (!challengeBox) return;
  if (challengeBox.querySelector('.complete-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 1 COMPLETE — Level 2 unlocked</span>
  `;
  challengeBox.appendChild(banner);
}

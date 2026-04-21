// Level 3 — ASCII & Protocols
// Learning goal: protocols as agreed-upon rules; ASCII as an example.

import { log }                              from '../utils/terminal.js';
import { animatePacket, showBanner, delay } from '../utils/animation.js';
import { charTo7BitASCII, chunkBinary }     from '../utils/encoding.js';
import { setConceptLevel }                  from '../components/concept-panel.js';
import { createASCIITableWidget }           from '../components/ascii-table.js';
import { completeLevel }                    from '../app.js';
import { getIdentity }                      from '../utils/identity.js';
import { saveResponse }                     from '../firebase/responses.js';

// ── Layout ───────────────────────────────────────────────
const SVG_W = 700, SVG_H = 200;
const SENDER_X = 60, ROUTER_X = 350, RECV_X = 640, NODE_Y = 100;

let svgEl    = null;
let path1    = null; // sender→router
let path2    = null; // router→receiver
let running  = false;
let cancelFns= [];
let asciiWidget = null;
let completed   = false;

export function mount(container) {
  setConceptLevel(3);
  container.innerHTML = buildHTML();

  svgEl = container.querySelector('#l3-svg');
  path1 = container.querySelector('#l3-path1');
  path2 = container.querySelector('#l3-path2');

  container.querySelector('#l3-send-btn').addEventListener('click', onSend);
  container.querySelector('#l3-msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onSend();
  });

  container.querySelector('#l3-submit-btn').addEventListener('click', onSubmitChallenge);

  const tableArea = container.querySelector('#l3-table-area');
  asciiWidget = createASCIITableWidget(tableArea, 'Show ASCII Table');

  try {
    const p = JSON.parse(localStorage.getItem('netsim_progress') || '{}');
    if (p.completed?.includes(3)) markComplete(container);
  } catch (_) { /* ignore */ }

  log('Level 3 loaded — ASCII & Protocols', 'muted');
  log('Select a chunk size and send a message to see how protocols define boundaries.', 'info');
}

export function unmount() {
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl = path1 = path2 = null;
  asciiWidget?.remove();
  asciiWidget = null;
}

function buildHTML() {
  const chunks = [
    { value: 4,  label: '4 bits (truncates)' },
    { value: 7,  label: '7 bits (full ASCII)' },
    { value: 8,  label: '8 bits (standard)' },
  ];
  const chunkOpts = chunks.map(c =>
    `<option value="${c.value}"${c.value === 7 ? ' selected' : ''}>${c.label}</option>`
  ).join('');

  return `
    <div class="level-controls">
      <span class="level-title">L3 — ASCII &amp; PROTOCOLS</span>
      <label class="settings-label" style="display:flex;align-items:center;gap:0.5rem">
        <span style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;color:var(--text-muted)">CHUNK SIZE</span>
        <select id="l3-chunk" class="field-input" style="width:auto;padding:0.3rem 0.5rem">
          ${chunkOpts}
        </select>
      </label>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem">
      <input id="l3-msg-input" class="field-input" type="text"
        placeholder="Type a message" maxlength="10"
        style="max-width:200px" autocomplete="off" />
      <button id="l3-send-btn" class="btn btn--primary">SEND</button>
    </div>

    <!-- SVG — 3 nodes -->
    <svg id="l3-svg" class="sim-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
         style="height:${SVG_H}px;max-width:100%">
      <path id="l3-path1"
            d="M ${SENDER_X + 34} ${NODE_Y} L ${ROUTER_X - 22} ${NODE_Y}"
            class="edge edge--inactive" stroke-width="2.5" />
      <path id="l3-path2"
            d="M ${ROUTER_X + 22} ${NODE_Y} L ${RECV_X - 34} ${NODE_Y}"
            class="edge edge--inactive" stroke-width="2.5" />

      <!-- Sender -->
      <g class="node-group" id="l3-sender">
        <circle class="node-circle" cx="${SENDER_X}" cy="${NODE_Y}" />
        <circle class="node-pulse-ring" cx="${SENDER_X}" cy="${NODE_Y}" r="30" />
        <text class="node-label" x="${SENDER_X}" y="${NODE_Y - 4}">SEND</text>
        <text class="node-sublabel" x="${SENDER_X}" y="${NODE_Y + 11}">NODE</text>
      </g>

      <!-- Router (hexagon) -->
      <g class="node-group" id="l3-router" transform="translate(${ROUTER_X},${NODE_Y})">
        <polygon class="node-hex"
          points="0,-26 22.5,-13 22.5,13 0,26 -22.5,13 -22.5,-13" />
        <text class="node-label" x="0" y="-3">ROUTER</text>
        <text class="node-sublabel" x="0" y="11">A</text>
      </g>

      <!-- Receiver -->
      <g class="node-group" id="l3-receiver">
        <circle class="node-circle" cx="${RECV_X}" cy="${NODE_Y}" />
        <text class="node-label" x="${RECV_X}" y="${NODE_Y - 4}">RECV</text>
        <text class="node-sublabel" x="${RECV_X}" y="${NODE_Y + 11}">NODE</text>
      </g>
    </svg>

    <!-- Bit stream display with chunk markers -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.75rem">
      <div>
        <div class="settings-label" style="margin-bottom:0.3rem;font-size:0.65rem;letter-spacing:0.1em">
          BIT STREAM (chunk boundaries marked with |)
        </div>
        <div id="l3-stream" class="bit-stream" style="word-break:break-all">—</div>
      </div>
      <div>
        <div class="settings-label" style="margin-bottom:0.3rem;font-size:0.65rem;letter-spacing:0.1em">
          RECEIVED
        </div>
        <div id="l3-received" class="receiver-display">—</div>
        <div id="l3-overflow-warn" class="callout callout--red" style="margin-top:0.5rem;display:none"></div>
      </div>
    </div>

    <div id="l3-table-area"></div>

    <!-- Challenge -->
    <div class="challenge-box" style="margin-top:1rem">
      <div class="challenge-prompt">
        <strong style="color:var(--blue);font-family:var(--font-mono);font-size:0.7rem">CHALLENGE</strong><br/>
        Why must the sender and receiver agree on chunk size before communicating?
        (Minimum 20 characters)
      </div>
      <textarea id="l3-answer" class="challenge-textarea"
        placeholder="Your answer here…" maxlength="500"></textarea>
      <div class="challenge-actions">
        <button id="l3-submit-btn" class="btn btn--secondary">SUBMIT</button>
        <span id="l3-feedback" class="challenge-feedback"></span>
      </div>
    </div>
    <div id="l3-complete"></div>
  `;
}

async function onSend() {
  if (running) return;
  const input     = document.querySelector('#l3-msg-input');
  const chunkSel  = document.querySelector('#l3-chunk');
  const msg       = input?.value?.trim();
  if (!msg) return;

  const chunkSize  = Number(chunkSel?.value || 7);
  running          = true;
  cancelFns        = [];

  const streamEl   = document.querySelector('#l3-stream');
  const receivedEl = document.querySelector('#l3-received');
  const warnEl     = document.querySelector('#l3-overflow-warn');
  const routerNode = document.querySelector('#l3-router');
  const senderNode = document.querySelector('#l3-sender');
  const recvNode   = document.querySelector('#l3-receiver');

  streamEl.innerHTML   = '';
  receivedEl.textContent = '—';
  warnEl.style.display = 'none';

  // Build the bit stream from 7-bit ASCII
  const fullBits  = Array.from(msg).map(charTo7BitASCII).join('');
  const { chunks, truncated } = chunkBinary(fullBits, chunkSize);

  // Display bit stream with chunk markers
  let streamHTML = '';
  let globalBitIdx = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    for (let bi = 0; bi < chunk.length; bi++) {
      const bit = chunk[bi];
      // Mark truncated bits
      const isOk = chunkSize === 7 || (chunkSize === 8 && bi < 7) || chunkSize < 7;
      streamHTML += `<span class="${bit === '1' ? 'bit-1' : 'bit-0'}">${bit}</span>`;
      globalBitIdx++;
    }
    if (ci < chunks.length - 1) {
      streamHTML += `<span style="color:var(--amber);font-weight:bold"> | </span>`;
    }
  }
  streamEl.innerHTML = streamHTML;

  // Overflow warning
  if (chunkSize === 4) {
    warnEl.style.display = '';
    warnEl.textContent = `⚠ Chunk size 4 < 7 bits per ASCII char: high bits truncated. Characters may be corrupted or unrecognizable.`;
    log('Warning: chunk size 4 truncates 7-bit ASCII — data corruption will occur!', 'warn');
  }

  senderNode.classList.add('node--active');
  path1.classList.add('edge--active');
  log(`Sending "${msg}" — chunk size: ${chunkSize} bits`, 'info');

  let received = '';

  for (let ci = 0; ci < chunks.length; ci++) {
    if (!running) break;
    const chunk = chunks[ci];
    const isOverflow = chunk.length < chunkSize;

    const color = isOverflow ? 'red' : (chunkSize === 4 ? 'red' : 'blue');
    const label = chunk.length > 4 ? chunk.slice(0, 4) + '…' : chunk;

    log(`Chunk ${ci + 1}: "${chunk}" → Router`, color === 'red' ? 'warn' : 'info');

    // Sender → Router
    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, path1, {
        label, color,
        duration:   700,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    routerNode.classList.add('node--active');
    await delay(120);
    routerNode.classList.remove('node--active');

    // Router → Receiver
    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, path2, {
        label, color,
        duration:   700,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    recvNode.classList.add('node--active');

    // Decode chunk: pad to 7, then decode character
    if (chunkSize >= 7) {
      const padded = chunk.padEnd(7, '0');
      const code   = parseInt(padded.slice(0, 7), 2);
      if (code >= 32 && code <= 126) {
        received += String.fromCharCode(code);
      } else {
        received += '?';
      }
    } else {
      // 4-bit chunk: decode whatever we got (likely garbled)
      const code = parseInt(chunk.padEnd(7, '0'), 2);
      received += code >= 32 && code <= 126 ? String.fromCharCode(code) : '?';
    }

    receivedEl.textContent = received;
    log(`Received chunk ${ci + 1}: "${received.slice(-1)}"`, 'success');

    await delay(100);
    recvNode.classList.remove('node--active');
  }

  path1.classList.remove('edge--active');
  path2.classList.remove('edge--active');
  senderNode.classList.remove('node--active');
  log(`Transmission complete: "${received}"`, 'success');

  running   = false;
  cancelFns = [];
}

function onSubmitChallenge() {
  const answer   = document.querySelector('#l3-answer')?.value?.trim() || '';
  const feedback = document.querySelector('#l3-feedback');

  if (answer.length < 20) {
    feedback.className = 'challenge-feedback challenge-feedback--err';
    feedback.textContent = `✗ Answer too short (${answer.length}/20 chars minimum).`;
    return;
  }

  feedback.className = 'challenge-feedback challenge-feedback--ok';
  feedback.textContent = '✓ Submitted!';
  log('Challenge answer submitted.', 'success');

  if (!completed) {
    completed = true;
    const container = document.getElementById('level-canvas');
    markComplete(container);
    completeLevel(3);
    showBanner(container, 'Challenge complete!', 2500);
    const { userId, name } = getIdentity();
    if (name) saveResponse(userId, name, 3, answer);
  }
}

function markComplete(container) {
  const el = container.querySelector('#l3-complete');
  if (!el || el.querySelector('.complete-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 3 COMPLETE — Level 4 unlocked</span>
  `;
  el.appendChild(banner);
}

// Level 2 — Hex Encoding
// Learning goal: hex as a human-readable encoding of binary.

import { log }                             from '../utils/terminal.js';
import { animatePacket, showBanner, delay } from '../utils/animation.js';
import { stringToHex, charTable, hexToString } from '../utils/encoding.js';
import { setConceptLevel }                 from '../components/concept-panel.js';
import { createASCIITableWidget }          from '../components/ascii-table.js';
import { completeLevel }                   from '../app.js';
import { getIdentity }                     from '../utils/identity.js';
import { saveResponse }                    from '../firebase/responses.js';

const SVG_W = 700, SVG_H = 180;
const SENDER_X = 80, NODE_Y = 90;
const RECV_X   = 620;

let svgEl    = null;
let wirePath = null;
let running  = false;
let cancelFns= [];
let asciiWidget = null;
let completed   = false;

export function mount(container) {
  setConceptLevel(2);
  container.innerHTML = buildHTML();

  svgEl    = container.querySelector('#l2-svg');
  wirePath = container.querySelector('#l2-wire');

  container.querySelector('#l2-send-btn').addEventListener('click', onSend);
  container.querySelector('#l2-msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onSend();
  });

  // Challenge: decode "48 65 6C 6C 6F"
  container.querySelector('#l2-decode-btn').addEventListener('click', onCheckAnswer);
  container.querySelector('#l2-answer-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onCheckAnswer();
  });

  // ASCII table widget
  const tableArea = container.querySelector('#l2-table-area');
  asciiWidget = createASCIITableWidget(tableArea, 'Show ASCII/Hex Table');

  // Prior completion
  try {
    const p = JSON.parse(localStorage.getItem('netsim_progress') || '{}');
    if (p.completed?.includes(2)) markComplete(container);
  } catch (_) { /* ignore */ }

  log('Level 2 loaded — Hex Encoding', 'muted');
  log('Packets now travel labeled with hexadecimal values.', 'info');
}

export function unmount() {
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl = wirePath = null;
  asciiWidget?.remove();
  asciiWidget = null;
}

function buildHTML() {
  return `
    <div class="level-controls">
      <span class="level-title">L2 — HEX ENCODING</span>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem">
      <input id="l2-msg-input" class="field-input" type="text"
        placeholder="Type a message" maxlength="8"
        style="max-width:200px" autocomplete="off" />
      <button id="l2-send-btn" class="btn btn--primary">SEND</button>
    </div>

    <!-- SVG topology -->
    <svg id="l2-svg" class="sim-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
         style="height:${SVG_H}px;max-width:100%">
      <path id="l2-wire"
            d="M ${SENDER_X + 34} ${NODE_Y} L ${RECV_X - 34} ${NODE_Y}"
            class="edge edge--inactive" stroke-width="3" />

      <g class="node-group" id="l2-sender">
        <circle class="node-circle" cx="${SENDER_X}" cy="${NODE_Y}" />
        <circle class="node-pulse-ring" cx="${SENDER_X}" cy="${NODE_Y}" r="30" />
        <text class="node-label" x="${SENDER_X}" y="${NODE_Y - 4}">SEND</text>
        <text class="node-sublabel" x="${SENDER_X}" y="${NODE_Y + 11}">NODE</text>
      </g>

      <g class="node-group" id="l2-receiver">
        <circle class="node-circle" cx="${RECV_X}" cy="${NODE_Y}" />
        <text class="node-label" x="${RECV_X}" y="${NODE_Y - 4}">RECV</text>
        <text class="node-sublabel" x="${RECV_X}" y="${NODE_Y + 11}">NODE</text>
      </g>
    </svg>

    <!-- Conversion table -->
    <div id="l2-conv-table" style="margin-top:0.75rem"></div>

    <!-- ASCII table widget -->
    <div id="l2-table-area"></div>

    <!-- Challenge -->
    <div class="challenge-box" style="margin-top:1rem">
      <div class="challenge-prompt">
        <strong style="color:var(--blue);font-family:var(--font-mono);font-size:0.7rem">CHALLENGE</strong><br/>
        Decode the message: <span style="color:var(--green);font-family:var(--font-mono)">48 65 6C 6C 6F</span>
        — type the decoded text below.
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center;margin-top:0.5rem">
        <input id="l2-answer-input" class="field-input" type="text"
          placeholder="Decoded message…" maxlength="12" style="max-width:180px" autocomplete="off" />
        <button id="l2-decode-btn" class="btn btn--secondary">CHECK</button>
        <span id="l2-feedback" class="challenge-feedback"></span>
      </div>
    </div>

    <div id="l2-complete"></div>
  `;
}

async function onSend() {
  if (running) return;
  const input = document.querySelector('#l2-msg-input');
  const msg   = input?.value?.trim();
  if (!msg) return;

  running   = true;
  cancelFns = [];

  const hexArr    = stringToHex(msg);
  const tableEl   = document.querySelector('#l2-conv-table');
  const senderNode= document.querySelector('#l2-sender');
  const recvNode  = document.querySelector('#l2-receiver');
  const decodedParts = [];

  // Build conversion table
  tableEl.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'conv-table';
  table.innerHTML = `<thead><tr><th>Char</th><th>Binary</th><th>Hex</th></tr></thead>`;
  const tbody = document.createElement('tbody');

  for (const char of msg) {
    const row = charTable(char);
    const tr  = document.createElement('tr');
    tr.id = `l2-row-${row.decimal}`;
    tr.innerHTML = `
      <td class="conv-char">${row.char}</td>
      <td class="conv-bin">${row.binary}</td>
      <td class="conv-hex">0x${row.hex}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tableEl.appendChild(table);

  senderNode.classList.add('node--active');
  log(`Sending "${msg}" as hex: ${hexArr.map(h => '0x' + h).join(' ')}`, 'info');

  wirePath.classList.add('edge--active');

  for (let i = 0; i < hexArr.length; i++) {
    if (!running) break;
    const hex  = hexArr[i];
    const char = msg[i];

    // Highlight current row
    document.querySelector(`#l2-row-${char.charCodeAt(0)}`)
      ?.style.setProperty('background', '#00b4ff18');

    log(`Packet ${i + 1}/${hexArr.length}: '${char}' → 0x${hex}`, 'info');

    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, wirePath, {
        label:      '0x' + hex,
        color:      'blue',
        duration:   900,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    decodedParts.push(char);
    recvNode.classList.add('node--active');
    log(`Received 0x${hex} → '${char}'`, 'success');

    await delay(120);
    recvNode.classList.remove('node--active');
  }

  wirePath.classList.remove('edge--active');
  senderNode.classList.remove('node--active');
  log(`Transmission complete: "${decodedParts.join('')}"`, 'success');

  running   = false;
  cancelFns = [];
}

function onCheckAnswer() {
  const input    = document.querySelector('#l2-answer-input');
  const feedback = document.querySelector('#l2-feedback');
  const answer   = input?.value?.trim();

  if (answer?.toLowerCase() === 'hello') {
    feedback.className = 'challenge-feedback challenge-feedback--ok';
    feedback.textContent = '✓ Correct!';
    log('Challenge answer correct: Hello', 'success');

    if (!completed) {
      completed = true;
      markComplete(document.getElementById('level-canvas'));
      completeLevel(2);
      const { userId, name } = getIdentity();
      if (name) saveResponse(userId, name, 2, 'Decoded hex "48 65 6C 6C 6F" → Hello');
      showBanner(document.querySelector('#l2-svg')?.parentElement ||
                 document.getElementById('level-canvas'), 'Challenge complete!', 2500);
    }
  } else {
    feedback.className = 'challenge-feedback challenge-feedback--err';
    feedback.textContent = '✗ Try again — use the hex table above.';
    log(`Incorrect answer: "${answer}"`, 'error');
  }
}

function markComplete(container) {
  const el = container.querySelector('#l2-complete');
  if (!el || el.querySelector('.complete-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 2 COMPLETE — Level 3 unlocked</span>
  `;
  el.appendChild(banner);
}

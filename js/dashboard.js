// Teacher dashboard — reads all student responses from Firebase in real time.

import { getDB, getFirebaseDB } from './firebase/db.js';
import { dashboardPassword }    from '../config.js';

const LEVEL_QUESTIONS = {
  1: 'Why does the receiver need to know where one character ends and the next begins?',
  2: 'Hex challenge: decoded "48 65 6C 6C 6F"',
  3: 'Why must the sender and receiver agree on chunk size before communicating?',
  4: 'What would happen if TCP did not request retransmission of lost packets?',
  5: 'What would happen if DNS root servers went offline? How does caching improve performance?',
};

let currentTab  = 'all';
let allResponses = {};

async function init() {
  const [db, { ref, onValue }] = await Promise.all([
    getDB(),
    getFirebaseDB(),
  ]);

  // Real-time listener
  onValue(ref(db, 'responses'), snap => {
    allResponses = snap.val() || {};
    render();
  });

  // Tab buttons
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  document.getElementById('dash-print').addEventListener('click', () => window.print());

  document.getElementById('dash-refresh').addEventListener('click', () => {
    document.getElementById('dash-status').textContent = 'Refreshing…';
    setTimeout(() => document.getElementById('dash-status').textContent = '', 800);
  });
}

function render() {
  const tbody = document.getElementById('dash-tbody');
  const countEl = document.getElementById('dash-count');
  if (!tbody) return;

  const rows = [];

  for (const [userId, student] of Object.entries(allResponses)) {
    const name   = student.name || '(unnamed)';
    const levels = student.levels || {};

    const levelsToShow = currentTab === 'all'
      ? [1, 2, 3, 4, 5]
      : [Number(currentTab)];

    for (const lvl of levelsToShow) {
      const entry = levels[lvl];
      if (!entry) {
        if (currentTab !== 'all') {
          rows.push({ name, level: lvl, answer: '—', time: '—', submitted: false });
        }
        continue;
      }

      const time = entry.submittedAt
        ? new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';

      rows.push({ name, level: lvl, answer: entry.answer || '—', time, submitted: true });
    }
  }

  // Sort: by level then name
  rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  // Sync the Level column header visibility with tbody
  const levelHeader = document.querySelector('.col-level-header');
  if (levelHeader) levelHeader.hidden = (currentTab !== 'all');

  tbody.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = row.submitted ? '' : 'not-submitted';
    tr.innerHTML = `
      <td class="col-name">${esc(row.name)}</td>
      ${currentTab === 'all' ? `<td class="col-level">L${row.level}</td>` : ''}
      <td class="col-answer">${esc(row.answer)}</td>
      <td class="col-time">${row.time}</td>
    `;
    tbody.appendChild(tr);
  }

  const submittedCount = rows.filter(r => r.submitted).length;
  countEl.textContent  = `${submittedCount} response${submittedCount !== 1 ? 's' : ''}`;

  // Show the level question as a subheading when on a specific tab
  const questionEl = document.getElementById('dash-question');
  if (questionEl) {
    questionEl.textContent = currentTab !== 'all'
      ? LEVEL_QUESTIONS[Number(currentTab)] || ''
      : '';
    questionEl.hidden = currentTab === 'all';
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ');
}

function showPasswordGate() {
  const gate = document.createElement('div');
  gate.id = 'dash-gate';
  gate.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:var(--bg);
    display:flex;align-items:center;justify-content:center;
  `;
  gate.innerHTML = `
    <div style="
      background:#111827;border:1px solid var(--gray);border-radius:8px;
      padding:2rem 2.5rem;width:min(360px,90vw);
      font-family:var(--font-mono);display:flex;flex-direction:column;gap:1.25rem;
    ">
      <div style="color:var(--green);font-size:0.9rem;font-weight:700;letter-spacing:0.05em">
        NET/SIM — Teacher Dashboard
      </div>
      <div style="color:var(--muted);font-size:0.78rem">Enter the dashboard password to continue.</div>
      <input id="gate-input" type="password" placeholder="Password"
        style="background:#1a2035;border:1px solid var(--gray);border-radius:4px;
               padding:0.5rem 0.75rem;color:var(--text);font-family:var(--font-mono);
               font-size:0.82rem;width:100%;box-sizing:border-box" />
      <div id="gate-error" style="color:#ff4d6d;font-size:0.72rem;display:none">Incorrect password.</div>
      <button id="gate-btn" style="
        background:var(--green);color:#0a0e1a;border:none;border-radius:4px;
        padding:0.55rem 1.25rem;font-family:var(--font-mono);font-size:0.82rem;
        font-weight:700;cursor:pointer;align-self:flex-end;
      ">Enter</button>
    </div>
  `;
  document.body.appendChild(gate);

  const input = gate.querySelector('#gate-input');
  const btn   = gate.querySelector('#gate-btn');
  const err   = gate.querySelector('#gate-error');

  function attempt() {
    if (input.value === dashboardPassword) {
      gate.remove();
      init().catch(showInitError);
    } else {
      err.style.display = '';
      input.value = '';
      input.focus();
    }
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 50);
}

function showInitError(err) {
  document.getElementById('dash-error').textContent =
    err.message.includes('not configured')
      ? 'Firebase is not configured. Fill in config.js before using the dashboard.'
      : `Error: ${err.message}`;
  document.getElementById('dash-error').hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
  if (dashboardPassword) {
    showPasswordGate();
  } else {
    init().catch(showInitError);
  }
});

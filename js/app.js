import { initConceptPanel } from './components/concept-panel.js';
import { initGlossary }     from './components/glossary.js';
import { initTerminal, clear as clearTerminal } from './utils/terminal.js';

// ── Level module registry ────────────────────────────────
// Each level is imported on demand to avoid loading Firebase
// and heavy modules before they are needed.
const LEVEL_LOADERS = {
  1: () => import('./levels/level1.js'),
  2: () => import('./levels/level2.js'),
  3: () => import('./levels/level3.js'),
  4: () => import('./levels/level4.js'),
  5: () => import('./levels/level5.js'),
  6: () => import('./levels/level6.js'),
};

// ── Progress persistence ─────────────────────────────────
const PROGRESS_KEY = 'netsim_progress';

export function getProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { completed: [], unlocked: [1] };
}

function saveProgress(p) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

export function completeLevel(n) {
  const p = getProgress();
  if (!p.completed.includes(n)) p.completed.push(n);
  if (n < 6 && !p.unlocked.includes(n + 1)) p.unlocked.push(n + 1);
  saveProgress(p);
  updateNav();
  // Signal concept panel to show reflection
  document.dispatchEvent(new CustomEvent('netsim:level-complete', { detail: { level: n } }));
}

// ── Active level state ───────────────────────────────────
let activeLevel   = null;  // current level number
let activeModule  = null;  // imported module with mount/unmount

async function loadLevel(n) {
  const canvas = document.getElementById('level-canvas');

  // Unmount previous level
  if (activeModule?.unmount) {
    try { activeModule.unmount(); } catch (_) { /* ignore */ }
  }
  activeModule = null;
  canvas.innerHTML = '';
  clearTerminal();

  const loader = LEVEL_LOADERS[n];
  if (!loader) return;

  try {
    const mod = await loader();
    activeModule = mod;
    activeLevel  = n;
    updateNav();
    mod.mount(canvas);
  } catch (err) {
    canvas.innerHTML = `<p style="color:var(--red);font-family:var(--font-mono);padding:1rem">
      Failed to load level ${n}: ${err.message}
    </p>`;
    console.error('Level load error:', err);
  }
}

// ── Nav rendering ────────────────────────────────────────
function updateNav() {
  const p = getProgress();
  document.querySelectorAll('.level-btn').forEach(btn => {
    const n = Number(btn.dataset.level);
    btn.classList.remove('locked', 'unlocked', 'active', 'completed');

    if (n === activeLevel) {
      btn.classList.add('active');
      btn.disabled = false;
    } else if (p.completed.includes(n)) {
      btn.classList.add('unlocked', 'completed');
      btn.disabled = false;
    } else if (p.unlocked.includes(n)) {
      btn.classList.add('unlocked');
      btn.disabled = false;
    } else {
      btn.classList.add('locked');
      btn.disabled = true;
    }
  });
}

// ── Nav click ────────────────────────────────────────────
function onNavClick(e) {
  const btn = e.target.closest('.level-btn');
  if (!btn || btn.disabled) return;
  const n = Number(btn.dataset.level);
  if (n === activeLevel) return;
  loadLevel(n);
}

// ── Settings modal ───────────────────────────────────────
function initSettings() {
  const settingsBtn  = document.getElementById('settings-btn');
  const settingsMod  = document.getElementById('settings-modal');
  const resetBtn     = document.getElementById('reset-progress-btn');

  settingsBtn.addEventListener('click', () => openModal(settingsMod));
  settingsMod.querySelector('.modal-close').addEventListener('click', () => closeModal(settingsMod));
  settingsMod.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(settingsMod));

  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      localStorage.removeItem(PROGRESS_KEY);
      location.reload();
    }
  });
}

// ── Modal helpers ────────────────────────────────────────
export function openModal(el) {
  el.hidden = false;
  el.querySelector('button, input, [tabindex]')?.focus();
}

export function closeModal(el) {
  el.hidden = true;
}

// Close any modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not([hidden])').forEach(m => closeModal(m));
  }
});

// ── Init ─────────────────────────────────────────────────
function init() {
  initTerminal();
  initConceptPanel();
  initGlossary();
  initSettings();

  document.querySelector('.level-nav').addEventListener('click', onNavClick);

  updateNav();
  loadLevel(1);
}

document.addEventListener('DOMContentLoaded', init);

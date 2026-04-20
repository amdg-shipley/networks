// Terminal output panel — log(msg, type), clear(), copyLog()
// Types: 'success' | 'info' | 'warn' | 'error' | 'muted'

let outputEl        = null;
let listenersReady  = false;

export function initTerminal() {
  outputEl = document.getElementById('terminal-output');
  if (!outputEl) return;
  outputEl.innerHTML = '';

  if (!listenersReady) {
    document.getElementById('terminal-clear')?.addEventListener('click', clear);
    document.getElementById('terminal-copy')?.addEventListener('click', copyLog);
    listenersReady = true;
  }
}

function ts() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}

export function log(msg, type = 'info') {
  if (!outputEl) outputEl = document.getElementById('terminal-output');
  if (!outputEl) return;

  const line = document.createElement('div');
  line.className = `term-line term-line--${type}`;

  const tsSpan = document.createElement('span');
  tsSpan.className = 'term-ts';
  tsSpan.textContent = ts();

  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;

  line.appendChild(tsSpan);
  line.appendChild(msgSpan);
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

export function clear() {
  if (!outputEl) outputEl = document.getElementById('terminal-output');
  if (outputEl) outputEl.innerHTML = '';
}

export function copyLog() {
  if (!outputEl) return;
  const text = Array.from(outputEl.querySelectorAll('.term-line'))
    .map(l => `[${l.querySelector('.term-ts')?.textContent}] ${l.lastChild?.textContent}`)
    .join('\n');
  navigator.clipboard?.writeText(text).catch(() => {/* ignore */});
}

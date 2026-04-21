// Student identity — persisted in localStorage across all levels.
// Shared by L1–L5 (for answer collection) and L6 (for room presence).

const IDENTITY_KEY = 'netsim_identity';

/**
 * Get current identity, generating a new userId if none exists.
 * @returns {{ userId: string, name: string|null }}
 */
export function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.userId) return parsed;
    }
  } catch (_) { /* ignore */ }

  const identity = { userId: 'u_' + Math.random().toString(36).slice(2, 10), name: null };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

/**
 * Save a name to the current identity.
 * @param {string} name
 */
export function saveName(name) {
  const identity = getIdentity();
  identity.name = name.trim();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/**
 * Show a blocking modal on first load if no name is set.
 * Does nothing if a name is already stored.
 */
export function promptNameModal() {
  if (getIdentity().name) return;

  const overlay = document.createElement('div');
  overlay.id = 'name-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(10,14,26,0.85);
    display: flex; align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <div style="
      background: #111827;
      border: 1px solid var(--blue);
      border-radius: var(--radius);
      padding: 2rem 2.5rem;
      width: min(420px, 90vw);
      font-family: var(--font-mono);
      display: flex; flex-direction: column; gap: 1.25rem;
    ">
      <div style="color: var(--blue); font-size: 1rem; font-weight: 700; letter-spacing: 0.05em">
        WELCOME TO NET/SIM
      </div>
      <div style="color: var(--text-muted); font-size: 0.78rem; line-height: 1.5">
        Enter your name so your teacher can see your answers.
      </div>
      <input id="name-modal-input" type="text" maxlength="32"
        placeholder="First name + last initial"
        style="
          background: #1a2035; border: 1px solid var(--gray-muted);
          border-radius: 4px; padding: 0.5rem 0.75rem;
          color: var(--text); font-family: var(--font-mono);
          font-size: 0.82rem; width: 100%; box-sizing: border-box;
        " />
      <button id="name-modal-save" disabled style="
        background: var(--blue); color: #0a0e1a;
        border: none; border-radius: 4px;
        padding: 0.55rem 1.25rem;
        font-family: var(--font-mono); font-size: 0.82rem;
        font-weight: 700; cursor: pointer;
        opacity: 0.45; transition: opacity 0.15s;
        align-self: flex-end;
      ">Let's go →</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#name-modal-input');
  const saveBtn = overlay.querySelector('#name-modal-save');

  input.addEventListener('input', () => {
    const hasValue = input.value.trim().length > 0;
    saveBtn.disabled = !hasValue;
    saveBtn.style.opacity = hasValue ? '1' : '0.45';
    saveBtn.style.cursor  = hasValue ? 'pointer' : 'default';
  });

  function save() {
    const name = input.value.trim();
    if (!name) return;
    saveName(name);
    overlay.remove();
  }

  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

  // Focus after a tick so the browser doesn't scroll
  setTimeout(() => input.focus(), 50);
}

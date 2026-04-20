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
  identity.name  = name.trim();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/**
 * Render a non-blocking name prompt bar at the top of a container.
 * Calls onSave(name) when the student enters their name.
 * Automatically removes itself once saved.
 * Does nothing if name is already set.
 *
 * @param {HTMLElement} container  - prepended to this element
 * @param {Function}    onSave     - called with the saved name string
 */
export function renderNamePrompt(container, onSave) {
  if (getIdentity().name) return; // already have a name

  const bar = document.createElement('div');
  bar.id = 'name-prompt-bar';
  bar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: #0d1120;
    border: 1px solid var(--blue);
    border-radius: var(--radius);
    margin-bottom: 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  `;

  bar.innerHTML = `
    <span style="color:var(--blue);white-space:nowrap">👤 Your name:</span>
    <input id="name-prompt-input" type="text" maxlength="24" placeholder="First name + last initial"
      style="background:#1a2035;border:1px solid var(--gray-muted);border-radius:4px;
             padding:0.3rem 0.5rem;color:var(--text);font-family:var(--font-mono);
             font-size:0.75rem;flex:1;min-width:0;max-width:200px" />
    <button id="name-prompt-save" style="
      background:var(--blue);color:#0a0e1a;border:none;border-radius:4px;
      padding:0.3rem 0.75rem;font-family:var(--font-mono);font-size:0.72rem;
      font-weight:700;cursor:pointer;white-space:nowrap">Save</button>
    <span style="color:var(--text-muted);font-size:0.65rem">
      So your teacher can see your answers
    </span>
  `;

  container.prepend(bar);

  const input   = bar.querySelector('#name-prompt-input');
  const saveBtn = bar.querySelector('#name-prompt-save');

  function save() {
    const name = input.value.trim();
    if (!name) { input.style.borderColor = 'var(--red)'; return; }
    saveName(name);
    bar.remove();
    onSave(name);
  }

  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  input.focus();
}

// Level 5 — DNS Resolution
// Learning goal: DNS as a hierarchical naming system.

import { log }                                from '../utils/terminal.js';
import { animatePacket, showLabel, showBanner, delay } from '../utils/animation.js';
import { setConceptLevel }                    from '../components/concept-panel.js';
import { completeLevel }                      from '../app.js';
import { getIdentity }                        from '../utils/identity.js';
import { saveResponse }                       from '../firebase/responses.js';

// ── Node layout ───────────────────────────────────────────
// 6 nodes arranged in two rows
const SVG_W = 740, SVG_H = 300;

const NODES = {
  client:    { x: 80,  y: 80,  label: 'CLIENT',     sub: 'Browser',    shape: 'circle' },
  resolver:  { x: 260, y: 80,  label: 'DNS',        sub: 'Resolver',   shape: 'circle' },
  root:      { x: 460, y: 80,  label: 'ROOT',       sub: 'DNS',        shape: 'hex'    },
  tld:       { x: 460, y: 190, label: 'TLD',        sub: '.org',       shape: 'hex'    },
  auth:      { x: 260, y: 190, label: 'AUTH',       sub: 'DNS',        shape: 'hex'    },
  webserver: { x: 80,  y: 190, label: 'WEB',        sub: 'SERVER',     shape: 'rect'   },
};

// Simulated hop latencies (ms each, shown as labels)
const BASE_LATENCIES = {
  'client→resolver':   2,
  'resolver→root':     18,
  'root→resolver':     16,
  'resolver→tld':      12,
  'tld→resolver':      11,
  'resolver→auth':     8,
  'auth→resolver':     9,
  'resolver→client':   2,
  'client→webserver':  45,
};

// DNS lookup steps
const DNS_STEPS = [
  { from: 'client',   to: 'resolver',  dir: 'fwd', msg: 'What is {domain}?',     color: 'blue'  },
  { from: 'resolver', to: 'root',      dir: 'fwd', msg: 'What is {domain}?',     color: 'blue'  },
  { from: 'root',     to: 'resolver',  dir: 'rev', msg: 'Ask .{tld} TLD server', color: 'yellow'},
  { from: 'resolver', to: 'tld',       dir: 'fwd', msg: 'What is {domain}?',     color: 'blue'  },
  { from: 'tld',      to: 'resolver',  dir: 'rev', msg: 'Ask authoritative DNS', color: 'yellow'},
  { from: 'resolver', to: 'auth',      dir: 'fwd', msg: 'What is {domain}?',     color: 'blue'  },
  { from: 'auth',     to: 'resolver',  dir: 'rev', msg: '{domain} = {ip}',        color: 'green' },
  { from: 'resolver', to: 'client',    dir: 'rev', msg: '{ip}',                  color: 'green' },
  { from: 'client',   to: 'webserver', dir: 'fwd', msg: 'HTTP GET / HTTP/1.1',   color: 'green' },
];

// ── Visible edges (for SVG rendering) ─────────────────────
const EDGES = [
  { id: 'e-cr',  from: 'client',   to: 'resolver'  },
  { id: 'e-rro', from: 'resolver', to: 'root'      },
  { id: 'e-rt',  from: 'resolver', to: 'tld'       }, // will be diagonal
  { id: 'e-ra',  from: 'resolver', to: 'auth'      },
  { id: 'e-cw',  from: 'client',   to: 'webserver' },
];

let svgEl   = null;
let running = false;
let cancelFns = [];
let lastDomain = null;
let lastIP     = null;
let resolverCache = new Map();
let completed = false;

export function mount(container) {
  setConceptLevel(5);
  container.innerHTML = buildHTML();
  svgEl = container.querySelector('#l5-svg');

  container.querySelector('#l5-lookup-btn').addEventListener('click', onLookup);
  container.querySelector('#l5-domain-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onLookup();
  });
  container.querySelector('#l5-again-btn').addEventListener('click', onLookupAgain);
  container.querySelector('#l5-submit-btn').addEventListener('click', onSubmitChallenge);

  try {
    const p = JSON.parse(localStorage.getItem('netsim_progress') || '{}');
    if (p.completed?.includes(5)) markComplete(container);
  } catch (_) { /* ignore */ }

  log('Level 5 loaded — DNS Resolution', 'muted');
  log('Enter a domain name to watch the full DNS lookup chain animate.', 'info');
}

export function unmount() {
  cancelFns.forEach(fn => fn());
  cancelFns = [];
  running   = false;
  svgEl     = null;
}

// ── HTML ─────────────────────────────────────────────────
function buildHTML() {
  const nodeEls = Object.entries(NODES).map(([id, n]) => {
    if (n.shape === 'hex') {
      return `
        <g class="node-group" id="n5-${id}" transform="translate(${n.x},${n.y})">
          <polygon class="node-hex" points="0,-24 20,-12 20,12 0,24 -20,12 -20,-12" />
          <circle class="node-pulse-ring" cx="0" cy="0" r="28" />
          <text class="node-label" x="0" y="-3">${n.label}</text>
          <text class="node-sublabel" x="0" y="11">${n.sub}</text>
        </g>`;
    }
    if (n.shape === 'rect') {
      return `
        <g class="node-group" id="n5-${id}">
          <rect class="node-rect" x="${n.x - 34}" y="${n.y - 22}" width="68" height="44" />
          <text class="node-label" x="${n.x}" y="${n.y - 3}">${n.label}</text>
          <text class="node-sublabel" x="${n.x}" y="${n.y + 11}">${n.sub}</text>
        </g>`;
    }
    return `
      <g class="node-group" id="n5-${id}">
        <circle class="node-circle" cx="${n.x}" cy="${n.y}" />
        <circle class="node-pulse-ring" cx="${n.x}" cy="${n.y}" r="30" />
        <text class="node-label" x="${n.x}" y="${n.y - 4}">${n.label}</text>
        <text class="node-sublabel" x="${n.x}" y="${n.y + 11}">${n.sub}</text>
      </g>`;
  }).join('\n');

  const edgePaths = EDGES.map(e => {
    const a = NODES[e.from], b = NODES[e.to];
    return `<path id="${e.id}" class="edge edge--inactive" stroke-width="2"
                  d="M ${a.x} ${a.y} L ${b.x} ${b.y}" />`;
  }).join('\n');

  return `
    <div class="level-controls">
      <span class="level-title">L5 — DNS RESOLUTION</span>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
      <input id="l5-domain-input" class="field-input" type="text"
        placeholder="Enter domain (e.g. gonzaga.org)" maxlength="40"
        style="max-width:260px" autocomplete="off" value="gonzaga.org" />
      <button id="l5-lookup-btn" class="btn btn--primary">LOOKUP</button>
      <button id="l5-again-btn" class="btn btn--ghost" style="display:none">
        Look up again (cache demo)
      </button>
    </div>

    <div id="l5-current-step" class="callout callout--blue" style="margin-bottom:0.75rem;display:none"></div>

    <div style="position:relative">
      <svg id="l5-svg" class="sim-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
           style="height:${SVG_H}px;max-width:100%">
        ${edgePaths}
        ${nodeEls}
      </svg>
    </div>

    <div id="l5-total-time" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--yellow);margin-top:0.5rem;min-height:1.2em"></div>

    <!-- Challenge -->
    <div class="challenge-box" style="margin-top:1rem">
      <div class="challenge-prompt">
        <strong style="color:var(--blue);font-family:var(--font-mono);font-size:0.7rem">CHALLENGE</strong><br/>
        Answer both questions (min 20 chars each):<br/>
        1. What would happen if the DNS root servers went offline?<br/>
        2. How does DNS caching improve performance?
      </div>
      <textarea id="l5-answer" class="challenge-textarea"
        placeholder="Answer both questions here…" maxlength="800"></textarea>
      <div class="challenge-actions">
        <button id="l5-submit-btn" class="btn btn--secondary">SUBMIT</button>
        <span id="l5-feedback" class="challenge-feedback"></span>
      </div>
    </div>
    <div id="l5-complete"></div>
  `;
}

// ── Lookup helpers ────────────────────────────────────────
function jitter(base) {
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

function fakeIP(domain) {
  // Deterministic fake IP from domain chars
  let hash = 0;
  for (const c of domain) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return `93.${(hash >> 8) & 0xff}.${(hash >> 4) & 0xff}.${hash & 0xff}`;
}

function getTLD(domain) {
  return domain.split('.').pop() || 'org';
}

function getPathEl(fromId, toId) {
  const edge = EDGES.find(e =>
    (e.from === fromId && e.to === toId) ||
    (e.from === toId   && e.to === fromId)
  );
  if (!edge) return null;
  const p = svgEl?.querySelector(`#${edge.id}`);
  if (!p) return null;

  if (edge.from !== fromId) {
    // Return reversed clone
    const d = p.getAttribute('d');
    const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
    if (!m) return p;
    const clone = p.cloneNode();
    clone.setAttribute('d', `M ${m[3]} ${m[4]} L ${m[1]} ${m[2]}`);
    clone.id = '';
    svgEl.appendChild(clone);
    setTimeout(() => clone.remove(), 6000);
    return clone;
  }
  return p;
}

function activateNode(id) { svgEl?.querySelector(`#n5-${id}`)?.classList.add('node--active'); }
function deactivateNode(id) { svgEl?.querySelector(`#n5-${id}`)?.classList.remove('node--active'); }

// ── Main lookup ───────────────────────────────────────────
async function onLookup() {
  if (running) return;
  const domainInput = document.querySelector('#l5-domain-input');
  const domain      = domainInput?.value?.trim().toLowerCase() || 'gonzaga.org';
  if (!domain) return;

  const tld = getTLD(domain);
  const ip  = fakeIP(domain);
  lastDomain = domain;
  lastIP     = ip;
  resolverCache.set(domain, ip);

  running   = true;
  cancelFns = [];

  const stepCallout = document.querySelector('#l5-current-step');
  const totalTimeEl = document.querySelector('#l5-total-time');
  const againBtn    = document.querySelector('#l5-again-btn');
  totalTimeEl.textContent = '';
  againBtn.style.display  = 'none';

  let totalMs = 0;

  // Reset node states
  Object.keys(NODES).forEach(id => deactivateNode(id));

  const steps = [
    { from: 'client',   to: 'resolver',  hopKey: 'client→resolver',  msgTemplate: `What is ${domain}?` },
    { from: 'resolver', to: 'root',      hopKey: 'resolver→root',    msgTemplate: `What is ${domain}?` },
    { from: 'root',     to: 'resolver',  hopKey: 'root→resolver',    msgTemplate: `Ask .${tld} TLD server` },
    { from: 'resolver', to: 'tld',       hopKey: 'resolver→tld',     msgTemplate: `What is ${domain}?` },
    { from: 'tld',      to: 'resolver',  hopKey: 'tld→resolver',     msgTemplate: `Ask authoritative DNS for ${domain}` },
    { from: 'resolver', to: 'auth',      hopKey: 'resolver→auth',    msgTemplate: `What is ${domain}?` },
    { from: 'auth',     to: 'resolver',  hopKey: 'auth→resolver',    msgTemplate: `${domain} = ${ip}` },
    { from: 'resolver', to: 'client',    hopKey: 'resolver→client',  msgTemplate: ip },
    { from: 'client',   to: 'webserver', hopKey: 'client→webserver', msgTemplate: `HTTP GET / HTTP/1.1\nHost: ${domain}` },
  ];

  const colors = ['blue','blue','yellow','blue','yellow','blue','green','green','green'];

  log(`DNS lookup: ${domain}`, 'info');

  for (let i = 0; i < steps.length; i++) {
    if (!running) break;
    const step = steps[i];
    const lat  = jitter(BASE_LATENCIES[step.hopKey] || 10);
    totalMs   += lat;

    const color = colors[i];
    const label = step.msgTemplate.length > 10
      ? step.msgTemplate.slice(0, 9) + '…'
      : step.msgTemplate;

    // Callout
    if (stepCallout) {
      stepCallout.style.display = '';
      stepCallout.className = `callout callout--${color === 'yellow' ? 'amber' : color}`;
      stepCallout.textContent = `Step ${i + 1}/9: ${step.from.toUpperCase()} → ${step.to.toUpperCase()}: "${step.msgTemplate}" (+${lat}ms)`;
    }

    log(`[${i + 1}/9] ${step.from} → ${step.to}: "${step.msgTemplate}" (+${lat}ms)`, color === 'green' ? 'success' : color === 'yellow' ? 'warn' : 'info');

    const pathEl = getPathEl(step.from, step.to);
    if (pathEl) {
      pathEl.classList.add('edge--active');
      activateNode(step.from);

      const midX = (NODES[step.from].x + NODES[step.to].x) / 2;
      const midY = (NODES[step.from].y + NODES[step.to].y) / 2 - 16;

      await new Promise(resolve => {
        const { cancel } = animatePacket(svgEl, pathEl, {
          label, color,
          duration: Math.max(lat * 25, 400),
          onComplete: resolve,
        });
        cancelFns.push(cancel);
      });

      // Show timing label at midpoint of path
      showLabel(svgEl, midX, midY, `+${lat}ms`, 'var(--yellow)', 1200);
      pathEl.classList.remove('edge--active');
      deactivateNode(step.from);
      activateNode(step.to);
      await delay(300);
      deactivateNode(step.to);
    }
  }

  if (!running) return;

  totalTimeEl.textContent = `Total lookup time: ~${totalMs}ms → ${ip}`;
  stepCallout.style.display = 'none';

  log(`Lookup complete: ${domain} → ${ip} (${totalMs}ms total)`, 'success');
  againBtn.style.display = '';

  running   = false;
  cancelFns = [];
}

async function onLookupAgain() {
  if (running || !lastDomain || !lastIP) return;
  running = true;
  cancelFns = [];

  const stepCallout = document.querySelector('#l5-current-step');
  const totalTimeEl = document.querySelector('#l5-total-time');

  log(`Cache hit: ${lastDomain} → ${lastIP} (1ms)`, 'success');

  // Only show resolver→client hop (yellow = cache hit)
  if (stepCallout) {
    stepCallout.style.display = '';
    stepCallout.className     = 'callout callout--amber';
    stepCallout.textContent   = `CACHE HIT: Resolver already knows ${lastDomain} = ${lastIP}`;
  }

  const pathEl = getPathEl('resolver', 'client');
  if (pathEl) {
    pathEl.classList.add('edge--active');
    activateNode('resolver');

    const midX = (NODES.resolver.x + NODES.client.x) / 2;
    const midY = (NODES.resolver.y + NODES.client.y) / 2 - 16;

    await new Promise(resolve => {
      const { cancel } = animatePacket(svgEl, pathEl, {
        label: lastIP.slice(0, 9) + '…',
        color: 'yellow',
        duration: 600,
        onComplete: resolve,
      });
      cancelFns.push(cancel);
    });

    showLabel(svgEl, midX, midY, '+1ms CACHE HIT', 'var(--yellow)', 2000);
    pathEl.classList.remove('edge--active');
    deactivateNode('resolver');
  }

  totalTimeEl.textContent = `Cache hit! Total: ~1ms (vs ${Object.values(BASE_LATENCIES).reduce((a,b)=>a+b,0)}ms uncached)`;

  if (stepCallout) stepCallout.style.display = 'none';

  showBanner(svgEl.parentElement, 'CACHE HIT — 1ms!', 1800);
  log('DNS caching saved the full lookup chain.', 'success');

  running   = false;
  cancelFns = [];
}

function onSubmitChallenge() {
  const answer   = document.querySelector('#l5-answer')?.value?.trim() || '';
  const feedback = document.querySelector('#l5-feedback');

  if (answer.length < 40) {
    feedback.className = 'challenge-feedback challenge-feedback--err';
    feedback.textContent = `✗ Answer both questions (min 40 chars total, ${answer.length} so far).`;
    return;
  }

  feedback.className = 'challenge-feedback challenge-feedback--ok';
  feedback.textContent = '✓ Submitted!';
  log('Challenge submitted.', 'success');

  if (!completed) {
    completed = true;
    markComplete(document.getElementById('level-canvas'));
    completeLevel(5);
    showBanner(document.getElementById('level-canvas'), 'Challenge complete!', 2500);
    const { userId, name } = getIdentity();
    if (name) saveResponse(userId, name, 5, answer);
  }
}

function markComplete(container) {
  const el = container.querySelector('#l5-complete');
  if (!el || el.querySelector('.complete-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'complete-banner';
  banner.innerHTML = `
    <span class="complete-banner-icon">✓</span>
    <span class="complete-banner-text">LEVEL 5 COMPLETE — Level 6 unlocked</span>
  `;
  el.appendChild(banner);
}

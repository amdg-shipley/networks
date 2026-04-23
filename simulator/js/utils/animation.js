// Packet animation utilities using SVG getPointAtLength + requestAnimationFrame

/**
 * Animate a packet square traveling along an SVG <path>.
 *
 * @param {SVGElement}  svgEl   - The <svg> element to render into
 * @param {SVGPathElement} pathEl - The path to follow
 * @param {Object} opts
 *   label      {string}   - Text displayed on the packet square (max ~4 chars)
 *   color      {string}   - CSS class suffix: 'blue'|'green'|'red'|'yellow'
 *   duration   {number}   - Travel duration in ms
 *   onComplete {Function} - Called when packet reaches destination
 *   onMidpoint {Function} - Called at 50% — use for packet-loss drop
 *   onCancelled{Function} - Called if cancel() is invoked mid-flight
 *
 * @returns {{ cancel: () => void }}
 */
export function animatePacket(svgEl, pathEl, opts = {}) {
  const {
    label      = '',
    color      = 'blue',
    duration   = 1200,
    onComplete = null,
    onMidpoint = null,
    onCancelled= null,
  } = opts;

  const totalLen = pathEl.getTotalLength();
  let cancelled  = false;
  let rafId      = null;
  let startTime  = null;
  let midFired   = false;

  // Create packet group
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'packet-group');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', `packet packet--${color}`);
  rect.setAttribute('width', '24');
  rect.setAttribute('height', '24');

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('class', 'packet-label');
  text.setAttribute('x', '12');
  text.setAttribute('y', '12');
  text.textContent = label;

  g.appendChild(rect);
  if (label) g.appendChild(text);
  svgEl.appendChild(g);

  function step(ts) {
    if (cancelled) return;
    if (!startTime) startTime = ts;

    const elapsed  = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const pt = pathEl.getPointAtLength(progress * totalLen);
    g.setAttribute('transform', `translate(${pt.x - 12},${pt.y - 12})`);

    // Midpoint callback (for packet-loss simulation)
    if (!midFired && progress >= 0.5) {
      midFired = true;
      if (onMidpoint) {
        onMidpoint({ x: pt.x, y: pt.y, cancel: cancel });
      }
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      g.remove();
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(step);

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);

    // Show drop animation at current position
    g.classList.add('packet-drop');
    g.addEventListener('animationend', () => g.remove(), { once: true });
    onCancelled?.();
  }

  return { cancel };
}

/**
 * Briefly pulse the stroke of an SVG path element (L1 wire glow).
 * @param {SVGPathElement} pathEl
 * @param {string} colorClass - 'green'|'blue'|'red'
 * @param {number} duration - ms
 */
export function glowWire(pathEl, colorClass = 'green', duration = 180) {
  pathEl.classList.add('wire--glow');
  setTimeout(() => pathEl.classList.remove('wire--glow'), duration);
}

/**
 * Show a brief drop X at coordinates in an SVG element.
 */
export function showDrop(svgEl, x, y) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${x},${y})`);

  const SIZE = 10;
  const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l1.setAttribute('x1', -SIZE); l1.setAttribute('y1', -SIZE);
  l1.setAttribute('x2',  SIZE); l1.setAttribute('y2',  SIZE);
  l1.setAttribute('stroke', 'var(--red)');
  l1.setAttribute('stroke-width', '2.5');

  const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l2.setAttribute('x1',  SIZE); l2.setAttribute('y1', -SIZE);
  l2.setAttribute('x2', -SIZE); l2.setAttribute('y2',  SIZE);
  l2.setAttribute('stroke', 'var(--red)');
  l2.setAttribute('stroke-width', '2.5');

  g.appendChild(l1);
  g.appendChild(l2);
  svgEl.appendChild(g);

  g.classList.add('packet-drop');
  g.addEventListener('animationend', () => g.remove(), { once: true });
}

/**
 * Show a temporary SVG text label at a position (e.g., timing hop labels).
 */
export function showLabel(svgEl, x, y, text, color = 'var(--yellow)', duration = 1800) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('fill', color);
  el.setAttribute('font-family', 'JetBrains Mono, monospace');
  el.setAttribute('font-size', '10');
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('pointer-events', 'none');
  el.textContent = text;
  svgEl.appendChild(el);

  // Fade out
  el.style.transition = `opacity ${duration * 0.3}ms ease`;
  el.style.opacity = '1';
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), duration * 0.35);
  }, duration * 0.65);

  return el;
}

/**
 * Show a full-width sim banner (e.g., "Connection established").
 * Returns a removal function.
 */
export function showBanner(container, text, duration = 2000) {
  const banner = document.createElement('div');
  banner.className = 'sim-banner';
  banner.textContent = text;
  container.style.position = 'relative';
  container.appendChild(banner);

  const remove = () => banner.remove();
  if (duration > 0) setTimeout(remove, duration);
  return remove;
}

/**
 * Sequence helper — runs an array of async steps one after another.
 * Each step is a function that returns a Promise.
 */
export async function runSequence(steps) {
  for (const step of steps) {
    await step();
  }
}

/**
 * Promise-based delay.
 */
export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

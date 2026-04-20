// onContextMenu() wrapper with long-press fallback for touchscreens

const LONG_PRESS_MS = 500;

/**
 * Attach a context-menu handler that works on both mouse (right-click)
 * and touchscreen (500ms long-press) devices.
 *
 * @param {Element}  el
 * @param {Function} handler  - receives a { x, y } object (viewport coords)
 * @returns {Function}        - call to remove all listeners
 */
export function onContextMenu(el, handler) {
  let pressTimer = null;
  let startX = 0, startY = 0;

  function onContext(e) {
    e.preventDefault();
    handler({ x: e.clientX, y: e.clientY, target: e.target });
  }

  function onPointerDown(e) {
    if (e.button !== 0) return; // only primary touch/pointer
    startX = e.clientX;
    startY = e.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      handler({ x: startX, y: startY, target: e.target });
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!pressTimer) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 8) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function onPointerUp() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  el.addEventListener('contextmenu', onContext);
  el.addEventListener('pointerdown',  onPointerDown);
  el.addEventListener('pointermove',  onPointerMove);
  el.addEventListener('pointerup',    onPointerUp);
  el.addEventListener('pointercancel',onPointerUp);

  return () => {
    el.removeEventListener('contextmenu', onContext);
    el.removeEventListener('pointerdown',  onPointerDown);
    el.removeEventListener('pointermove',  onPointerMove);
    el.removeEventListener('pointerup',    onPointerUp);
    el.removeEventListener('pointercancel',onPointerUp);
  };
}

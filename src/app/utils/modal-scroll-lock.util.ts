/** Class on <html> while a settings/form modal is open — freezes page scroll. */
export const MODAL_SCROLL_LOCK_CLASS = 'modal-scroll-lock';

let lockCount = 0;
let wheelBound = false;

function isScrollableY(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const oy = style.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * Wheel while a modal is open: allow scroll only inside the topmost modal’s
 * scrollable regions; never chain to the page behind.
 */
function onModalWheel(event: WheelEvent): void {
  if (lockCount <= 0) return;

  const path = event.composedPath();
  let modal: HTMLElement | null = null;
  for (const node of path) {
    if (node instanceof HTMLElement && node.classList.contains('modal')) {
      modal = node;
      break;
    }
  }

  if (!modal) {
    event.preventDefault();
    return;
  }

  let scrollEl: HTMLElement | null = null;
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (!modal.contains(node) && node !== modal) continue;
    if (isScrollableY(node)) {
      scrollEl = node;
      break;
    }
    if (node === modal) break;
  }
  if (!scrollEl && isScrollableY(modal)) scrollEl = modal;

  if (!scrollEl) {
    event.preventDefault();
    return;
  }

  const max = scrollEl.scrollHeight - scrollEl.clientHeight;
  const top = scrollEl.scrollTop;
  const dy = event.deltaY;
  if ((dy < 0 && top <= 0) || (dy > 0 && top >= max - 1)) {
    event.preventDefault();
  }
}

function ensureWheelBound(): void {
  if (wheelBound) return;
  document.addEventListener('wheel', onModalWheel, { passive: false, capture: true });
  wheelBound = true;
}

/** Acquire page scroll lock (ref-counted for stacked modals). */
export function acquireModalScrollLock(): void {
  lockCount += 1;
  if (lockCount === 1) {
    document.documentElement.classList.add(MODAL_SCROLL_LOCK_CLASS);
    ensureWheelBound();
  }
}

/** Release one scroll lock. */
export function releaseModalScrollLock(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.documentElement.classList.remove(MODAL_SCROLL_LOCK_CLASS);
  }
}

/**
 * Stamp / signature overlay drag+resize for HTML form editors.
 * Compensates for doc-zoom-stage CSS scale; drag keeps grab point under the pointer.
 */
(function (global) {
  function overlayParent(el) {
    return el.offsetParent || el.closest('.doc-overlay-layer') || el.parentElement;
  }

  function pinOverlayPosition(el) {
    el.style.left = `${el.offsetLeft}px`;
    el.style.top = `${el.offsetTop}px`;
    return { left: el.offsetLeft, top: el.offsetTop };
  }

  function pointerLocal(clientX, clientY, parent, scale) {
    const pr = parent.getBoundingClientRect();
    return {
      x: (clientX - pr.left) / scale,
      y: (clientY - pr.top) / scale,
    };
  }

  /** How much of the overlay may extend past the parent edge (1 = fully outside). */
  const OVERHANG = 1;

  function dragBounds(width, height, parent) {
    return {
      minLeft: -width * OVERHANG,
      maxLeft: parent.clientWidth - width * (1 - OVERHANG),
      minTop: -height * OVERHANG,
      maxTop: parent.clientHeight - height * (1 - OVERHANG),
    };
  }

  function clampDragPosition(left, top, width, height, parent) {
    const b = dragBounds(width, height, parent);
    return {
      left: Math.min(b.maxLeft, Math.max(b.minLeft, left)),
      top: Math.min(b.maxTop, Math.max(b.minTop, top)),
    };
  }

  function resizeDirFor(target) {
    if (target.classList.contains('overlay-resize')) return 'se';
    if (target.classList.contains('overlay-h--e')) return 'e';
    if (target.classList.contains('overlay-h--w')) return 'w';
    if (target.classList.contains('overlay-h--n')) return 'n';
    if (target.classList.contains('overlay-h--s')) return 's';
    return null;
  }

  /**
   * @param {HTMLElement} el
   * @param {() => number} getScale editor zoom factor (1 = 100%)
   * @param {() => void} onPersist called after drag/resize ends
   */
  function attach(el, getScale, onPersist) {
    let mode = null;
    let resizeDir = null;
    let startX = 0;
    let startY = 0;
    let startL = 0;
    let startT = 0;
    let startW = 0;
    let startH = 0;
    let pointerId = null;

    function onDown(e) {
      resizeDir = resizeDirFor(e.target);
      mode = resizeDir ? 'resize' : 'drag';
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;

      const parent = overlayParent(el);
      const scale = typeof getScale === 'function' ? getScale() : 1;
      startW = el.offsetWidth;
      startH = el.offsetHeight;

      if (mode === 'drag') {
        const pinned = pinOverlayPosition(el);
        startL = pinned.left;
        startT = pinned.top;
      } else {
        const pinned = pinOverlayPosition(el);
        startL = pinned.left;
        startT = pinned.top;
        startW = el.offsetWidth;
        startH = el.offsetHeight;
      }

      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture(pointerId);
      } catch (err) { /* ignore */ }
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    }

    function onMove(e) {
      if (!mode || e.pointerId !== pointerId) return;
      const scale = typeof getScale === 'function' ? getScale() : 1;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const parent = overlayParent(el);

      if (mode === 'drag') {
        const pos = clampDragPosition(startL + dx, startT + dy, el.offsetWidth, el.offsetHeight, parent);
        el.style.left = `${pos.left}px`;
        el.style.top = `${pos.top}px`;
      } else if (resizeDir === 'se') {
        let aspect = startW / startH;
        if (isNaN(aspect) || !isFinite(aspect) || aspect <= 0) aspect = 1;
        const maxW = parent.clientWidth - startL + startW * OVERHANG;
        const maxH = parent.clientHeight - startT + startH * OVERHANG;
        const proposedW = Math.max(20, startW + dx);
        const proposedH = proposedW / aspect;
        let finalW = proposedW;
        if (proposedW > maxW || proposedH > maxH) {
          finalW = Math.min(maxW, maxH * aspect);
        }
        el.style.width = `${finalW}px`;
        el.style.height = `${finalW / aspect}px`;
      } else if (resizeDir === 'e') {
        const maxW = parent.clientWidth - startL + startW * OVERHANG;
        el.style.width = `${Math.max(20, Math.min(startW + dx, maxW))}px`;
      } else if (resizeDir === 'w') {
        const proposedW = startW - dx;
        let finalW = Math.max(20, proposedW);
        let finalLeft = startL + (startW - finalW);
        const minLeft = -finalW * OVERHANG;
        if (finalLeft < minLeft) {
          finalLeft = minLeft;
          finalW = startL + startW - finalLeft;
        }
        el.style.width = `${finalW}px`;
        el.style.left = `${finalLeft}px`;
      } else if (resizeDir === 's') {
        const maxH = parent.clientHeight - startT + startH * OVERHANG;
        el.style.height = `${Math.max(20, Math.min(startH + dy, maxH))}px`;
      } else if (resizeDir === 'n') {
        const proposedH = startH - dy;
        let finalH = Math.max(20, proposedH);
        let finalTop = startT + (startH - finalH);
        const minTop = -finalH * OVERHANG;
        if (finalTop < minTop) {
          finalTop = minTop;
          finalH = startT + startH - finalTop;
        }
        el.style.height = `${finalH}px`;
        el.style.top = `${finalTop}px`;
      }
    }

    function onUp(e) {
      if (pointerId != null && e && e.pointerId !== pointerId) return;
      if (mode && typeof onPersist === 'function') onPersist();
      mode = null;
      const capturedId = pointerId;
      pointerId = null;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (capturedId != null) {
        try {
          el.releasePointerCapture(capturedId);
        } catch (err) { /* ignore */ }
      }
    }

    el.addEventListener('pointerdown', onDown);
  }

  global.CrewOverlayDrag = { attach };
})(typeof window !== 'undefined' ? window : globalThis);

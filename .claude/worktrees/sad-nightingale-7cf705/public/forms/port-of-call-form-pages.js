/**
 * Editor page navigation for Port of Call HTML forms 01 & 02.
 * PDF export renders all pages; editor shows one page at a time when count > 1.
 */
(function (global) {
  let currentPage = 0;
  let totalPages = 1;
  let onPageChange = null;

  function pageInput() {
    return document.getElementById('poc-page-input');
  }

  function syncInputValue() {
    const input = pageInput();
    if (!input || document.activeElement === input) return;
    input.value = String(currentPage + 1);
  }

  function syncNavUi() {
    const bar = document.getElementById('poc-page-nav');
    if (!bar) return;
    const show = totalPages > 1;
    bar.hidden = !show;
    bar.style.display = show ? '' : 'none';

    const totalEl = document.getElementById('poc-page-total');
    if (totalEl) totalEl.textContent = String(totalPages);

    syncInputValue();

    const prevBtn = document.getElementById('poc-page-prev');
    const nextBtn = document.getElementById('poc-page-next');
    if (prevBtn) prevBtn.disabled = currentPage <= 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
  }

  function goTo(page) {
    const next = Math.min(totalPages - 1, Math.max(0, Math.round(page)));
    if (next === currentPage) {
      syncNavUi();
      return;
    }
    currentPage = next;
    syncNavUi();
    if (onPageChange) onPageChange(currentPage);
  }

  function commitInput() {
    const input = pageInput();
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) {
      input.value = String(currentPage + 1);
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      input.value = String(currentPage + 1);
      return;
    }
    goTo(n - 1);
    syncInputValue();
  }

  function stepInput(delta) {
    goTo(currentPage + delta);
    const input = pageInput();
    if (input && document.activeElement === input) {
      input.value = String(currentPage + 1);
      requestAnimationFrame(() => input.select());
    }
  }

  function bindPageInput() {
    const input = pageInput();
    if (!input || input.dataset.pocNavBound === '1') return;
    input.dataset.pocNavBound = '1';

    input.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (document.activeElement !== input) return;
      e.preventDefault();
      input.select();
    });

    input.addEventListener('focus', () => {
      requestAnimationFrame(() => input.select());
    });

    input.addEventListener('click', () => {
      input.select();
    });

    input.addEventListener('blur', () => {
      commitInput();
    });

    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/\D/g, '');
      if (input.value !== cleaned) input.value = cleaned;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitInput();
        input.blur();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        input.value = String(currentPage + 1);
        input.blur();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepInput(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepInput(1);
      }
    });
  }

  function setTotal(n) {
    totalPages = Math.max(1, Math.round(Number(n)) || 1);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    syncNavUi();
  }

  function init(options) {
    onPageChange = options?.onPageChange ?? null;
    bindPageInput();
    document.getElementById('poc-page-prev')?.addEventListener('click', () => goTo(currentPage - 1));
    document.getElementById('poc-page-next')?.addEventListener('click', () => goTo(currentPage + 1));
    syncNavUi();
  }

  function reset() {
    currentPage = 0;
    syncNavUi();
  }

  function syncRowToolbar() {
    const onFirst = currentPage === 0;
    const addBtn = document.getElementById('btn-add-row');
    const remBtn = document.getElementById('btn-remove-row');
    if (!onFirst) {
      if (addBtn) addBtn.disabled = true;
      if (remBtn) remBtn.disabled = true;
      return;
    }
    global.PortOfCallFormRows?.syncToolbarButtons?.();
  }

  global.PortOfCallFormPages = {
    init,
    setTotal,
    getCurrent: () => currentPage,
    goTo,
    reset,
    syncNavUi,
    syncRowToolbar,
  };
})(typeof window !== 'undefined' ? window : globalThis);

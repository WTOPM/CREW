/**
 * Editor page navigation for Port of Call HTML forms 01 & 02.
 * PDF export renders all pages; editor shows one page at a time when count > 1.
 */
(function (global) {
  let currentPage = 0;
  let totalPages = 1;
  let onPageChange = null;

  function syncNavUi() {
    const bar = document.getElementById('poc-page-nav');
    if (!bar) return;
    const show = totalPages > 1;
    bar.hidden = !show;
    bar.style.display = show ? '' : 'none';
    const label = document.getElementById('poc-page-label');
    const prevBtn = document.getElementById('poc-page-prev');
    const nextBtn = document.getElementById('poc-page-next');
    if (label) label.textContent = `Page ${currentPage + 1} / ${totalPages}`;
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

  function setTotal(n) {
    totalPages = Math.max(1, Math.round(Number(n)) || 1);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    syncNavUi();
  }

  function init(options) {
    onPageChange = options?.onPageChange ?? null;
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

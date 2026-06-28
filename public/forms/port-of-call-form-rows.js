/**
 * Add / remove data rows in Port of Call HTML editors (same UX as crew list forms).
 * Persists row count as documentOverlay[overlayKey].rowsPerPage on Save.
 */
(function (global) {
  const DEFAULT_ROWS = 11;
  const MIN_ROWS = 1;
  const MAX_ROWS = 23;

  let config = null;

  function clamp(n) {
    return Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(Number(n)) || DEFAULT_ROWS));
  }

  function tbody() {
    return document.getElementById('poc-tbody');
  }

  function dataRows() {
    const el = tbody();
    if (!el || !config?.rowSelector) return [];
    return Array.from(el.querySelectorAll(config.rowSelector));
  }

  function countRows() {
    return dataRows().length;
  }

  function syncToolbarButtons() {
    const addBtn = document.getElementById('btn-add-row');
    const remBtn = document.getElementById('btn-remove-row');
    const n = countRows();
    if (addBtn) {
      addBtn.disabled = n >= MAX_ROWS;
    }
    if (remBtn) {
      remBtn.disabled = n <= MIN_ROWS;
    }
  }

  function notifyChange() {
    syncToolbarButtons();
    if (config?.onChange) config.onChange(countRows());
  }

  function init(options) {
    config = options;
    syncToolbarButtons();
  }

  function ensureRowCount(target, silent) {
    if (!config) return;
    const want = clamp(target);
    let n = countRows();
    while (n < want) {
      config.appendEmptyRow(n, 0);
      n++;
    }
    while (n > want && n > MIN_ROWS) {
      const rows = dataRows();
      rows[rows.length - 1]?.remove();
      n--;
    }
    if (config.refreshRowNumbers) config.refreshRowNumbers(0);
    syncToolbarButtons();
    if (!silent) notifyChange();
  }

  function addRow() {
    if (!config || countRows() >= MAX_ROWS) return;
    config.appendEmptyRow(countRows(), 0);
    if (config.refreshRowNumbers) config.refreshRowNumbers(0);
    notifyChange();
  }

  function removeRow() {
    if (!config || countRows() <= MIN_ROWS) return;
    const rows = dataRows();
    rows[rows.length - 1]?.remove();
    if (config.refreshRowNumbers) config.refreshRowNumbers(0);
    notifyChange();
  }

  function getRowsPerPage() {
    const n = countRows();
    return n > 0 ? n : DEFAULT_ROWS;
  }

  global.PortOfCallFormRows = {
    init,
    addRow,
    removeRow,
    ensureRowCount,
    getRowsPerPage,
    syncToolbarButtons,
    DEFAULT_ROWS,
    MIN_ROWS,
    MAX_ROWS,
  };
  global.addRow = addRow;
  global.removeRow = removeRow;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Cell selection, alignment and font formatting for Port of Call HTML editors.
 * Same UX as crew/passenger forms: select cells → font / size / align toolbar.
 */
(function (global) {
  let root = null;
  let selectedCells = [];
  let isDragging = false;
  let selectionAnchor = null;
  let dirtyBaseline = null;

  function editableRows() {
    if (!root) return [];
    return Array.from(root.querySelectorAll('tr.poc-editable-row, tr.poc-th-row, #poc-tbody tr'));
  }

  function rowCells(tr) {
    return tr.querySelectorAll('input.ci, div.ci');
  }

  function cellCoords(el) {
    const tr = el.closest('tr');
    const rows = editableRows();
    const row = rows.indexOf(tr);
    const col = Array.from(rowCells(tr)).indexOf(el);
    return { row, col };
  }

  function cellAt(row, col) {
    const rows = editableRows();
    const tr = rows[row];
    if (!tr) return null;
    const cells = rowCells(tr);
    return cells[col] || null;
  }

  function cellText(cell) {
    if (!cell) return '';
    if (cell.tagName === 'INPUT') return cell.value || '';
    return (cell.textContent || '').trim();
  }

  function clearSelection() {
    selectedCells.forEach((c) => c.classList.remove('selected'));
    selectedCells = [];
    if (global.CrewCellAlignToolbar?.syncSelection) global.CrewCellAlignToolbar.syncSelection();
  }

  function dismissSelection() {
    clearSelection();
    isDragging = false;
    selectionAnchor = null;
  }

  function resolveCell(target) {
    if (!root || !target || !root.contains(target)) return null;
    const direct = target.closest('.ci');
    if (direct) return direct;
    const td = target.closest('td');
    if (td) return td.querySelector('.ci');
    return null;
  }

  function addSelectedCell(cell) {
    if (!cell || selectedCells.includes(cell)) return;
    selectedCells.push(cell);
    cell.classList.add('selected');
  }

  function selectRange(r1, c1, r2, c2) {
    clearSelection();
    const rMin = Math.min(r1, r2);
    const rMax = Math.max(r1, r2);
    const cMin = Math.min(c1, c2);
    const cMax = Math.max(c1, c2);
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        addSelectedCell(cellAt(r, c));
      }
    }
    if (global.CrewCellAlignToolbar?.syncSelection) global.CrewCellAlignToolbar.syncSelection();
  }

  function selectionBounds() {
    const coords = selectedCells.map((el) => ({ el, ...cellCoords(el) }));
    return {
      rMin: Math.min(...coords.map((c) => c.row)),
      rMax: Math.max(...coords.map((c) => c.row)),
      cMin: Math.min(...coords.map((c) => c.col)),
      cMax: Math.max(...coords.map((c) => c.col)),
      selectedSet: new Set(selectedCells),
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildCopyText() {
    const { rMin, rMax, cMin, cMax, selectedSet } = selectionBounds();
    const lines = [];
    for (let r = rMin; r <= rMax; r++) {
      const rowVals = [];
      for (let c = cMin; c <= cMax; c++) {
        const cell = cellAt(r, c);
        rowVals.push(cell && selectedSet.has(cell) ? cellText(cell) : '');
      }
      lines.push(rowVals.join('\t'));
    }
    return lines.join('\n');
  }

  function hdrValWrapper(cell) {
    return cell.closest('.poc02-hdr-val');
  }

  function syncCellFlexAlignment(cell) {
    const ta = cell.style.textAlign || '';
    const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
    const hdrVal = hdrValWrapper(cell);
    if (hdrVal && cell.classList.contains('ci-hdr')) {
      hdrVal.style.justifyContent = jc;
      cell.style.display = 'block';
      return;
    }
    const usesFlex =
      cell.style.display === 'flex' ||
      cell.classList.contains('ci-hdr') ||
      cell.classList.contains('ci-th') ||
      cell.classList.contains('ci-rno') ||
      cell.closest('.data-row, .poc02-data-row');
    if (usesFlex) {
      cell.style.display = 'flex';
      cell.style.justifyContent = jc;
    }
  }

  function applyVerticalAlignToCell(cell, val) {
    const alignItems = val === 'top' ? 'flex-start' : val === 'bottom' ? 'flex-end' : 'center';
    const hdrVal = hdrValWrapper(cell);
    if (hdrVal && cell.classList.contains('ci-hdr')) {
      hdrVal.style.display = 'flex';
      hdrVal.style.alignItems = alignItems;
      cell.dataset.verticalAlign = val;
      syncCellFlexAlignment(cell);
      return;
    }
    cell.style.display = 'flex';
    cell.style.height = '100%';
    cell.style.alignItems = alignItems;
    cell.dataset.verticalAlign = val;
    syncCellFlexAlignment(cell);
  }

  function applyFormat(prop, val) {
    selectedCells.forEach((cell) => {
      cell.style[prop] = val;
      if (prop === 'textAlign') syncCellFlexAlignment(cell);
    });
  }

  function applyVerticalAlign(val) {
    selectedCells.forEach((cell) => {
      applyVerticalAlignToCell(cell, val);
    });
  }

  function syncToolbarFromCell(cell) {
    if (!cell) return;
    const fontSel = document.getElementById('tb-font');
    const sizeSel = document.getElementById('tb-size');
    const font = cell.style.fontFamily || 'Arial';
    const size = cell.style.fontSize ? parseInt(cell.style.fontSize, 10) : 8;
    if (fontSel) fontSel.value = font.replace(/"/g, '');
    if (sizeSel) sizeSel.value = String(size);
  }

  function styleRecord(el) {
    if (!el) return null;
    const style = {};
    if (el.style.fontFamily) style.fontFamily = el.style.fontFamily;
    if (el.style.fontSize) style.fontSize = el.style.fontSize;
    if (el.style.textAlign) style.textAlign = el.style.textAlign;
    if (el.dataset.verticalAlign) style.verticalAlign = el.dataset.verticalAlign;
    return Object.keys(style).length ? style : null;
  }

  function collectCellStyles() {
    if (!root) return {};
    const cellStyles = {};
    root.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      const key = el.dataset.cellKey;
      const style = styleRecord(el);
      if (key && style) cellStyles[key] = style;
    });
    return cellStyles;
  }

  function restoreCellStyles(cellStyles, scopeEl) {
    const scope = scopeEl || root;
    if (!scope || !cellStyles) return;
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      const style = cellStyles[el.dataset.cellKey];
      if (!style) return;
      if (style.fontFamily) el.style.fontFamily = style.fontFamily;
      if (style.fontSize) el.style.fontSize = style.fontSize;
      if (style.textAlign) el.style.textAlign = style.textAlign;
      if (style.verticalAlign) applyVerticalAlignToCell(el, style.verticalAlign);
      else if (style.textAlign) syncCellFlexAlignment(el);
    });
  }

  function flattenInputsForExport(scopeEl) {
    const scope = scopeEl || root || document;
    if (!scope) return;
    scope.querySelectorAll('input.ci, input.fi').forEach((input) => {
      const replacement = document.createElement('div');
      replacement.className = input.className;
      replacement.textContent = input.value || '';
      replacement.style.cssText = input.style.cssText;
      replacement.style.border = 'none';
      replacement.style.background = 'transparent';
      replacement.style.display = 'flex';
      replacement.style.alignItems = input.dataset.verticalAlign
        ? input.style.alignItems || 'center'
        : 'center';
      replacement.style.justifyContent =
        input.style.textAlign === 'center'
          ? 'center'
          : input.style.textAlign === 'right'
            ? 'flex-end'
            : 'flex-start';
      replacement.style.width = '100%';
      replacement.style.height = '100%';
      replacement.style.overflow = 'hidden';
      input.replaceWith(replacement);
    });
  }

  function bindEvents() {
    if (!root) return;

    root.addEventListener('mousedown', (e) => {
      const cell = resolveCell(e.target);
      if (!cell) return;
      e.preventDefault();
      isDragging = true;
      selectionAnchor = cellCoords(cell);
      selectRange(selectionAnchor.row, selectionAnchor.col, selectionAnchor.row, selectionAnchor.col);
      syncToolbarFromCell(cell);
    });

    root.addEventListener('mouseover', (e) => {
      if (!isDragging || !selectionAnchor) return;
      const cell = resolveCell(e.target);
      if (!cell) return;
      const current = cellCoords(cell);
      selectRange(selectionAnchor.row, selectionAnchor.col, current.row, current.col);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    document.addEventListener('copy', (e) => {
      if (!selectedCells.length) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', buildCopyText());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dismissSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedCells.length) {
        e.preventDefault();
        document.execCommand('copy');
      }
    });

    document.body.addEventListener('mousedown', (e) => {
      if (e.target.closest('.a4-page')) return;
      if (e.target.closest('.side-panel')) return;
      if (e.target.closest('.confirm-backdrop')) return;
      dismissSelection();
    });
  }

  function captureDirtySnapshot() {
    if (!root) return '';
    const parts = [];
    root.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      parts.push({
        k: el.dataset.cellKey,
        v: cellText(el),
        s: styleRecord(el),
      });
    });
    return JSON.stringify(parts);
  }

  function captureDirtyBaseline() {
    dirtyBaseline = captureDirtySnapshot();
  }

  function isDirty() {
    if (dirtyBaseline === null) return false;
    return dirtyBaseline !== captureDirtySnapshot();
  }

  function init(tableRoot) {
    root = tableRoot;
    bindEvents();
    global.applyFormat = applyFormat;
    global.applyVerticalAlign = applyVerticalAlign;
    if (global.CrewCellAlignToolbar) {
      global.CrewCellAlignToolbar.init({ getSelectedCells: () => selectedCells });
    }
  }

  global.PortOfCallFormCells = {
    init,
    collectCellStyles,
    restoreCellStyles,
    flattenInputsForExport,
    restoreAllCellStyles(cellStyles) {
      document.querySelectorAll('.poc-grid, .poc02-grid').forEach((grid) => {
        restoreCellStyles(cellStyles, grid);
      });
    },
    flattenAllInputsForExport() {
      flattenInputsForExport(document);
    },
    getSelectedCells: () => selectedCells,
    dismissSelection,
    captureDirtyBaseline,
    isDirty,
  };
})(typeof window !== 'undefined' ? window : globalThis);

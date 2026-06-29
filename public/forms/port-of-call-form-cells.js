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

  function pageScope() {
    return root?.closest('.a4-page') || root;
  }

  function resolveCell(target) {
    if (!target) return null;
    const footer = target.closest(
      '#poc-footer-date, #poc-footer-master, .poc-form-footer__date, .poc-form-footer__master, #f-footer-date, #f-master-name',
    );
    if (footer && (pageScope()?.contains(footer) || root?.contains(footer))) return footer;
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

  function valWrapper(cell) {
    return cell.closest('.poc-hdr-val, .poc02-hdr-val, .poc-data-val');
  }

  function isFooterField(input) {
    return (
      input.classList.contains('ci-footer') ||
      input.classList.contains('poc-form-footer__date') ||
      input.classList.contains('poc-form-footer__master') ||
      input.dataset.cellKey === 'footer-date' ||
      input.dataset.cellKey === 'footer-master'
    );
  }

  function footerFieldValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';
    return (el.textContent || '').trim();
  }

  function flattenFooterForExport() {
    document.querySelectorAll('.poc-form-footer').forEach((footer) => {
      footer
        .querySelectorAll('#poc-footer-date, .poc-form-footer__date, input.poc-form-footer__date')
        .forEach((el) => {
          const span = document.createElement('span');
          span.className = 'poc-form-footer__date';
          span.textContent = footerFieldValue(el);
          span.style.cssText =
            'display:inline;font-size:8pt;font-weight:700;text-align:left;white-space:nowrap;padding:0 1mm;line-height:1.35;';
          el.replaceWith(span);
        });
      footer
        .querySelectorAll('#poc-footer-master, .poc-form-footer__master, input.poc-form-footer__master')
        .forEach((el) => {
          const span = document.createElement('span');
          span.className = 'poc-form-footer__master';
          span.textContent = footerFieldValue(el);
          span.style.cssText =
            'display:inline-block;width:50mm;max-width:100%;text-align:center;font-size:8pt;font-weight:700;border-bottom:1px solid #000;line-height:1.35;box-sizing:border-box;';
          el.replaceWith(span);
        });
    });
  }

  function syncCellFlexAlignment(cell) {
    const ta = cell.style.textAlign || '';
    const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
    const wrapper = valWrapper(cell);
    if (wrapper && cell.classList.contains('ci')) {
      wrapper.style.justifyContent = jc;
      cell.style.display = 'block';
      return;
    }
    const usesFlex =
      cell.style.display === 'flex' ||
      cell.classList.contains('ci-th') ||
      cell.classList.contains('ci-rno');
    if (usesFlex) {
      cell.style.display = 'flex';
      cell.style.justifyContent = jc;
    }
  }

  function resetWrappedCellLayout(cell) {
    delete cell.dataset.verticalAlign;
    cell.style.removeProperty('padding-top');
    cell.style.removeProperty('padding-bottom');
    cell.style.removeProperty('align-items');
    cell.style.removeProperty('justify-content');
    cell.style.removeProperty('height');
    cell.style.display = 'block';
    cell.style.lineHeight = 'normal';
    syncCellFlexAlignment(cell);
  }

  function reflowCell(cell) {
    if (!cell) return;
    if (valWrapper(cell) && cell.classList.contains('ci')) {
      resetWrappedCellLayout(cell);
      return;
    }
    syncCellFlexAlignment(cell);
  }

  function applyFormat(prop, val) {
    selectedCells.forEach((cell) => {
      cell.style[prop] = val;
      if (prop === 'textAlign') syncCellFlexAlignment(cell);
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
    return Object.keys(style).length ? style : null;
  }

  function isDataRowKey(key) {
    return /^d-\d+-\d+$/.test(key);
  }

  function storageKeyFromDomKey(domKey, voyOffset) {
    if (typeof voyOffset !== 'number' || !isDataRowKey(domKey)) return domKey;
    const m = /^d-(\d+)-(\d+)$/.exec(domKey);
    if (!m) return domKey;
    return `d-${voyOffset + parseInt(m[1], 10)}-${m[2]}`;
  }

  function setCellValue(el, text) {
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = text;
    else el.textContent = text;
  }

  function collectCellStyles() {
    const scope = pageScope() || root;
    if (!scope) return {};
    const cellStyles = {};
    scope.querySelectorAll('[data-cell-key^="footer-"]').forEach((el) => {
      const key = el.dataset.cellKey;
      const style = styleRecord(el);
      if (key && style) cellStyles[key] = style;
    });
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      const key = el.dataset.cellKey;
      const style = styleRecord(el);
      if (key && style) cellStyles[key] = style;
    });
    return cellStyles;
  }

  function collectCellValues(voyOffset, scopeEl) {
    const scope = scopeEl || pageScope() || root;
    if (!scope) return {};
    const cellValues = {};
    scope.querySelectorAll('input.ci[data-cell-key], [data-cell-key^="footer-"]').forEach((el) => {
      const domKey = el.dataset.cellKey;
      if (!domKey) return;
      cellValues[storageKeyFromDomKey(domKey, voyOffset)] = cellText(el);
    });
    return cellValues;
  }

  function restoreCellValues(cellValues, scopeEl, voyOffset) {
    const scope = scopeEl || root;
    if (!scope || !cellValues) return;
    scope.querySelectorAll('input.ci[data-cell-key], [data-cell-key^="footer-"]').forEach((el) => {
      const domKey = el.dataset.cellKey;
      if (!domKey) return;
      const storageKey = storageKeyFromDomKey(domKey, voyOffset);
      let val = cellValues[storageKey];
      if (val === undefined && isDataRowKey(domKey)) val = cellValues[domKey];
      if (val === undefined) return;
      setCellValue(el, val);
      reflowCell(el);
    });
  }

  function restoreCellStyles(cellStyles, scopeEl) {
    const scope = scopeEl || root;
    if (!scope || !cellStyles) return;
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key], [data-cell-key^="footer-"]').forEach((el) => {
      const style = cellStyles[el.dataset.cellKey];
      if (!style) return;
      if (style.fontFamily) el.style.fontFamily = style.fontFamily;
      if (style.fontSize) el.style.fontSize = style.fontSize;
      if (style.textAlign) el.style.textAlign = style.textAlign;
      reflowCell(el);
    });
  }

  function flattenInputsForExport(scopeEl) {
    const scope = scopeEl || root || document;
    if (!scope) return;
    scope.querySelectorAll('input.ci, input.fi').forEach((input) => {
      const replacement = document.createElement('div');
      replacement.className = input.className;
      replacement.textContent = input.value || '';
      replacement.style.border = 'none';
      replacement.style.background = 'transparent';
      replacement.style.overflow = 'hidden';

      const wrapper = valWrapper(input);
      if (wrapper) {
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.lineHeight = 'normal';
        replacement.style.padding = '0';
        replacement.style.margin = '0';
        replacement.style.textOverflow = 'ellipsis';
        replacement.style.whiteSpace = 'nowrap';
        replacement.style.textAlign = input.style.textAlign || 'center';
      } else if (input.classList.contains('ci-th')) {
        replacement.style.cssText = input.style.cssText;
        replacement.style.display = 'flex';
        replacement.style.alignItems = 'center';
        replacement.style.justifyContent =
          input.style.textAlign === 'center'
            ? 'center'
            : input.style.textAlign === 'right'
              ? 'flex-end'
              : 'flex-start';
        replacement.style.width = '100%';
        replacement.style.height = '100%';
      } else if (isFooterField(input)) {
        replacement.style.cssText = input.style.cssText;
        replacement.style.display = 'block';
        replacement.style.height = 'auto';
        replacement.style.minHeight = '0';
        replacement.style.overflow = 'visible';
        replacement.style.textOverflow = 'clip';
        replacement.style.whiteSpace = 'nowrap';
        if (input.classList.contains('poc-form-footer__master')) {
          replacement.style.borderBottom = '1px solid #000';
        }
      } else {
        replacement.style.cssText = input.style.cssText;
        replacement.style.display = 'flex';
        replacement.style.alignItems = 'center';
        replacement.style.justifyContent =
          input.style.textAlign === 'center'
            ? 'center'
            : input.style.textAlign === 'right'
              ? 'flex-end'
              : 'flex-start';
        replacement.style.width = '100%';
        replacement.style.height = '100%';
      }
      input.replaceWith(replacement);
    });
  }

  function bindEvents() {
    if (!root) return;
    const page = pageScope();

    if (page) {
      page.addEventListener('mousedown', (e) => {
        const cell = e.target.closest(
          '#poc-footer-date, #poc-footer-master, .poc-form-footer__date, .poc-form-footer__master',
        );
        if (!cell) return;
        e.preventDefault();
        isDragging = true;
        selectionAnchor = null;
        clearSelection();
        addSelectedCell(cell);
        syncToolbarFromCell(cell);
      });
    }

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
    const scope = pageScope() || root;
    if (!scope) return '';
    const parts = [];
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
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
    if (global.CrewCellAlignToolbar) {
      global.CrewCellAlignToolbar.init({
        getSelectedCells: () => selectedCells,
        showDateFormat: true,
      });
    }
    requestAnimationFrame(() => {
      root?.querySelectorAll('input.ci[data-cell-key]').forEach((el) => reflowCell(el));
    });
  }

  global.PortOfCallFormCells = {
    init,
    collectCellStyles,
    collectCellValues,
    restoreCellStyles,
    restoreCellValues,
    flattenInputsForExport,
    restoreAllCellStyles(cellStyles) {
      document.querySelectorAll('.poc-grid, .poc02-grid').forEach((grid) => {
        restoreCellStyles(cellStyles, grid);
      });
      document.querySelectorAll('.poc-form-footer').forEach((footer) => {
        restoreCellStyles(cellStyles, footer);
      });
    },
    restoreAllCellValues(cellValues, rowsPerPage) {
      const rows = typeof rowsPerPage === 'number' ? rowsPerPage : 11;
      document.querySelectorAll('.a4-page').forEach((pageEl) => {
        const pageIndex = parseInt(pageEl.dataset.page, 10) || 0;
        const voyOffset = pageIndex * rows;
        const grid = pageEl.querySelector('.poc-grid, .poc02-grid');
        if (grid) restoreCellValues(cellValues, grid, voyOffset);
        const footer = pageEl.querySelector('.poc-form-footer');
        if (footer) restoreCellValues(cellValues, footer, voyOffset);
      });
    },
    flattenAllInputsForExport() {
      flattenFooterForExport();
      flattenInputsForExport(document);
    },
    reflowAllWrappedCells() {
      document
        .querySelectorAll('.poc-hdr-val .ci, .poc02-hdr-val .ci, .poc-data-val .ci')
        .forEach((el) => reflowCell(el));
    },
    getSelectedCells: () => selectedCells,
    dismissSelection,
    captureDirtyBaseline,
    isDirty,
    reflowCell,
  };
})(typeof window !== 'undefined' ? window : globalThis);

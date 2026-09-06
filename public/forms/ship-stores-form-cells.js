/**
 * Cell selection, alignment and font formatting for Ship Stores Form 01 HTML editor.
 */
(function (global) {
  let root = null;
  let selectedCells = [];
  let isDragging = false;
  let selectionAnchor = null;
  let dirtyBaseline = null;

  function editableRows() {
    if (!root) return [];
    return Array.from(root.querySelectorAll('#ssd-articles tr, .ssd-tr-h, .ssd-tr-strip'));
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
    return document.getElementById('ss-page') || root?.closest('.ssd-sheet') || root;
  }

  function resolveCell(target) {
    if (!target) return null;
    const footer = target.closest(
      '#f-footer-date, #f-master-name, .form-footer__date, .form-footer__master',
    );
    if (footer && pageScope()?.contains(footer)) return footer;
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
    const qtyHalf = cell.closest('.ssd-qty-half');
    if (qtyHalf) return qtyHalf;
    return cell.closest('.ssd-hdr-val, .ssd-data-val, .ssd-sign-val');
  }

  function qtyAlign(cell) {
    const ta = (cell.style.textAlign || '').trim();
    return ta === 'left' || ta === 'right' || ta === 'center' ? ta : 'center';
  }

  function syncCellFlexAlignment(cell) {
    const ta = cell.style.textAlign || '';
    const wrapper = valWrapper(cell);
    if (wrapper?.classList.contains('ssd-qty-half')) {
      const align = qtyAlign(cell);
      const jc = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
      wrapper.style.justifyContent = jc;
      cell.style.display = 'block';
      cell.style.width = '100%';
      cell.style.textAlign = align;
      return;
    }
    const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
    if (wrapper && cell.classList.contains('ci')) {
      wrapper.style.justifyContent = jc;
      cell.style.display = 'block';
      return;
    }
    if (cell.style.display === 'flex') {
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
    const wrapper = valWrapper(cell);
    if (wrapper?.classList.contains('ssd-qty-half')) {
      wrapper.style.removeProperty('justify-content');
    }
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

  function isFooterField(input) {
    return (
      input.classList.contains('ci-footer') ||
      input.classList.contains('form-footer__date') ||
      input.classList.contains('form-footer__master') ||
      input.dataset.cellKey === 'footer-date' ||
      input.dataset.cellKey === 'footer-master'
    );
  }

  function styleRecord(el) {
    if (global.CrewCellFormat?.readStyle) return global.CrewCellFormat.readStyle(el);
    if (!el) return null;
    const style = {};
    if (el.style.fontFamily) style.fontFamily = el.style.fontFamily;
    if (el.style.fontSize) style.fontSize = el.style.fontSize;
    if (el.style.fontWeight) style.fontWeight = el.style.fontWeight;
    if (el.style.fontStyle) style.fontStyle = el.style.fontStyle;
    if (el.style.textDecoration) style.textDecoration = el.style.textDecoration;
    if (el.style.textAlign) style.textAlign = el.style.textAlign;
    return Object.keys(style).length ? style : null;
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
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      const key = el.dataset.cellKey;
      const style = styleRecord(el);
      if (key && style) cellStyles[key] = style;
    });
    return cellStyles;
  }

  function collectCellValues() {
    const scope = pageScope() || root;
    if (!scope) return {};
    const cellValues = {};
    scope.querySelectorAll('input.ci[data-cell-key]').forEach((el) => {
      const key = el.dataset.cellKey;
      if (key) cellValues[key] = cellText(el);
    });
    return cellValues;
  }

  function restoreCellValues(cellValues, scopeEl) {
    const scope = scopeEl || pageScope() || root;
    if (!scope || !cellValues) return;
    scope.querySelectorAll('input.ci[data-cell-key]').forEach((el) => {
      const key = el.dataset.cellKey;
      if (!key || cellValues[key] === undefined) return;
      setCellValue(el, cellValues[key]);
      reflowCell(el);
    });
  }

  function restoreCellStyles(cellStyles, scopeEl) {
    const scope = scopeEl || pageScope() || root;
    if (!scope || !cellStyles) return;
    scope.querySelectorAll('input.ci[data-cell-key], div.ci[data-cell-key]').forEach((el) => {
      const style = cellStyles[el.dataset.cellKey];
      if (!style) return;
      if (global.CrewCellFormat?.applyStyle) {
        global.CrewCellFormat.applyStyle(el, style);
      } else {
        if (style.fontFamily) el.style.fontFamily = style.fontFamily;
        if (style.fontSize) el.style.fontSize = style.fontSize;
        if (style.fontWeight) el.style.fontWeight = style.fontWeight;
        if (style.fontStyle) el.style.fontStyle = style.fontStyle;
        if (style.textDecoration) el.style.textDecoration = style.textDecoration;
        if (style.textAlign) el.style.textAlign = style.textAlign;
      }
      reflowCell(el);
    });
  }

  function isFooterMaster(input) {
    return (
      input.classList.contains('form-footer__master') || input.dataset.cellKey === 'footer-master'
    );
  }

  function applyFooterExportStyles(replacement, input) {
    replacement.style.cssText = input.style.cssText;
    replacement.style.display = 'block';
    replacement.style.height = 'auto';
    replacement.style.minHeight = '0';
    replacement.style.overflow = 'visible';
    replacement.style.whiteSpace = 'nowrap';
    replacement.style.background = 'transparent';
    replacement.style.fontWeight = '700';
    if (isFooterMaster(input)) {
      replacement.style.border = 'none';
      replacement.style.borderBottom = '1px solid #000';
      replacement.style.textAlign = input.style.textAlign || 'center';
      replacement.style.padding = '0 2px 1px';
    } else {
      replacement.style.border = 'none';
    }
  }

  function flattenInputsForExport(scopeEl) {
    const scope = scopeEl || pageScope() || root || document;
    if (!scope) return;
    scope.querySelectorAll('input.ci').forEach((input) => {
      const replacement = document.createElement('div');
      replacement.className = input.className;
      replacement.textContent = input.value || '';
      replacement.style.border = 'none';
      replacement.style.background = 'transparent';
      replacement.style.overflow = 'hidden';

      const half = input.closest('.ssd-qty-half');
      const wrapper = valWrapper(input);
      if (half) {
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.lineHeight = '1.15';
        replacement.style.padding = '0';
        replacement.style.margin = '0';
        replacement.style.whiteSpace = 'nowrap';
        replacement.style.fontWeight = '700';
        if (input.style.fontSize) replacement.style.fontSize = input.style.fontSize;
        if (input.style.fontFamily) replacement.style.fontFamily = input.style.fontFamily;
        if (global.CrewCellFormat?.copyEmphasis) global.CrewCellFormat.copyEmphasis(input, replacement);
        else {
          if (input.style.fontStyle) replacement.style.fontStyle = input.style.fontStyle;
          if (input.style.textDecoration) replacement.style.textDecoration = input.style.textDecoration;
        }
        replacement.style.fontWeight = '700';
        replacement.style.textAlign = qtyAlign(input);
      } else if (wrapper) {
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.lineHeight = 'normal';
        replacement.style.padding = '0';
        replacement.style.margin = '0';
        replacement.style.textOverflow = 'ellipsis';
        replacement.style.whiteSpace = 'nowrap';
        replacement.style.textAlign = input.style.textAlign || 'center';
        if (global.CrewCellFormat?.copyEmphasis) global.CrewCellFormat.copyEmphasis(input, replacement);
        else {
          if (input.style.fontStyle) replacement.style.fontStyle = input.style.fontStyle;
          if (input.style.textDecoration) replacement.style.textDecoration = input.style.textDecoration;
        }
        replacement.style.fontWeight = '700';
      } else if (isFooterField(input)) {
        applyFooterExportStyles(replacement, input);
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
          '#f-footer-date, #f-master-name, .form-footer__date, .form-footer__master',
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
      if (e.target.closest('#ss-page, .ssd-sheet, .a4-page')) return;
      if (e.target.closest('.side-panel')) return;
      if (e.target.closest('.confirm-backdrop')) return;
      dismissSelection();
    });
  }

  function captureDirtySnapshot() {
    const scope = pageScope() || root;
    if (!scope) return '';
    const parts = [];
    scope.querySelectorAll('input.ci[data-cell-key]').forEach((el) => {
      parts.push({
        k: el.dataset.cellKey,
        v: cellText(el),
        s: styleRecord(el),
      });
    });
    return JSON.stringify(parts);
  }

  function resetCellStyles(scopeEl) {
    const scope = scopeEl || pageScope() || root;
    if (!scope) return;
    scope.querySelectorAll('.ci').forEach((cell) => {
      cell.style.removeProperty('font-family');
      cell.style.removeProperty('font-size');
      cell.style.removeProperty('text-align');
      cell.classList.remove('selected');
      reflowCell(cell);
    });
    dismissSelection();
    const fontSel = document.getElementById('tb-font');
    const sizeSel = document.getElementById('tb-size');
    if (fontSel) fontSel.value = 'Arial';
    if (sizeSel) sizeSel.value = '8';
    if (global.CrewCellAlignToolbar?.syncSelection) global.CrewCellAlignToolbar.syncSelection();
  }

  function captureDirtyBaseline() {
    pageScope()
      ?.querySelectorAll('input.ci[data-cell-key]')
      .forEach((el) => reflowCell(el));
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
        showDateFormat: false,
      });
    }
    requestAnimationFrame(() => {
      pageScope()?.querySelectorAll('input.ci[data-cell-key]').forEach((el) => reflowCell(el));
    });
  }

  global.ShipStoresFormCells = {
    init,
    collectCellStyles,
    collectCellValues,
    restoreCellStyles,
    restoreCellValues,
    flattenInputsForExport,
    reflowAllWrappedCells() {
      document
        .querySelectorAll('.ssd-hdr-val .ci, .ssd-data-val .ci, .ssd-sign-val .ci, .ssd-qty-half .ci')
        .forEach((el) => reflowCell(el));
    },
    getSelectedCells: () => selectedCells,
    dismissSelection,
    resetCellStyles,
    captureDirtyBaseline,
    isDirty,
    reflowCell,
  };
})(typeof window !== 'undefined' ? window : globalThis);

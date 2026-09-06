/**
 * Cell selection, alignment and font formatting for Crew Effect Form 01 HTML editor.
 */
(function (global) {
  let root = null;
  let selectedCells = [];
  let isDragging = false;
  let selectionAnchor = null;
  let dirtyBaseline = null;

  function editableRows() {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll('#ced-crew tr.ced-tr-data, .ced-tr-t, .ced-tr-n, .ced-tr-h'),
    );
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
    return document.getElementById('ce-page') || root?.closest('.ced-sheet') || root;
  }

  function resolveCell(target) {
    if (!target) return null;
    const outside = target.closest(
      '#f-footer-date, #f-master-name, .form-footer__date, .form-footer__master, #ced-page-no-input, [data-cell-key="h-pageNo"]',
    );
    if (outside && pageScope()?.contains(outside)) return outside;
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
    return cell.closest('.ced-hdr-val, .ced-data-val');
  }

  function normalizeTextAlign(value) {
    const ta = String(value || '').trim().toLowerCase();
    if (ta === 'center' || ta === 'right' || ta === 'left') return ta;
    if (ta === 'start') return 'left';
    if (ta === 'end') return 'right';
    return '';
  }

  function columnDefaultTextAlign(wrapper) {
    if (!wrapper) return '';
    if (wrapper.classList.contains('ced-data-val--center')) return 'center';
    if (wrapper.classList.contains('ced-data-val')) return 'left';
    return '';
  }

  /** Resolve alignment for PDF export (column class, CSS, wrapper flex, saved inline). */
  function effectiveCellTextAlign(input, wrapper) {
    const inline = normalizeTextAlign(input.style.textAlign);
    if (inline) return inline;

    const columnDefault = columnDefaultTextAlign(wrapper);
    if (columnDefault) return columnDefault;

    const computed = normalizeTextAlign(window.getComputedStyle(input).textAlign);
    if (computed) return computed;

    if (wrapper) {
      if (wrapper.classList.contains('ced-hdr-val')) return 'center';
      const jc = (wrapper.style.justifyContent || window.getComputedStyle(wrapper).justifyContent || '')
        .trim()
        .toLowerCase();
      if (jc === 'center') return 'center';
      if (jc === 'flex-end' || jc === 'end') return 'right';
      if (jc === 'flex-start' || jc === 'start') return 'left';
      return 'left';
    }

    return 'left';
  }

  function syncCellFlexAlignment(cell) {
    const wrapper = valWrapper(cell);
    const ta =
      normalizeTextAlign(cell.style.textAlign) || columnDefaultTextAlign(wrapper) || 'left';
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
      input.classList.contains('form-footer__date') ||
      input.classList.contains('form-footer__master') ||
      input.dataset.cellKey === 'footer-date' ||
      input.dataset.cellKey === 'footer-master'
    );
  }

  function styleRecord(el) {
    if (global.CrewCellFormat?.readStyle) {
      const base = global.CrewCellFormat.readStyle(el);
      if (!el) return base;
      // Prefer effective text-align for wrapped header/footer cells.
      const style = base ? { ...base } : {};
      const ta = normalizeTextAlign(el.style.textAlign) || effectiveCellTextAlign(el, valWrapper(el));
      if (ta) style.textAlign = ta;
      else delete style.textAlign;
      return Object.keys(style).length ? style : null;
    }
    if (!el) return null;
    const style = {};
    if (el.style.fontFamily) style.fontFamily = el.style.fontFamily;
    if (el.style.fontSize) style.fontSize = el.style.fontSize;
    if (el.style.fontWeight) style.fontWeight = el.style.fontWeight;
    if (el.style.fontStyle) style.fontStyle = el.style.fontStyle;
    if (el.style.textDecoration) style.textDecoration = el.style.textDecoration;
    const ta = normalizeTextAlign(el.style.textAlign) || effectiveCellTextAlign(el, valWrapper(el));
    if (ta) style.textAlign = ta;
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
      replacement.style.textAlign = effectiveCellTextAlign(input, valWrapper(input));
      replacement.style.padding = '0 2px 1px';
    } else {
      replacement.style.border = 'none';
    }
  }

  function applyExportTextAlign(el, align) {
    const ta = normalizeTextAlign(align) || 'left';
    el.dataset.align = ta;
    el.style.setProperty('text-align', ta, 'important');
  }

  function exportFontWeight(input) {
    if (input.classList.contains('ci-hdr')) return '700';
    if (isFooterField(input) || isFooterMaster(input)) return '700';
    const inline = (input.style.fontWeight || '').trim();
    if (inline && inline !== 'inherit' && inline !== 'normal') return inline;
    const computed = window.getComputedStyle(input).fontWeight;
    if (computed && computed !== 'inherit' && computed !== 'normal') return computed;
    return '400';
  }

  function applyExportFontStyles(replacement, input) {
    replacement.style.fontWeight = exportFontWeight(input);
    if (input.style.fontFamily) replacement.style.fontFamily = input.style.fontFamily;
    if (input.style.fontSize) replacement.style.fontSize = input.style.fontSize;
    else if (!input.style.fontSize && input.classList.contains('ci')) {
      replacement.style.fontSize = window.getComputedStyle(input).fontSize;
    }
    if (global.CrewCellFormat?.copyEmphasis) {
      global.CrewCellFormat.copyEmphasis(input, replacement);
      // Keep exportFontWeight preference (headers/footers stay bold).
      replacement.style.fontWeight = exportFontWeight(input);
    } else {
      if (input.style.fontStyle) replacement.style.fontStyle = input.style.fontStyle;
      if (input.style.textDecoration) replacement.style.textDecoration = input.style.textDecoration;
    }
  }

  function applyExportCellAlignment(scopeEl) {
    const scope = scopeEl || pageScope() || root || document;
    if (!scope) return;
    scope.querySelectorAll('input.ci').forEach((input) => {
      applyExportTextAlign(input, effectiveCellTextAlign(input, valWrapper(input)));
    });
  }

  function flattenInputsForExport(scopeEl) {
    const scope = scopeEl || pageScope() || root || document;
    if (!scope) return;
    applyExportCellAlignment(scope);
    scope.querySelectorAll('input.ci').forEach((input) => {
      const replacement = document.createElement('div');
      replacement.className = input.className;
      if (input.dataset.cellKey) replacement.dataset.cellKey = input.dataset.cellKey;
      replacement.textContent = input.value || '';
      replacement.style.border = 'none';
      replacement.style.background = 'transparent';
      replacement.style.overflow = 'hidden';

      const wrapper = valWrapper(input);
      if (wrapper) {
        const ta = effectiveCellTextAlign(input, wrapper);
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.lineHeight = 'normal';
        replacement.style.padding = '0';
        replacement.style.margin = '0';
        replacement.style.textOverflow = 'ellipsis';
        replacement.style.whiteSpace = 'nowrap';
        applyExportTextAlign(replacement, ta);
        applyExportFontStyles(replacement, input);
      } else if (isFooterField(input)) {
        applyFooterExportStyles(replacement, input);
        applyExportTextAlign(replacement, effectiveCellTextAlign(input, valWrapper(input)));
      } else {
        const ta = effectiveCellTextAlign(input, null);
        replacement.style.cssText = input.style.cssText;
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.height = '100%';
        applyExportTextAlign(replacement, ta);
        replacement.style.whiteSpace = 'nowrap';
        replacement.style.overflow = 'hidden';
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
          '#f-footer-date, #f-master-name, .form-footer__date, .form-footer__master, #ced-page-no-input, [data-cell-key="h-pageNo"]',
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
      if (e.target.closest('#ce-page, .ced-sheet, .a4-page')) return;
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

  global.CrewEffectFormCells = {
    init,
    collectCellStyles,
    collectCellValues,
    restoreCellStyles,
    restoreCellValues,
    flattenInputsForExport,
    applyExportCellAlignment,
    reflowAllWrappedCells() {
      document
        .querySelectorAll('.ced-hdr-val .ci, .ced-data-val .ci')
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

/**
 * Header value selection and formatting for HTML form editors (crew / passenger lists).
 * Same UX as Port of Call header cells: select ship/port/date fields → font / size / align toolbar.
 */
(function (global) {
  let scopeEl = null;
  let selectedCells = [];
  let isDragging = false;
  let selectionAnchor = null;
  let beforeHeaderSelect = null;
  let syncToolbarFromCell = null;

  const FIELD_SELECTOR =
    'input.fi[id^="h-"], #f-footer-date, #f-master-name, #poc-footer-date, #poc-footer-master, .poc-form-footer__date, .poc-form-footer__master';

  function headerFields() {
    if (!scopeEl) return [];
    return Array.from(scopeEl.querySelectorAll(FIELD_SELECTOR));
  }

  function fieldIndex(cell) {
    return headerFields().indexOf(cell);
  }

  function hdrValWrapper(cell) {
    return cell.closest('.h-val');
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

  function syncCellFlexAlignment(cell) {
    const ta = cell.style.textAlign || '';
    const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
    const hdrVal = hdrValWrapper(cell);
    if (hdrVal) {
      hdrVal.style.display = 'flex';
      hdrVal.style.justifyContent = jc;
      cell.style.display = 'block';
      cell.style.width = '100%';
      return;
    }
    cell.style.display = 'flex';
    cell.style.justifyContent = jc;
    cell.style.alignItems = cell.style.alignItems || 'center';
    cell.style.width = '100%';
  }

  function applyVerticalAlignToCell(cell, val) {
    const alignItems = val === 'top' ? 'flex-start' : val === 'bottom' ? 'flex-end' : 'center';
    const hdrVal = hdrValWrapper(cell);
    if (hdrVal) {
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

  function clearSelection() {
    selectedCells.forEach((c) => c.classList.remove('selected'));
    selectedCells = [];
    if (global.CrewCellAlignToolbar?.syncSelection) global.CrewCellAlignToolbar.syncSelection();
  }

  function addSelectedCell(cell) {
    if (!cell || selectedCells.includes(cell)) return;
    selectedCells.push(cell);
    cell.classList.add('selected');
  }

  function selectRange(i1, i2) {
    clearSelection();
    const fields = headerFields();
    const iMin = Math.min(i1, i2);
    const iMax = Math.max(i1, i2);
    for (let i = iMin; i <= iMax; i++) {
      addSelectedCell(fields[i]);
    }
    if (global.CrewCellAlignToolbar?.syncSelection) global.CrewCellAlignToolbar.syncSelection();
  }

  function prepareFields() {
    headerFields().forEach((el) => {
      el.classList.add('ci', 'ci-hdr');
      if (el.id) el.dataset.cellKey = el.id;
      el.tabIndex = -1;
    });
  }

  function bindEvents() {
    if (!scopeEl) return;

    scopeEl.addEventListener('mousedown', (e) => {
      const cell = e.target.closest(FIELD_SELECTOR);
      if (!cell || !scopeEl.contains(cell)) return;
      e.preventDefault();
      if (typeof beforeHeaderSelect === 'function') beforeHeaderSelect();
      isDragging = true;
      selectionAnchor = fieldIndex(cell);
      selectRange(selectionAnchor, selectionAnchor);
      if (typeof syncToolbarFromCell === 'function') syncToolbarFromCell(cell);
    });

    scopeEl.addEventListener('mouseover', (e) => {
      if (!isDragging || selectionAnchor === null) return;
      const cell = e.target.closest(FIELD_SELECTOR);
      if (!cell || !scopeEl.contains(cell)) return;
      selectRange(selectionAnchor, fieldIndex(cell));
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function init(options = {}) {
    const scope = options.scope || '.a4-page';
    scopeEl = typeof scope === 'string' ? document.querySelector(scope) : scope;
    beforeHeaderSelect = options.beforeHeaderSelect || null;
    syncToolbarFromCell = options.syncToolbarFromCell || null;
    prepareFields();
    bindEvents();
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

  function collectStyles() {
    const cellStyles = {};
    headerFields().forEach((el) => {
      const key = el.id || el.dataset.cellKey;
      const style = styleRecord(el);
      if (key && style) cellStyles[key] = style;
    });
    return cellStyles;
  }

  function restoreStyles(cellStyles) {
    if (!cellStyles) return;
    headerFields().forEach((el) => {
      const key = el.id || el.dataset.cellKey;
      const style = key ? cellStyles[key] : null;
      if (!style) return;
      if (style.fontFamily) el.style.fontFamily = style.fontFamily;
      if (style.fontSize) el.style.fontSize = style.fontSize;
      if (style.textAlign) el.style.textAlign = style.textAlign;
      if (style.verticalAlign) applyVerticalAlignToCell(el, style.verticalAlign);
      else if (style.textAlign) syncCellFlexAlignment(el);
    });
  }

  function resetAll() {
    headerFields().forEach((cell) => {
      cell.style.removeProperty('font-family');
      cell.style.removeProperty('font-size');
      cell.style.removeProperty('text-align');
      cell.style.removeProperty('display');
      cell.style.removeProperty('align-items');
      cell.style.removeProperty('height');
      cell.style.removeProperty('justify-content');
      cell.style.removeProperty('width');
      delete cell.dataset.verticalAlign;
      const hdrVal = hdrValWrapper(cell);
      if (hdrVal) {
        hdrVal.style.removeProperty('display');
        hdrVal.style.removeProperty('align-items');
        hdrVal.style.removeProperty('justify-content');
      }
    });
    clearSelection();
  }

  global.HtmlFormHeaderCells = {
    init,
    getSelected: () => selectedCells,
    clearSelection,
    applyFormat,
    applyVerticalAlign,
    collectStyles,
    restoreStyles,
    resetAll,
  };
})(typeof window !== 'undefined' ? window : globalThis);

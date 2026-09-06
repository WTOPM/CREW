/**
 * Tracks whether an HTML form editor has unsaved edits.
 * Compares a baseline snapshot (captured after load) with the current DOM state.
 */
(function (global) {
  let baseline = null;
  let overlayBaseline = null;
  let extraBaseline = null;

  function styleRecord(el) {
    if (global.CrewCellFormat?.readStyle) return global.CrewCellFormat.readStyle(el);
    if (!el) return null;
    const style = {};
    if (el.style.fontFamily) style.fontFamily = el.style.fontFamily;
    if (el.style.fontSize) style.fontSize = el.style.fontSize;
    if (el.style.textAlign) style.textAlign = el.style.textAlign;
    if (el.style.fontWeight) style.fontWeight = el.style.fontWeight;
    if (el.style.fontStyle) style.fontStyle = el.style.fontStyle;
    if (el.style.textDecoration) style.textDecoration = el.style.textDecoration;
    if (el.dataset.verticalAlign) style.verticalAlign = el.dataset.verticalAlign;
    return Object.keys(style).length ? style : null;
  }

  function collectHeaderCellStyles() {
    if (global.HtmlFormHeaderCells?.collectStyles) {
      return global.HtmlFormHeaderCells.collectStyles();
    }
    const cellStyles = {};
    document
      .querySelectorAll(
        '.a4-page input.fi.ci-hdr[id^="h-"], .a4-landscape-page input.fi.ci-hdr[id^="h-"]',
      )
      .forEach((el) => {
        const style = styleRecord(el);
        if (el.id && style) cellStyles[el.id] = style;
      });
    return cellStyles;
  }

  function collectHeaderValues() {
    if (global.HtmlFormHeaderCells?.collectValues) {
      return global.HtmlFormHeaderCells.collectValues();
    }
    const values = {};
    document
      .querySelectorAll(
        '.a4-page input.fi[id^="h-"], .a4-landscape-page input.fi[id^="h-"], #f-footer-date, #f-master-name',
      )
      .forEach((el) => {
        const key = el.id;
        if (!key) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') values[key] = el.value || '';
        else values[key] = (el.textContent || '').trim();
      });
    return values;
  }

  function collectCellStyles(root) {
    const cellStyles = collectHeaderCellStyles();
    if (!root) return cellStyles;
    Array.from(root.children).forEach((row, rowIndex) => {
      row.querySelectorAll('input.ci').forEach((input, colIndex) => {
        const style = styleRecord(input);
        if (style) cellStyles[`${rowIndex}-${colIndex}`] = style;
      });
      const nameStyle = styleRecord(row.querySelector('.ci-name'));
      if (nameStyle) cellStyles[`${rowIndex}-name`] = nameStyle;
    });
    return cellStyles;
  }

  function collectTableRows(root) {
    if (!root) return [];
    return Array.from(root.children).map((row) => ({
      inputs: Array.from(row.querySelectorAll('input.ci')).map((input) => input.value),
      name: (row.querySelector('.ci-name')?.textContent || '').trim(),
    }));
  }

  function normalizeOverlay(raw) {
    const o = raw || {};
    const stamp = o.stamp || {};
    const sig = o.sig || {};
    return {
      stamp: {
        visible: !!stamp.visible,
        left: stamp.left || '',
        top: stamp.top || '',
        width: stamp.width || '',
        height: stamp.height || '',
      },
      sig: {
        visible: !!sig.visible,
        left: sig.left || '',
        top: sig.top || '',
        width: sig.width || '',
        height: sig.height || '',
      },
    };
  }

  /**
   * @param {object} options
   * @param {() => HTMLElement} options.getTableRoot
   * @param {() => void} [options.beforeSnapshot]
   * @param {() => object} [options.loadPositions]
   * @param {string} [options.footerDateId]
   */
  function snapshot(options) {
    if (options.beforeSnapshot) options.beforeSnapshot();
    const root = typeof options.getTableRoot === 'function' ? options.getTableRoot() : null;
    const positions =
      typeof options.loadPositions === 'function' ? options.loadPositions() : {};
    const footerDateId = options.footerDateId || 'f-footer-date';
    const footerDate = document.getElementById(footerDateId)?.value ?? '';
    return JSON.stringify({
      rows: collectTableRows(root),
      cellStyles: collectCellStyles(root),
      headerValues: collectHeaderValues(),
      overlay: normalizeOverlay(positions),
      footerDate,
    });
  }

  function captureBaseline(options) {
    baseline = snapshot(options);
  }

  function isDirty(options) {
    if (!baseline) return false;
    return snapshot(options) !== baseline;
  }

  function resetBaseline(options) {
    captureBaseline(options);
  }

  /** Overlay / chrome dirty tracking for editors that manage stamp/sig themselves. */
  function captureOverlayBaseline(getPositions, extra) {
    const positions = typeof getPositions === 'function' ? getPositions() : getPositions || {};
    overlayBaseline = JSON.stringify(normalizeOverlay(positions));
    extraBaseline = extra === undefined ? null : JSON.stringify(extra);
  }

  function isOverlayDirty(getPositions, extra) {
    if (overlayBaseline === null) return false;
    const positions = typeof getPositions === 'function' ? getPositions() : getPositions || {};
    if (JSON.stringify(normalizeOverlay(positions)) !== overlayBaseline) return true;
    if (extraBaseline !== null) {
      return JSON.stringify(extra === undefined ? null : extra) !== extraBaseline;
    }
    return false;
  }

  global.CrewHtmlFormEditorDirty = {
    captureBaseline,
    isDirty,
    resetBaseline,
    captureOverlayBaseline,
    isOverlayDirty,
    normalizeOverlay,
  };
})(typeof window !== 'undefined' ? window : globalThis);

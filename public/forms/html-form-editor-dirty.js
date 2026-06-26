/**
 * Tracks whether an HTML form editor (03/04/05) has unsaved edits.
 * Compares a baseline snapshot (captured after load) with the current DOM state.
 */
(function (global) {
  let baseline = null;

  function styleRecord(el) {
    if (!el) return null;
    const style = {};
    if (el.style.fontFamily) style.fontFamily = el.style.fontFamily;
    if (el.style.fontSize) style.fontSize = el.style.fontSize;
    if (el.style.textAlign) style.textAlign = el.style.textAlign;
    if (el.dataset.verticalAlign) style.verticalAlign = el.dataset.verticalAlign;
    return Object.keys(style).length ? style : null;
  }

  function collectCellStyles(root) {
    const cellStyles = {};
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

  global.CrewHtmlFormEditorDirty = {
    captureBaseline,
    isDirty,
    resetBaseline,
  };
})(typeof window !== 'undefined' ? window : globalThis);

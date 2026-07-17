/**
 * Persist / restore table cell text for crew & passenger HTML list editors.
 * Keys match cellStyles: `${row}-${col}` for input.ci, `${row}-name` for .ci-name.
 * Call restore AFTER live crew/passenger data is written into the table.
 */
(function (global) {
  function cellText(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';
    return (el.textContent || '').trim();
  }

  function setCellText(el, text) {
    if (!el) return;
    const value = text == null ? '' : String(text);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = value;
    else el.textContent = value;
  }

  /**
   * @param {HTMLElement|null} tbody
   * @returns {Record<string, string>}
   */
  function collectValues(tbody) {
    const cellValues = {};
    if (!tbody) return cellValues;
    Array.from(tbody.children).forEach((tr, rowIndex) => {
      if (!tr || tr.tagName !== 'TR') return;
      tr.querySelectorAll('input.ci').forEach((input, colIndex) => {
        cellValues[`${rowIndex}-${colIndex}`] = cellText(input);
      });
      const nameCell = tr.querySelector('.ci-name');
      if (nameCell) cellValues[`${rowIndex}-name`] = cellText(nameCell);
    });
    return cellValues;
  }

  /**
   * @param {HTMLElement|null} tbody
   * @param {Record<string, string>|null|undefined} cellValues
   */
  function restoreValues(tbody, cellValues) {
    if (!tbody || !cellValues || typeof cellValues !== 'object') return;
    Array.from(tbody.children).forEach((tr, rowIndex) => {
      if (!tr || tr.tagName !== 'TR') return;
      tr.querySelectorAll('input.ci').forEach((input, colIndex) => {
        const key = `${rowIndex}-${colIndex}`;
        if (Object.prototype.hasOwnProperty.call(cellValues, key)) {
          setCellText(input, cellValues[key]);
        }
      });
      const nameCell = tr.querySelector('.ci-name');
      const nameKey = `${rowIndex}-name`;
      if (nameCell && Object.prototype.hasOwnProperty.call(cellValues, nameKey)) {
        setCellText(nameCell, cellValues[nameKey]);
      }
    });
  }

  global.HtmlFormListCellPersist = { collectValues, restoreValues };
})(typeof window !== 'undefined' ? window : globalThis);

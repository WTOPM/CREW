/**
 * Persist / restore table cell text for crew & passenger HTML list editors.
 * Keys match cellStyles: `${row}-${col}` for data input.ci (birth-place excluded from
 * the sequential index), `${row}-name` for .ci-name, `${row}-pob` for .ci-birth-place,
 * `${row}-rno` for manual row numbers.
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

  function currentCellText(el) {
    return cellText(el);
  }

  /** Collapse whitespace/newlines so Alt+Enter wraps still match live crew text. */
  function normalizeComparable(text) {
    return String(text == null ? '' : text)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Apply a persisted edit without freezing the form to a prior Save.
   * Live crew/ship text from the home page always wins when content differs.
   * Saved text is applied only when it is the same content (preserves Alt+Enter wraps).
   * Empty live cells stay empty (no resurrecting deleted/padded crew rows).
   */
  function applySavedText(el, saved) {
    if (!el) return;
    const next = saved == null ? '' : String(saved);
    const cur = currentCellText(el);
    if (!next.trim() && cur.trim()) return;
    if (!cur.trim()) return;
    if (normalizeComparable(cur) !== normalizeComparable(next)) return;
    setCellText(el, next);
  }

  function isBirthPlaceInput(el) {
    return !!el?.classList?.contains('ci-birth-place');
  }

  function isBirthDateInput(el) {
    return !!el?.classList?.contains('ci-birth-date');
  }

  /**
   * Legacy forms saved "DD.MM.YYYY  Place" in the single birth column.
   * After the date|place split, only the date belongs in .ci-birth-date.
   * @returns {{ date: string, place: string }}
   */
  function splitLegacyBirthCombined(text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return { date: '', place: '' };
    const m = raw.match(
      /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+)$/,
    );
    if (m) return { date: m[1], place: m[2].trim() };
    return { date: raw, place: '' };
  }

  /** Data inputs in column order — excludes the secondary birth-place field. */
  function dataInputs(row) {
    if (!row) return [];
    return Array.from(row.querySelectorAll('input.ci, textarea.ci')).filter(
      (el) => !isBirthPlaceInput(el),
    );
  }

  function rowElements(root) {
    if (!root) return [];
    return Array.from(root.children).filter(
      (el) => el && (el.tagName === 'TR' || el.classList.contains('table-row')),
    );
  }

  /**
   * @param {HTMLElement|null} tbody
   * @returns {Record<string, string>}
   */
  function collectValues(tbody) {
    const cellValues = {};
    rowElements(tbody).forEach((tr, rowIndex) => {
      dataInputs(tr).forEach((input, colIndex) => {
        let value = cellText(input);
        if (isBirthDateInput(input)) {
          value = splitLegacyBirthCombined(value).date;
        }
        cellValues[`${rowIndex}-${colIndex}`] = value;
      });
      const pob = tr.querySelector('.ci-birth-place');
      if (pob) cellValues[`${rowIndex}-pob`] = cellText(pob);
      const nameCell = tr.querySelector('.ci-name');
      if (nameCell) cellValues[`${rowIndex}-name`] = cellText(nameCell);
      const rnoCell = tr.querySelector('.ci-rno');
      if (rnoCell && rnoCell.dataset.manual === '1') {
        cellValues[`${rowIndex}-rno`] = cellText(rnoCell);
        cellValues[`${rowIndex}-rnoManual`] = '1';
      }
    });
    return cellValues;
  }

  /**
   * @param {HTMLElement|null} tbody
   * @param {Record<string, string>|null|undefined} cellValues
   */
  function restoreValues(tbody, cellValues) {
    if (!tbody || !cellValues || typeof cellValues !== 'object') return;
    rowElements(tbody).forEach((tr, rowIndex) => {
      dataInputs(tr).forEach((input, colIndex) => {
        const key = `${rowIndex}-${colIndex}`;
        if (!Object.prototype.hasOwnProperty.call(cellValues, key)) return;
        if (isBirthDateInput(input)) {
          const { date, place } = splitLegacyBirthCombined(cellValues[key]);
          applySavedText(input, date);
          const pob = tr.querySelector('.ci-birth-place');
          const pobKey = `${rowIndex}-pob`;
          // Legacy "date  place" with no separate -pob key yet: apply both halves.
          if (
            pob &&
            place &&
            !Object.prototype.hasOwnProperty.call(cellValues, pobKey)
          ) {
            applySavedText(pob, place);
          }
          return;
        }
        applySavedText(input, cellValues[key]);
      });
      const pob = tr.querySelector('.ci-birth-place');
      const pobKey = `${rowIndex}-pob`;
      if (pob && Object.prototype.hasOwnProperty.call(cellValues, pobKey)) {
        applySavedText(pob, cellValues[pobKey]);
      }
      const nameCell = tr.querySelector('.ci-name');
      const nameKey = `${rowIndex}-name`;
      if (nameCell && Object.prototype.hasOwnProperty.call(cellValues, nameKey)) {
        applySavedText(nameCell, cellValues[nameKey]);
      }
      const rnoCell = tr.querySelector('.ci-rno');
      const rnoKey = `${rowIndex}-rno`;
      if (
        rnoCell &&
        cellValues[`${rowIndex}-rnoManual`] === '1' &&
        Object.prototype.hasOwnProperty.call(cellValues, rnoKey)
      ) {
        applySavedText(rnoCell, cellValues[rnoKey]);
        rnoCell.dataset.manual = '1';
      }
    });
  }

  global.HtmlFormListCellPersist = {
    collectValues,
    restoreValues,
    dataInputs,
    isBirthPlaceInput,
    cellText,
    splitLegacyBirthCombined,
  };
})(typeof window !== 'undefined' ? window : globalThis);

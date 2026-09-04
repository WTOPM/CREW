/**
 * Icon alignment toolbar with tooltips. Changes apply on click to selected cells only.
 * Expects global applyFormat from each form editor script.
 */
(function () {
  const ICONS = {
    hLeft:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h11M2 8h7M2 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    hCenter:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4h11M4.5 8h7M2.5 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    hRight:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4h11M7 8h7M3 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
  };

  const BUTTONS = [
    { value: 'left', tip: 'Align left', icon: 'hLeft' },
    { value: 'center', tip: 'Align center', icon: 'hCenter' },
    { value: 'right', tip: 'Align right', icon: 'hRight' },
  ];

  /** Row № cells support align/font; letter-case tools still skip them. */
  function alignableCells(getSelectedCells) {
    return getSelectedCells() || [];
  }

  function editableCells(getSelectedCells) {
    return (getSelectedCells() || []).filter((cell) => !cell.classList.contains('ci-rno'));
  }

  function cellText(cell) {
    if (!cell) return '';
    if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') return cell.value || '';
    return cell.textContent || '';
  }

  function setCellText(cell, text) {
    if (!cell) return;
    if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') cell.value = text;
    else cell.textContent = text;
  }

  function toAllCaps(text) {
    return String(text).toUpperCase();
  }

  /** First letter upper, rest lower; each word capitalised (e.g. "john smith" → "John Smith"). */
  function toTitleCase(text) {
    return String(text).replace(/\S+/g, (word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    });
  }

  function transformCellCase(cell, mode) {
    const text = cellText(cell);
    if (!text) return;
    if (mode === 'upper') setCellText(cell, toAllCaps(text));
    else if (mode === 'title') setCellText(cell, toTitleCase(text));
    reflowCellAfterTextChange(cell);
  }

  function reflowCellAfterTextChange(cell) {
    if (window.PortOfCallFormCells?.reflowCell) {
      window.PortOfCallFormCells.reflowCell(cell);
      return;
    }
    if (cell.tagName === 'INPUT' && cell.classList.contains('ci')) {
      cell.style.removeProperty('display');
      cell.style.removeProperty('align-items');
      cell.style.removeProperty('justify-content');
      cell.style.removeProperty('height');
    }
  }

  function applyCellCase(mode, getSelectedCells) {
    editableCells(getSelectedCells).forEach((cell) => transformCellCase(cell, mode));
  }

  function readHorizontalAlign(cell) {
    const ta = (cell.style.textAlign || '').toLowerCase();
    if (ta === 'start') return 'left';
    if (ta === 'end') return 'right';
    if (ta === 'center' || ta === 'right' || ta === 'left') return ta;
    const jc = (cell.style.justifyContent || '').toLowerCase();
    if (jc === 'center') return 'center';
    if (jc === 'flex-end' || jc === 'end') return 'right';
    if (jc === 'flex-start') return 'left';
    if (cell.classList.contains('ci-rno')) return 'center';
    return 'left';
  }

  function unanimous(values) {
    if (!values.length) return undefined;
    const first = values[0];
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] !== first) return undefined;
    }
    return first;
  }

  function syncActiveButtons(mount, getSelectedCells) {
    const cells = alignableCells(getSelectedCells);
    mount.querySelectorAll('.cell-align-toolbar__btn[data-value]').forEach((btn) => {
      btn.classList.remove('cell-align-toolbar__btn--active');
      btn.removeAttribute('aria-pressed');
    });
    if (!cells.length) return;

    const h = unanimous(cells.map(readHorizontalAlign));

    mount.querySelectorAll('.cell-align-toolbar__btn[data-value]').forEach((btn) => {
      if (h === btn.dataset.value) {
        btn.classList.add('cell-align-toolbar__btn--active');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  }

  let toolbarMount = null;
  let toolbarGetSelectedCells = () => [];

  let toolbarShowDateFormat = false;

  function syncSelection() {
    if (!toolbarMount) return;
    syncActiveButtons(toolbarMount, toolbarGetSelectedCells);
    if (toolbarShowDateFormat) syncDateFormatButton(toolbarMount);
  }

  function applyHorizontal(value) {
    if (typeof applyFormat === 'function') applyFormat('textAlign', value);
  }

  function renderToolbar(mount, showDateFormat) {
    const dateRow = showDateFormat
      ? `
      <div class="cell-align-toolbar__row cell-align-toolbar__row--date" role="group" aria-label="Date display format">
        <button type="button"
          class="cell-align-toolbar__btn cell-align-toolbar__btn--text cell-align-toolbar__btn--date"
          data-date-format-cycle
          data-tip="Change date format"
          aria-label="Change date format">16.06</button>
      </div>`
      : '';
    mount.innerHTML = `
      <div class="cell-align-toolbar__row" role="group" aria-label="Horizontal alignment">
        ${BUTTONS.map(
          (b) => `
          <button type="button"
            class="cell-align-toolbar__btn"
            data-value="${b.value}"
            data-tip="${b.tip}"
            aria-label="${b.tip}">
            ${ICONS[b.icon]}
          </button>`,
        ).join('')}
      </div>
      <div class="cell-align-toolbar__row cell-align-toolbar__row--case" role="group" aria-label="Letter case">
        <button type="button"
          class="cell-align-toolbar__btn cell-align-toolbar__btn--text"
          data-case="upper"
          data-tip="All caps"
          aria-label="All caps">AA</button>
        <button type="button"
          class="cell-align-toolbar__btn cell-align-toolbar__btn--text"
          data-case="title"
          data-tip="Title case"
          aria-label="Title case">Aa</button>
      </div>${dateRow}`;
  }

  function syncDateFormatButton(mount) {
    const btn = mount?.querySelector('[data-date-format-cycle]');
    const F = window.HtmlFormDateFormat;
    if (!btn || !F) return;
    const t = F.getActive();
    btn.textContent = F.buttonShortLabel ? F.buttonShortLabel(t) : F.buttonLabel(t);
    const tip = F.tipLabel(t);
    btn.dataset.tip = tip;
    btn.dataset.baseTip = tip;
    btn.setAttribute('aria-label', tip);
  }

  function init(options) {
    const mount = document.getElementById('cell-align-toolbar');
    if (!mount || mount.dataset.initialized === '1') return;
    mount.dataset.initialized = '1';

    const getSelectedCells = options?.getSelectedCells || (() => []);
    toolbarShowDateFormat = !!options?.showDateFormat;
    toolbarMount = mount;
    toolbarGetSelectedCells = getSelectedCells;
    renderToolbar(mount, toolbarShowDateFormat);

    mount.querySelectorAll('.cell-align-toolbar__btn[data-value]').forEach((btn) => {
      btn.dataset.baseTip = btn.dataset.tip;

      btn.addEventListener('click', () => {
        applyHorizontal(btn.dataset.value);
        syncSelection();
      });
    });

    mount.querySelectorAll('[data-case]').forEach((btn) => {
      btn.dataset.baseTip = btn.dataset.tip;
      btn.addEventListener('click', () => {
        applyCellCase(btn.dataset.case, getSelectedCells);
      });
    });

    const dateBtn = mount.querySelector('[data-date-format-cycle]');
    if (dateBtn && window.HtmlFormDateFormat && toolbarShowDateFormat) {
      syncDateFormatButton(mount);
      dateBtn.addEventListener('click', () => {
        const page = document.querySelector('.a4-page') || document;
        window.HtmlFormDateFormat.cycleActive(page);
        syncDateFormatButton(mount);
      });
    }

    syncSelection();
  }

  window.CrewCellAlignToolbar = { init, syncSelection };

  window.applyCellCase = function applyCellCaseGlobal(mode) {
    applyCellCase(mode, toolbarGetSelectedCells);
  };

  window.CrewCellFormat = {
    normalizeFontFamily(raw) {
      if (!raw) return 'Arial';
      const first = raw.split(',')[0].trim().replace(/^['"]+|['"]+$/g, '');
      return first || 'Arial';
    },
    resolveFontSelectValue(raw, selectEl) {
      const name = this.normalizeFontFamily(raw);
      if (!selectEl) return name;
      for (const opt of selectEl.options) {
        if (opt.value === name) return opt.value;
      }
      const lower = name.toLowerCase();
      for (const opt of selectEl.options) {
        if (opt.value.toLowerCase() === lower) return opt.value;
      }
      return selectEl.options[0]?.value || 'Arial';
    },
    clearCell(cell) {
      cell.style.removeProperty('font-family');
      cell.style.removeProperty('font-size');
      cell.style.removeProperty('text-align');
      cell.style.removeProperty('display');
      cell.style.removeProperty('align-items');
      cell.style.removeProperty('height');
      cell.style.removeProperty('justify-content');
      cell.style.removeProperty('padding-top');
      cell.style.removeProperty('padding-bottom');
      delete cell.dataset.verticalAlign;
    },
    resetAllCells(root) {
      if (!root) return;
      // Clear overrides on data cells; row № keeps default flex centering from CSS.
      root.querySelectorAll('.ci:not(.ci-rno)').forEach((cell) => this.clearCell(cell));
      root.querySelectorAll('.ci.ci-rno').forEach((cell) => {
        cell.style.removeProperty('font-family');
        cell.style.removeProperty('font-size');
        cell.style.removeProperty('text-align');
        cell.style.removeProperty('justify-content');
        cell.style.removeProperty('align-items');
        delete cell.dataset.verticalAlign;
      });
    },
    toAllCaps,
    toTitleCase,
    transformCellCase,
    applyCellCase,
  };
})();

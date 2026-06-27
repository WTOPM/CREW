/**
 * Icon alignment toolbar with hover tooltips and live preview on selected cells.
 * Expects global applyFormat / applyVerticalAlign from each form editor script.
 */
(function () {
  const ICONS = {
    hLeft:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h11M2 8h7M2 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    hCenter:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4h11M4.5 8h7M2.5 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    hRight:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4h11M7 8h7M3 12h11" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    vTop:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="0.9" opacity="0.35"/><path d="M4 4.5h8M5.5 6.5h5M4 8.5h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>',
    vMiddle:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="0.9" opacity="0.35"/><path d="M4 6h8M5.5 8h5M4 10h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>',
    vBottom:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="0.9" opacity="0.35"/><path d="M4 7.5h8M5.5 9.5h5M4 11.5h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>',
  };

  const BUTTONS = [
    { kind: 'h', value: 'left', tip: 'Align left', icon: 'hLeft' },
    { kind: 'h', value: 'center', tip: 'Align center', icon: 'hCenter' },
    { kind: 'h', value: 'right', tip: 'Align right', icon: 'hRight' },
    { kind: 'v', value: 'top', tip: 'Align top', icon: 'vTop' },
    { kind: 'v', value: 'middle', tip: 'Align middle', icon: 'vMiddle' },
    { kind: 'v', value: 'bottom', tip: 'Align bottom', icon: 'vBottom' },
  ];

  function editableCells(getSelectedCells) {
    return (getSelectedCells() || []).filter((cell) => !cell.classList.contains('ci-rno'));
  }

  function snapshotCells(cells) {
    return cells.map((cell) => ({
      el: cell,
      textAlign: cell.style.textAlign,
      display: cell.style.display,
      alignItems: cell.style.alignItems,
      height: cell.style.height,
      justifyContent: cell.style.justifyContent,
      verticalAlign: cell.dataset.verticalAlign || '',
    }));
  }

  function restoreCells(snap) {
    if (!snap) return;
    snap.forEach((s) => {
      s.el.style.textAlign = s.textAlign;
      s.el.style.display = s.display;
      s.el.style.alignItems = s.alignItems;
      s.el.style.height = s.height;
      s.el.style.justifyContent = s.justifyContent;
      if (s.verticalAlign) s.el.dataset.verticalAlign = s.verticalAlign;
      else delete s.el.dataset.verticalAlign;
    });
  }

  function readHorizontalAlign(cell) {
    const ta = (cell.style.textAlign || 'left').toLowerCase();
    if (ta === 'start') return 'left';
    if (ta === 'end') return 'right';
    if (ta === 'center' || ta === 'right' || ta === 'left') return ta;
    return 'left';
  }

  function readVerticalAlign(cell) {
    if (cell.dataset.verticalAlign) return cell.dataset.verticalAlign;
    const ai = cell.style.alignItems;
    if (ai === 'flex-start') return 'top';
    if (ai === 'flex-end') return 'bottom';
    if (ai === 'center') return 'middle';
    return null;
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
    const cells = editableCells(getSelectedCells);
    mount.querySelectorAll('.cell-align-toolbar__btn').forEach((btn) => {
      btn.classList.remove('cell-align-toolbar__btn--active');
      btn.removeAttribute('aria-pressed');
    });
    if (!cells.length) return;

    const h = unanimous(cells.map(readHorizontalAlign));
    const v = unanimous(cells.map(readVerticalAlign));

    mount.querySelectorAll('.cell-align-toolbar__btn').forEach((btn) => {
      const kind = btn.dataset.kind;
      const value = btn.dataset.value;
      const match = (kind === 'h' && h === value) || (kind === 'v' && v != null && v === value);
      if (match) {
        btn.classList.add('cell-align-toolbar__btn--active');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  }

  let toolbarMount = null;
  let toolbarGetSelectedCells = () => [];

  function syncSelection() {
    if (!toolbarMount) return;
    syncActiveButtons(toolbarMount, toolbarGetSelectedCells);
  }

  function applyHorizontal(value) {
    if (typeof applyFormat === 'function') applyFormat('textAlign', value);
  }

  function applyVertical(value) {
    if (typeof applyVerticalAlign === 'function') applyVerticalAlign(value);
  }

  function renderToolbar(mount) {
    const rows = [
      BUTTONS.slice(0, 3),
      BUTTONS.slice(3, 6),
    ];
    mount.innerHTML = rows
      .map(
        (row, rowIdx) => `
      <div class="cell-align-toolbar__row" role="group" aria-label="${rowIdx === 0 ? 'Horizontal alignment' : 'Vertical alignment'}">
        ${row
          .map(
            (b) => `
          <button type="button"
            class="cell-align-toolbar__btn"
            data-kind="${b.kind}"
            data-value="${b.value}"
            data-tip="${b.tip}"
            aria-label="${b.tip}">
            ${ICONS[b.icon]}
          </button>`,
          )
          .join('')}
      </div>`,
      )
      .join('');
  }

  function init(options) {
    const mount = document.getElementById('cell-align-toolbar');
    if (!mount || mount.dataset.initialized === '1') return;
    mount.dataset.initialized = '1';

    const getSelectedCells = options?.getSelectedCells || (() => []);
    toolbarMount = mount;
    toolbarGetSelectedCells = getSelectedCells;
    renderToolbar(mount);

    let previewSnap = null;
    let previewBtn = null;
    let clickCommitted = false;

    function endPreview() {
      if (previewBtn) {
        previewBtn.classList.remove('cell-align-toolbar__btn--preview');
        previewBtn = null;
      }
      if (previewSnap) {
        restoreCells(previewSnap);
        previewSnap = null;
      }
      syncSelection();
    }

    function startPreview(btn) {
      const cells = editableCells(getSelectedCells);
      if (!cells.length) return;

      endPreview();
      previewSnap = snapshotCells(cells);
      previewBtn = btn;
      btn.classList.add('cell-align-toolbar__btn--preview');
      btn.dataset.tip = btn.dataset.baseTip + ' — preview';

      const kind = btn.dataset.kind;
      const value = btn.dataset.value;
      if (kind === 'h') applyHorizontal(value);
      else applyVertical(value);
    }

    mount.querySelectorAll('.cell-align-toolbar__btn').forEach((btn) => {
      btn.dataset.baseTip = btn.dataset.tip;

      btn.addEventListener('mouseenter', () => startPreview(btn));

      btn.addEventListener('mouseleave', () => {
        if (clickCommitted) {
          clickCommitted = false;
          if (previewBtn === btn) {
            previewBtn.classList.remove('cell-align-toolbar__btn--preview');
            previewBtn = null;
          }
          previewSnap = null;
          btn.dataset.tip = btn.dataset.baseTip;
          return;
        }
        btn.dataset.tip = btn.dataset.baseTip;
        endPreview();
      });

      btn.addEventListener('click', () => {
        clickCommitted = true;
        previewSnap = null;
        const kind = btn.dataset.kind;
        const value = btn.dataset.value;
        if (kind === 'h') applyHorizontal(value);
        else applyVertical(value);
        syncSelection();
      });
    });

    syncSelection();
  }

  window.CrewCellAlignToolbar = { init, syncSelection };

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
      delete cell.dataset.verticalAlign;
    },
    resetAllCells(root) {
      if (!root) return;
      root.querySelectorAll('.ci:not(.ci-rno)').forEach((cell) => this.clearCell(cell));
    },
  };
})();

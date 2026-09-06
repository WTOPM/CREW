const MAX_ROWS = 18; // keep in sync with CREW_LIST_FORM_07_MAX_ROWS in crew-list-form-07.paths.ts

function resolveTargetRowCount(savedCount, currentCount, maxRows) {
  if (window.HtmlFormCrewListKit?.resolveTargetRowCount) {
    return HtmlFormCrewListKit.resolveTargetRowCount(savedCount, currentCount, maxRows);
  }
  const max = Math.max(1, maxRows);
  const cur = Math.max(0, currentCount);
  if (typeof savedCount === 'number' && Number.isFinite(savedCount)) {
    const saved = Math.round(savedCount);
    if (saved > max) return Math.min(max, Math.max(cur, cur > 0 ? cur : 1));
    return Math.min(max, Math.max(cur, saved));
  }
  return Math.min(max, Math.max(cur, cur > 0 ? cur : 1));
}
    const DEMO = [
      { name: 'PETROV Ivan Sergeyevich', rank: 'Master', nat: 'RUS', dob: '15.03.1975', pob: 'Moscow', bno: 'RUS12345678', bplace: 'MOSCOW', bexp: '10.08.2027', passport: '751234567', pplace: 'MOSCOW', pexp: '15.06.2030' },
      { name: 'KIM Jong-su', rank: 'Chief Officer', nat: 'KOR', dob: '22.07.1980', pob: 'Busan', bno: 'KOR98765432', bplace: 'BUSAN', bexp: '15.03.2026', passport: 'M12345678', pplace: 'SEOUL', pexp: '01.09.2028' },
    ];
    const tbody = document.getElementById('tbody');
    const EDITOR_DIRTY_OPTS = {
      getTableRoot: () => tbody,
      beforeSnapshot: savePositions,
      loadPositions,
      footerDateId: 'f-footer-date',
    };

    function rowCells(tr) {
      return tr.querySelectorAll('.ci');
    }

    function rowHasData(tr) {
      return Array.from(tr.querySelectorAll('.ci')).some((cell) => {
        if (cell.classList.contains('ci-rno')) return false;
        return cellText(cell).trim();
      });
    }

    function refreshRowNumbers() {
      let n = 0;
      Array.from(tbody.children).forEach((tr) => {
        const rno = tr.querySelector('.ci-rno');
        if (!rno) return;
        delete rno.dataset.manual;
        if (rowHasData(tr)) {
          n += 1;
          rno.textContent = String(n);
        } else {
          rno.textContent = '';
        }
      });
    }

    function escAttr(val) {
      return String(val || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    }

    function removeRow() {
      if (tbody.lastChild) {
        tbody.removeChild(tbody.lastChild);
        refreshRowNumbers();
      }
    }
    function setAD(v) {
      window._adMode = v;
      document.getElementById('cb-arr').textContent = v === 'arrival' ? '\u2713' : '';
      document.getElementById('cb-dep').textContent = v === 'departure' ? '\u2713' : '';
      document.querySelectorAll('.ad-lbl').forEach((el) => {
        el.classList.toggle('ad-lbl--active', el.dataset.ad === v);
      });
      if (window._shipData) {
        const ship = window._shipData;
        const dateVal = v === 'arrival' ? fmtDate(ship.dateOfArrival) : fmtDate(ship.dateOfDeparture);
        const dateEl = document.getElementById('h-date');
        if (dateEl) dateEl.value = dateVal;
        const footerDateEl = document.getElementById('f-footer-date');
        if (footerDateEl) footerDateEl.value = dateVal;
      }
    }

    let selectedCells = [];
    let isDragging = false;
    let selectionAnchor = null;

    function cellCoords(el) {
      const tr = el.closest('tr');
      const row = Array.from(tbody.children).indexOf(tr);
      const col = Array.from(rowCells(tr)).indexOf(el);
      return { row, col };
    }

    function cellAt(row, col) {
      const tr = tbody.children[row];
      if (!tr) return null;
      const cells = rowCells(tr);
      return cells[col] || null;
    }

    function cellText(cell) {
      if (!cell) return '';
      if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') return cell.value || '';
      // Preserve intentional line breaks (Alt+Enter); only trim outer whitespace.
      return (cell.innerText || cell.textContent || '').replace(/^\s+|\s+$/g, '');
    }

    function isWrapEditableCell(cell) {
      return !!cell && cell.classList.contains('ci') && !cell.classList.contains('ci-rno');
    }

    let editingCell = null;

    function minRowHeightPx() {
      const probe = tbody.querySelector('td');
      if (!probe) return 18;
      const cs = getComputedStyle(document.documentElement);
      // --crew-row-h is on .crew-tbl; fall back to measured min.
      const tbl = tbody.closest('.crew-tbl');
      if (tbl) {
        const raw = getComputedStyle(tbl).getPropertyValue('--crew-row-h').trim();
        if (raw) {
          const tmp = document.createElement('div');
          tmp.style.height = raw;
          tmp.style.position = 'absolute';
          tmp.style.visibility = 'hidden';
          document.body.appendChild(tmp);
          const px = tmp.offsetHeight;
          tmp.remove();
          if (px > 0) return px;
        }
      }
      return probe.getBoundingClientRect().height || 18;
    }

    function syncCellHeight(cell) {
      if (!cell) return;
      if (cell.tagName === 'TEXTAREA') {
        cell.style.height = '0px';
        const next = Math.max(cell.scrollHeight, minRowHeightPx());
        cell.style.height = `${next}px`;
      }
    }

    function syncRowHeights(tr) {
      const rows = tr ? [tr] : Array.from(tbody.children);
      rows.forEach((row) => {
        row.querySelectorAll('textarea.ci').forEach((ta) => syncCellHeight(ta));
      });
    }

    function canDeleteNewline(cell, dir) {
      if (!cell || cell.tagName !== 'TEXTAREA') return false;
      const start = cell.selectionStart ?? 0;
      const end = cell.selectionEnd ?? start;
      const v = cell.value;
      if (start !== end) return v.slice(start, end).includes('\n');
      if (dir === 'backward') return start > 0 && v[start - 1] === '\n';
      return start < v.length && v[start] === '\n';
    }

    function onEditBeforeInput(e) {
      const cell = editingCell;
      if (cell?.tagName === 'TEXTAREA') {
        if (e.inputType === 'deleteContentBackward' && canDeleteNewline(cell, 'backward')) return;
        if (e.inputType === 'deleteContentForward' && canDeleteNewline(cell, 'forward')) return;
      }
      e.preventDefault();
    }

    function onEditPaste(e) {
      e.preventDefault();
    }

    function isCaretNavigationKey(e) {
      const nav = new Set([
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ]);
      if (nav.has(e.key)) return true;
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'C', 'A'].includes(e.key)) return true;
      return false;
    }

    function exitCellEdit() {
      if (!editingCell) return;
      const cell = editingCell;
      editingCell = null;
      cell.classList.remove('ci-editing');
      cell.removeEventListener('beforeinput', onEditBeforeInput);
      cell.removeEventListener('paste', onEditPaste);
      if (cell.tagName === 'TEXTAREA' || cell.tagName === 'INPUT') {
        cell.readOnly = true;
        cell.blur();
      } else if (cell.isContentEditable) {
        cell.contentEditable = 'false';
        cell.blur();
      }
      syncCellHeight(cell);
    }

    function enterCellEdit(cell) {
      if (!isWrapEditableCell(cell)) return;
      if (editingCell === cell) return;
      exitCellEdit();
      editingCell = cell;
      cell.classList.add('ci-editing');
      if (cell.tagName === 'TEXTAREA' || cell.tagName === 'INPUT') {
        cell.readOnly = false;
        cell.focus();
        try {
          const len = cell.value.length;
          cell.setSelectionRange(len, len);
        } catch (_) {
          /* ignore */
        }
      } else {
        cell.contentEditable = 'true';
        cell.focus();
        try {
          const range = document.createRange();
          range.selectNodeContents(cell);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {
          /* ignore */
        }
      }
      cell.addEventListener('beforeinput', onEditBeforeInput);
      cell.addEventListener('paste', onEditPaste);
      syncCellHeight(cell);
    }

    function removeLineBreak(cell) {
      if (!cell) return;
      if (cell.tagName === 'TEXTAREA') {
        const start = cell.selectionStart ?? 0;
        const end = cell.selectionEnd ?? start;
        const v = cell.value;
        if (start !== end) {
          const selected = v.slice(start, end);
          const cleaned = selected.replace(/\n/g, '');
          cell.value = v.slice(0, start) + cleaned + v.slice(end);
          cell.setSelectionRange(start, start + cleaned.length);
        } else if (start > 0 && v[start - 1] === '\n') {
          cell.value = v.slice(0, start - 1) + v.slice(start);
          cell.setSelectionRange(start - 1, start - 1);
        } else if (start < v.length && v[start] === '\n') {
          cell.value = v.slice(0, start) + v.slice(start + 1);
          cell.setSelectionRange(start, start);
        }
      }
      syncCellHeight(cell);
    }

    function clearAllLineBreaks() {
      tbody.querySelectorAll('textarea.ci').forEach((ta) => {
        if (!ta.value.includes('\n')) return;
        ta.value = ta.value.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ');
      });
      tbody.querySelectorAll('.ci-name').forEach((el) => {
        const t = el.textContent || '';
        if (!t.includes('\n')) return;
        el.textContent = t.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ');
      });
      syncRowHeights();
    }

    function insertLineBreak(cell) {
      if (!cell) return;
      if (cell.tagName === 'TEXTAREA' || cell.tagName === 'INPUT') {
        if (cell.tagName === 'INPUT') return; // single-line only
        const start = cell.selectionStart ?? cell.value.length;
        const end = cell.selectionEnd ?? start;
        const v = cell.value;
        cell.value = `${v.slice(0, start)}\n${v.slice(end)}`;
        const pos = start + 1;
        cell.setSelectionRange(pos, pos);
      } else {
        document.execCommand('insertLineBreak');
      }
      syncCellHeight(cell);
    }

    function addRow(d = {}) {
      const tr = document.createElement('tr');
      const ta = (cls, val) =>
        `<textarea class="ci${cls ? ` ${cls}` : ''}" rows="1" readonly tabindex="-1">${escapeHtml(val || '')}</textarea>`;
      tr.innerHTML = `
    <td class="c0"><div class="ci ci-rno" tabindex="-1"></div></td>
    <td class="c1"><div class="ci ci-name" tabindex="-1">${escapeHtml(d.name || '')}</div></td>
    <td class="c2">${ta('', d.rank)}</td>
    <td class="c3">${ta('', d.nat)}</td>
    <td class="c4"><div class="ci-birth-split"><input class="ci ci-birth-date" type="text" value="${escAttr(d.dob || '')}"${dateIsoAttr(d.dobIso)} readonly tabindex="-1">${ta('ci-birth-place', d.pob)}</div></td>
    <td class="c5">${ta('', d.bno)}</td>
    <td class="c6">${ta('', d.bplace)}</td>
    <td class="c7"><input class="ci" type="text" value="${escAttr(d.bexp || '')}"${dateIsoAttr(d.bexpIso)} readonly tabindex="-1"></td>
    <td class="c8">${ta('', d.passport)}</td>
    <td class="c9">${ta('', d.pplace)}</td>
    <td class="c10"><input class="ci" type="text" value="${escAttr(d.pexp || '')}"${dateIsoAttr(d.pexpIso)} readonly tabindex="-1"></td>`;
      tbody.appendChild(tr);
      refreshRowNumbers();
      syncRowHeights(tr);
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

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

    function buildCopyHtml() {
      const { rMin, rMax, cMin, cMax, selectedSet } = selectionBounds();
      const rows = [];
      for (let r = rMin; r <= rMax; r++) {
        const cells = [];
        for (let c = cMin; c <= cMax; c++) {
          const cell = cellAt(r, c);
          const text = cell && selectedSet.has(cell) ? cellText(cell) : '';
          cells.push(`<td>${escapeHtml(text)}</td>`);
        }
        rows.push(`<tr>${cells.join('')}</tr>`);
      }
      return `<table><tbody>${rows.join('')}</tbody></table>`;
    }

    function clearSelection() {
      selectedCells.forEach(c => c.classList.remove('selected'));
      selectedCells = [];
      if (window.CrewCellAlignToolbar?.syncSelection) CrewCellAlignToolbar.syncSelection();
    }

    function dismissSelection() {
      exitCellEdit();
      clearSelection();
      HtmlFormHeaderCells.clearSelection();
      isDragging = false;
      selectionAnchor = null;
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
      if (window.CrewCellAlignToolbar?.syncSelection) CrewCellAlignToolbar.syncSelection();
    }

    function syncToolbarFromCell(cell) {
      HtmlFormCrewListKit.syncToolbarFromCell(cell);
    }

    window.applyFontSizeFromToolbar = () =>
      HtmlFormCrewListKit.applyFontSizeFromToolbar(applyFormat);

    function returnUrl() {
      const raw = new URLSearchParams(window.location.search).get('return');
      if (!raw) return '/';
      try {
        const decoded = decodeURIComponent(raw);
        return decoded.startsWith('/') ? decoded : '/';
      } catch (e) {
        return '/';
      }
    }

    function navigateBack(feedback) {
      let target = returnUrl();
      if (feedback) {
        const sep = target.includes('?') ? '&' : '?';
        target += `${sep}form07Feedback=${feedback}`;
      }
      location.href = target;
    }

    tbody.addEventListener('mousedown', (e) => {
      HtmlFormHeaderCells.clearSelection();
      const cell = e.target.closest('.ci');
      if (!cell || !tbody.contains(cell)) return;

      // Already editing this cell — let the caret move normally.
      if (editingCell && editingCell === cell) {
        return;
      }

      // Second click on the same selected cell → enter wrap/edit mode.
      if (
        !e.shiftKey &&
        selectedCells.length === 1 &&
        selectedCells[0] === cell &&
        isWrapEditableCell(cell)
      ) {
        e.preventDefault();
        isDragging = false;
        enterCellEdit(cell);
        return;
      }

      exitCellEdit();
      e.preventDefault();
      isDragging = true;
      selectionAnchor = cellCoords(cell);
      selectRange(selectionAnchor.row, selectionAnchor.col, selectionAnchor.row, selectionAnchor.col);
      syncToolbarFromCell(cell);
    });

    tbody.addEventListener('mouseover', (e) => {
      if (!isDragging || !selectionAnchor || editingCell) return;
      const cell = e.target.closest('.ci');
      if (!cell || !tbody.contains(cell)) return;
      const current = cellCoords(cell);
      selectRange(selectionAnchor.row, selectionAnchor.col, current.row, current.col);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    document.addEventListener('copy', (e) => {
      if (editingCell) return;
      if (!selectedCells.length) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', buildCopyText());
      e.clipboardData.setData('text/html', buildCopyHtml());
    });

    document.addEventListener('keydown', (e) => {
      if (editingCell) {
        if (e.key === 'Escape') {
          e.preventDefault();
          exitCellEdit();
          return;
        }
        // Alt+Enter → line break only (no typing / spaces).
        if (e.key === 'Enter' && e.altKey) {
          e.preventDefault();
          insertLineBreak(editingCell);
          return;
        }
        // Alt+Backspace → undo one line break at caret.
        if (e.key === 'Backspace' && e.altKey) {
          e.preventDefault();
          removeLineBreak(editingCell);
          return;
        }
        // Plain Backspace/Delete: only unwrap (remove \\n). Letters stay locked.
        if (e.key === 'Backspace' || e.key === 'Delete') {
          const dir = e.key === 'Backspace' ? 'backward' : 'forward';
          if (canDeleteNewline(editingCell, dir)) {
            const start = editingCell.selectionStart ?? 0;
            const end = editingCell.selectionEnd ?? start;
            if (start !== end) {
              e.preventDefault();
              removeLineBreak(editingCell);
            }
            return;
          }
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          exitCellEdit();
          return;
        }
        if (isCaretNavigationKey(e)) return;
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        dismissSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedCells.length) {
        e.preventDefault();
        document.execCommand('copy');
        return;
      }
      // Row № is auto-generated — never edit from the keyboard.
      if (
        selectedCells.length === 1 &&
        selectedCells[0].classList.contains('ci-rno') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'Backspace' || e.key === 'Delete' || e.key.length === 1)
      ) {
        e.preventDefault();
      }
    });

    document.body.addEventListener('mousedown', (e) => {
      if (e.target.closest('.a4-landscape-page')) return;
      if (e.target.closest('.side-panel')) return;
      if (e.target.closest('.confirm-backdrop')) return;
      exitCellEdit();
      dismissSelection();
    });

    // Keep textarea height in sync while typing / after Alt+Enter.
    tbody.addEventListener('input', (e) => {
      const cell = e.target.closest?.('.ci');
      if (cell && editingCell === cell) syncCellHeight(cell);
    });

    document.querySelector('.a4-landscape-page')?.addEventListener('mousedown', (e) => {
      if (!editingCell) return;
      if (editingCell.contains(e.target)) return;
      if (e.target.closest('.ci')) return; // other cell — handled above
      exitCellEdit();
    });

    function syncCellFlexAlignment(cell) {
      const ta = cell.style.textAlign || '';
      const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
      if (
        cell.style.display === 'flex' ||
        cell.classList.contains('ci-name') ||
        cell.classList.contains('ci-rno')
      ) {
        cell.style.justifyContent = jc;
      }
    }

    function applyVerticalAlignToCell(cell, val) {
      // Birth split uses CSS grid; display:flex on date/place skews the divider.
      if (cell.classList.contains('ci-birth-date') || cell.classList.contains('ci-birth-place')) {
        cell.dataset.verticalAlign = val;
        return;
      }
      const alignItems = val === 'top' ? 'flex-start' : val === 'bottom' ? 'flex-end' : 'center';
      cell.style.display = 'flex';
      cell.style.height = '100%';
      cell.style.alignItems = alignItems;
      cell.dataset.verticalAlign = val;
      syncCellFlexAlignment(cell);
    }

    function applyVerticalAlign(val) {
      selectedCells.forEach((cell) => {
        applyVerticalAlignToCell(cell, val);
      });
      HtmlFormHeaderCells.applyVerticalAlign(val);
    }

    function applyHorizontalAlignToCell(cell, val) {
      HtmlFormCrewListKit.applyHorizontalAlignToCell(cell, val, syncCellFlexAlignment);
    }

    function applyFormat(prop, val) {
      selectedCells.forEach((cell) => {
        if (prop === 'textAlign') {
          applyHorizontalAlignToCell(cell, val);
          return;
        }
        if (prop === 'fontSize') {
          HtmlFormCrewListKit.applyFontSizeToCell(cell, val);
          return;
        }
        cell.style[prop] = val;
      });
      HtmlFormHeaderCells.applyFormat(prop, val);
    }
    window.applyFormat = applyFormat;
    window.applyVerticalAlign = applyVerticalAlign;

    let stampImgUrl = null;
    let sigImgUrl = null;

    const POS_KEY = 'crew06-overlay-pos';
    const ZOOM_STORAGE_KEY = 'crew06-editor-zoom';
    const ZOOM_MIN = 50;
    const ZOOM_MAX = 200;
    const ZOOM_STEP = 10;
    let editorZoomPct = 100;
    function loadEditorZoom() {
      try {
        const v = parseInt(sessionStorage.getItem(ZOOM_STORAGE_KEY), 10);
        if (v >= ZOOM_MIN && v <= ZOOM_MAX) editorZoomPct = v;
      } catch (e) { }
    }

    function applyEditorZoom() {
      const stage = document.getElementById('doc-zoom-stage');
      const pad = document.getElementById('doc-zoom-pad');
      const page = stage?.querySelector('.a4-landscape-page');
      const label = document.getElementById('zoom-label');
      const scale = editorZoomPct / 100;
      if (stage) {
        stage.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
      }
      if (pad && page) {
        pad.style.width = `${page.offsetWidth * scale}px`;
        pad.style.height = `${page.offsetHeight * scale}px`;
      }
      if (label) {
        label.textContent = `${editorZoomPct}%`;
      }
    }

    function setEditorZoom(pct, persist = true) {
      editorZoomPct = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(pct / ZOOM_STEP) * ZOOM_STEP));
      applyEditorZoom();
      if (persist) {
        try {
          sessionStorage.setItem(ZOOM_STORAGE_KEY, String(editorZoomPct));
        } catch (e) { }
      }
    }

    function zoomStep(delta) {
      setEditorZoom(editorZoomPct + delta * ZOOM_STEP);
    }

    function resetEditorZoomForExport() {
      editorZoomPct = 100;
      const stage = document.getElementById('doc-zoom-stage');
      const pad = document.getElementById('doc-zoom-pad');
      if (stage) stage.style.transform = 'none';
      if (pad) {
        pad.style.width = '';
        pad.style.height = '';
      }
      const label = document.getElementById('zoom-label');
      if (label) label.textContent = '100%';
    }

    function initEditorZoom() {
      loadEditorZoom();
      applyEditorZoom();
      const viewport = document.getElementById('doc-zoom-viewport');
      if (!viewport || !window.CrewHtmlFormEditorWheel) return;
      window.CrewHtmlFormEditorWheel.attach(viewport, {
        onZoomStep: (step) => setEditorZoom(editorZoomPct + step * ZOOM_STEP),
      });
    }

    const CREW_FORM_07_TYPE = 'type6V3SbkP2';
    const APP_DATA_SCHEMA_VERSION = 16;
    window._currentPositions = null;

    function electronApi() {
      return window.electronAPI || (window.parent && window.parent.electronAPI) || null;
    }

    async function readPersistedAppData() {
      const api = electronApi();
      if (api) {
        try {
          const data = await api.readData();
          if (data) return data;
        } catch (e) { }
      }
      try {
        const raw = localStorage.getItem('crew-app-data');
        if (raw) return JSON.parse(raw);
      } catch (e) { }
      return window._appData || null;
    }

    function cssBoxFromVariant(box) {
      if (!box || typeof box !== 'object') return null;
      if (
        typeof box.left === 'string' &&
        typeof box.top === 'string' &&
        typeof box.width === 'string' &&
        typeof box.height === 'string'
      ) {
        return {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        };
      }
      return null;
    }

    function overlayCssBox(saved, prevBox) {
      const box = { ...(prevBox || {}) };
      if (saved?.left) box.left = saved.left;
      if (saved?.top) box.top = saved.top;
      if (saved?.width) box.width = saved.width;
      if (saved?.height) box.height = saved.height;
      return Object.keys(box).length ? box : undefined;
    }

    function loadPositions() {
      if (window._currentPositions) {
        return window._currentPositions;
      }

      let loaded = null;
      // 1. Try to load from window._appData (central state)
      try {
        const appData = window._appData;
        if (appData && appData.documentOverlay && appData.documentOverlay.crewList && appData.documentOverlay.crewList.byType) {
          const variant = appData.documentOverlay.crewList.byType[CREW_FORM_07_TYPE];
          if (variant) {
            const stampCss = cssBoxFromVariant(variant.stampBox);
            const sigCss = cssBoxFromVariant(variant.signatureBox);
            loaded = {
              stamp: {
                visible: !!variant.useStamp,
                left: stampCss?.left,
                top: stampCss?.top,
                width: stampCss?.width,
                height: stampCss?.height
              },
              sig: {
                visible: !!variant.useSignature,
                left: sigCss?.left,
                top: sigCss?.top,
                width: sigCss?.width,
                height: sigCss?.height
              },
              cellStyles: variant.cellStyles || {},
              cellValues: variant.cellValues || {}
            };
          }
        }
      } catch (e) { }

      // 2. Fallback: try to load from legacy POS_KEY in localStorage
      if (!loaded) {
        try {
          const legacy = JSON.parse(localStorage.getItem(POS_KEY));
          if (legacy) {
            loaded = {
              stamp: legacy.stamp || {},
              sig: legacy.sig || {},
              cellStyles: legacy.cellStyles || {}
            };
          }
        } catch (e) { }
      }

      if (!loaded) {
        loaded = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
      }

      window._currentPositions = loaded;
      return window._currentPositions;
    }

    function savePositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const stampOn = window.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = window.CrewOverlayToolbar?.isSigOn() ?? false;
      
      // Update in-memory positions
      if (!window._currentPositions) {
        window._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
      }
      window._currentPositions.stamp = { 
        visible: stampOn, 
        left: stamp.style.left || window._currentPositions.stamp?.left, 
        top: stamp.style.top || window._currentPositions.stamp?.top, 
        width: stamp.style.width || window._currentPositions.stamp?.width, 
        height: stamp.style.height || window._currentPositions.stamp?.height 
      };
      window._currentPositions.sig = { 
        visible: sigOn, 
        left: sig.style.left || window._currentPositions.sig?.left, 
        top: sig.style.top || window._currentPositions.sig?.top, 
        width: sig.style.width || window._currentPositions.sig?.width, 
        height: sig.style.height || window._currentPositions.sig?.height 
      };
    }

    function restoreCellStyles() {
      const saved = loadPositions();
      const cellStyles = saved.cellStyles || {};
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((tr, rowIndex) => {
        const inputs = window.HtmlFormListCellPersist?.dataInputs?.(tr)
          || Array.from(tr.querySelectorAll('input.ci, textarea.ci')).filter(
            (el) => !el.classList.contains('ci-birth-place'),
          );
        inputs.forEach((input, colIndex) => {
          const style = cellStyles[`${rowIndex}-${colIndex}`];
          if (style) {
            if (window.CrewCellFormat?.applyStyle) {
              CrewCellFormat.applyStyle(input, style, {
                applyTextAlign: applyHorizontalAlignToCell,
                applyVerticalAlign: applyVerticalAlignToCell,
                syncFlex: syncCellFlexAlignment,
              });
            } else {
              if (style.fontFamily) input.style.fontFamily = style.fontFamily;
              if (style.fontSize) input.style.fontSize = style.fontSize;
              if (style.fontWeight) input.style.fontWeight = style.fontWeight;
              if (style.fontStyle) input.style.fontStyle = style.fontStyle;
              if (style.textDecoration) input.style.textDecoration = style.textDecoration;
              if (style.textAlign) applyHorizontalAlignToCell(input, style.textAlign);
              if (style.verticalAlign) applyVerticalAlignToCell(input, style.verticalAlign);
              else if (style.textAlign) syncCellFlexAlignment(input);
            }
          }
        });
        const pob = tr.querySelector('.ci-birth-place');
        const pobStyle = cellStyles[`${rowIndex}-pob`];
        if (pob && pobStyle) {
          if (window.CrewCellFormat?.applyStyle) {
            CrewCellFormat.applyStyle(pob, pobStyle, {
              applyTextAlign: typeof applyHorizontalAlignToCell === 'function' ? applyHorizontalAlignToCell : (c, a) => { c.style.textAlign = a; },
              applyVerticalAlign: typeof applyVerticalAlignToCell === 'function' ? applyVerticalAlignToCell : undefined,
              syncFlex: typeof syncCellFlexAlignment === 'function' ? syncCellFlexAlignment : undefined,
            });
          } else {
            if (pobStyle.fontFamily) pob.style.fontFamily = pobStyle.fontFamily;
            if (pobStyle.fontSize) pob.style.fontSize = pobStyle.fontSize;
            if (pobStyle.fontWeight) pob.style.fontWeight = pobStyle.fontWeight;
            if (pobStyle.fontStyle) pob.style.fontStyle = pobStyle.fontStyle;
            if (pobStyle.textDecoration) pob.style.textDecoration = pobStyle.textDecoration;
            if (pobStyle.textAlign) {
              if (typeof applyHorizontalAlignToCell === 'function') applyHorizontalAlignToCell(pob, pobStyle.textAlign);
              else pob.style.textAlign = pobStyle.textAlign;
            }
            if (pobStyle.verticalAlign && typeof applyVerticalAlignToCell === 'function') applyVerticalAlignToCell(pob, pobStyle.verticalAlign);
            else if (pobStyle.textAlign && typeof syncCellFlexAlignment === 'function') syncCellFlexAlignment(pob);
          }
        }
        const nameCell = tr.querySelector('.ci-name');
        const nameStyle = cellStyles[`${rowIndex}-name`];
        if (nameCell && nameStyle) {
          if (window.CrewCellFormat?.applyStyle) {
            CrewCellFormat.applyStyle(nameCell, nameStyle, {
              applyTextAlign: typeof applyHorizontalAlignToCell === 'function' ? applyHorizontalAlignToCell : (c, a) => { c.style.textAlign = a; },
              applyVerticalAlign: typeof applyVerticalAlignToCell === 'function' ? applyVerticalAlignToCell : undefined,
              syncFlex: typeof syncCellFlexAlignment === 'function' ? syncCellFlexAlignment : undefined,
            });
          } else {
            if (nameStyle.fontFamily) nameCell.style.fontFamily = nameStyle.fontFamily;
            if (nameStyle.fontSize) nameCell.style.fontSize = nameStyle.fontSize;
            if (nameStyle.fontWeight) nameCell.style.fontWeight = nameStyle.fontWeight;
            if (nameStyle.fontStyle) nameCell.style.fontStyle = nameStyle.fontStyle;
            if (nameStyle.textDecoration) nameCell.style.textDecoration = nameStyle.textDecoration;
            if (nameStyle.textAlign) {
              if (typeof applyHorizontalAlignToCell === 'function') applyHorizontalAlignToCell(nameCell, nameStyle.textAlign);
              else nameCell.style.textAlign = nameStyle.textAlign;
            }
            if (nameStyle.verticalAlign && typeof applyVerticalAlignToCell === 'function') applyVerticalAlignToCell(nameCell, nameStyle.verticalAlign);
            else if (nameStyle.textAlign && typeof syncCellFlexAlignment === 'function') syncCellFlexAlignment(nameCell);
          }
        }
        const rnoCell = tr.querySelector('.ci-rno');
        const rnoStyle = cellStyles[`${rowIndex}-rno`];
        if (rnoCell && rnoStyle) {
          if (window.CrewCellFormat?.applyStyle) {
            CrewCellFormat.applyStyle(rnoCell, rnoStyle, {
              applyTextAlign: applyHorizontalAlignToCell,
              applyVerticalAlign: applyVerticalAlignToCell,
              syncFlex: (cell) => {
                cell.style.display = 'flex';
                cell.style.alignItems = cell.style.alignItems || 'center';
                syncCellFlexAlignment(cell);
              },
            });
          } else {
            if (rnoStyle.fontFamily) rnoCell.style.fontFamily = rnoStyle.fontFamily;
            if (rnoStyle.fontSize) rnoCell.style.fontSize = rnoStyle.fontSize;
            if (rnoStyle.fontWeight) rnoCell.style.fontWeight = rnoStyle.fontWeight;
            if (rnoStyle.fontStyle) rnoCell.style.fontStyle = rnoStyle.fontStyle;
            if (rnoStyle.textDecoration) rnoCell.style.textDecoration = rnoStyle.textDecoration;
            if (rnoStyle.textAlign) applyHorizontalAlignToCell(rnoCell, rnoStyle.textAlign);
            if (rnoStyle.verticalAlign) applyVerticalAlignToCell(rnoCell, rnoStyle.verticalAlign);
            else if (rnoStyle.textAlign) {
              rnoCell.style.display = 'flex';
              rnoCell.style.alignItems = rnoCell.style.alignItems || 'center';
              syncCellFlexAlignment(rnoCell);
            }
          }
        }
      });
      HtmlFormHeaderCells.restoreStyles(cellStyles);
    }
    function restoreCellValues() {
      const saved = loadPositions();
      const cellValues = saved.cellValues || {};
      if (window.HtmlFormListCellPersist) {
        window.HtmlFormListCellPersist.restoreValues(tbody, cellValues);
      }
      if (window.HtmlFormHeaderCells?.restoreValues) {
        window.HtmlFormHeaderCells.restoreValues(cellValues);
      }
    }


    async function persistAllChanges() {
      savePositions(); // Make sure current stamp/sig positions are captured in window._currentPositions
      
      // Extract cell styles
      const cellStyles = {};
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((tr, rowIndex) => {
        const inputs = window.HtmlFormListCellPersist?.dataInputs?.(tr)
          || Array.from(tr.querySelectorAll('input.ci, textarea.ci')).filter(
            (el) => !el.classList.contains('ci-birth-place'),
          );
        inputs.forEach((input, colIndex) => {
          const style = window.CrewCellFormat?.readStyle?.(input) || null;
          if (style) {
            cellStyles[`${rowIndex}-${colIndex}`] = style;
          }
        });
        const pob = tr.querySelector('.ci-birth-place');
        if (pob) {
          const pobStyle = window.CrewCellFormat?.readStyle?.(pob) || null;
          if (pobStyle) {
            cellStyles[`${rowIndex}-pob`] = pobStyle;
          }
        }
        const nameCell = tr.querySelector('.ci-name');
        if (nameCell) {
          const nameStyle = window.CrewCellFormat?.readStyle?.(nameCell) || null;
          if (nameStyle) {
            cellStyles[`${rowIndex}-name`] = nameStyle;
          }
        }
        const rnoCell = tr.querySelector('.ci-rno');
        if (rnoCell) {
          const rnoStyle = window.CrewCellFormat?.readStyle?.(rnoCell) || null;
          if (rnoStyle) {
            cellStyles[`${rowIndex}-rno`] = rnoStyle;
          }
        }
      });

      Object.assign(cellStyles, HtmlFormHeaderCells.collectStyles());
      
      if (!window._currentPositions) {
        window._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
      }
      window._currentPositions.cellStyles = cellStyles;

      const cellValuesRaw = {
        ...(window.HtmlFormListCellPersist
          ? window.HtmlFormListCellPersist.collectValues(tbody)
          : {}),
        ...(window.HtmlFormHeaderCells?.collectValues?.() || {}),
      };
      const cellValues = window.HtmlFormLiveVoyageDate?.stripLiveVoyageKeys
        ? window.HtmlFormLiveVoyageDate.stripLiveVoyageKeys(cellValuesRaw)
        : cellValuesRaw;
      window._currentPositions.cellValues = cellValues;

      const appData = await readPersistedAppData();
      if (!appData || !appData.ship) {
        alert('Cannot save: application data is not loaded.');
        return;
      }

      if (!appData.documentOverlay) appData.documentOverlay = {};
      if (!appData.documentOverlay.crewList) {
        appData.documentOverlay.crewList = { listType: CREW_FORM_07_TYPE, byType: {} };
      }
      if (!appData.documentOverlay.crewList.byType) {
        appData.documentOverlay.crewList.byType = {};
      }

      const prev = appData.documentOverlay.crewList.byType[CREW_FORM_07_TYPE] || {};
      const { footerSignatureDate: _omitFooterDate, ...prevWithoutFooterDate } = prev;
      const stampBox = overlayCssBox(window._currentPositions.stamp, cssBoxFromVariant(prev.stampBox));
      const signatureBox = overlayCssBox(window._currentPositions.sig, cssBoxFromVariant(prev.signatureBox));

      appData.documentOverlay.crewList.listType = CREW_FORM_07_TYPE;
      appData.documentOverlay.crewList.byType[CREW_FORM_07_TYPE] = {
        ...prevWithoutFooterDate,
        useStamp: !!window._currentPositions.stamp.visible,
        useSignature: !!window._currentPositions.sig.visible,
        ...(stampBox ? { stampBox } : {}),
        ...(signatureBox ? { signatureBox } : {}),
        cellStyles,
        cellValues,
        tableRowCount: tbody.children.length,
        ...(window.HtmlFormEditorOverlay?.collectForSave?.() || {}),
      };
      appData.seedVersion = APP_DATA_SCHEMA_VERSION;
      window._appData = appData;

      // Save to Electron / localStorage
      try {
        const api = electronApi();
        if (api) {
          await api.writeData(appData);
        } else {
          localStorage.setItem('crew-app-data', JSON.stringify(appData));
        }
      } catch (e) {
        console.error('Failed to save appData', e);
        alert('Failed to save settings. Please try again.');
        return;
      }

      // Also save to legacy POS_KEY for double safety and backwards compatibility
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(window._currentPositions));
      } catch (e) {
        console.error('Failed to save POS_KEY', e);
      }

      navigateBack('saved');
    }

    function showConfirmModal() {
      if (window.CrewHtmlFormEditorDirty && !CrewHtmlFormEditorDirty.isDirty(EDITOR_DIRTY_OPTS)) {
        navigateBack('cancelled');
        return;
      }
      document.getElementById('confirm-modal').style.display = 'flex';
    }

    function closeConfirmModal() {
      document.getElementById('confirm-modal').style.display = 'none';
    }

    function confirmCancel() {
      navigateBack('cancelled');
    }

    function editorScaleFactor() {
      return editorZoomPct / 100;
    }

    function makeDraggable(el) {
      CrewOverlayDrag.attach(el, editorScaleFactor, savePositions);
    }

    function isValidCoordinate(val) {
      if (!val || typeof val !== 'string') return false;
      const lower = val.toLowerCase().trim();
      if (lower.includes('nan') || lower.includes('undefined') || lower.includes('null') || lower === '') {
        return false;
      }
      return true;
    }

    function resetCellStyles() {
      if (window.CrewCellFormat) CrewCellFormat.resetAllCells(tbody);
      else {
        tbody.querySelectorAll('.ci:not(.ci-rno)').forEach((cell) => {
          cell.style.removeProperty('font-family');
          cell.style.removeProperty('font-size');
          cell.style.removeProperty('text-align');
          cell.style.removeProperty('display');
          cell.style.removeProperty('align-items');
          cell.style.removeProperty('height');
          cell.style.removeProperty('justify-content');
          delete cell.dataset.verticalAlign;
        });
        tbody.querySelectorAll('.ci.ci-rno').forEach((cell) => {
          cell.style.removeProperty('font-family');
          cell.style.removeProperty('font-size');
          cell.style.removeProperty('text-align');
          cell.style.removeProperty('justify-content');
          cell.style.removeProperty('align-items');
          delete cell.dataset.verticalAlign;
          delete cell.dataset.manual;
        });
      }
      tbody.querySelectorAll('.ci.ci-rno').forEach((cell) => {
        delete cell.dataset.manual;
      });
      if (window.HtmlFormCrewListKit?.repairBirthSplitLayout) {
        HtmlFormCrewListKit.repairBirthSplitLayout(tbody);
      } else {
        tbody.querySelectorAll('.ci-birth-date, .ci-birth-place').forEach((el) => {
          el.style.removeProperty('width');
          el.style.removeProperty('max-width');
          el.style.removeProperty('flex');
          el.style.removeProperty('display');
          el.style.removeProperty('height');
          el.style.removeProperty('min-height');
        });
      }
      clearAllLineBreaks();
      refreshRowNumbers();
      HtmlFormHeaderCells.resetAll();
      clearSelection();
      const fontSel = document.getElementById('tb-font');
      const sizeSel = document.getElementById('tb-size');
      if (fontSel) fontSel.value = 'Arial';
      if (sizeSel) sizeSel.value = '6';
      if (window._currentPositions) {
        window._currentPositions.cellStyles = {};
      }
      syncRowHeights();
    }

    function resetPositions() {
      if (window._currentPositions) {
        window._currentPositions.stamp = {};
        window._currentPositions.sig = {};
        window._currentPositions.cellStyles = {};
      }
      
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      
      const stampDefault = { left: 'calc(100% - 50mm)', top: 'calc(100% - 50mm)', width: '38mm', height: '38mm' };
      const sigDefault = { left: 'calc(100% - 60mm)', top: 'calc(100% - 28mm)', width: '50mm', height: '20mm' };
      
      // Always reset the style coordinates to correct defaults unconditionally
      stamp.style.left = stampDefault.left;
      stamp.style.top = stampDefault.top;
      stamp.style.width = stampDefault.width;
      stamp.style.height = stampDefault.height;
      
      sig.style.left = sigDefault.left;
      sig.style.top = sigDefault.top;
      sig.style.width = sigDefault.width;
      sig.style.height = sigDefault.height;

      resetCellStyles();
      savePositions();
    }

    function showOverlay(el, imgUrl, defaultPos) {
      if (!el.querySelector('img')) {
        el.innerHTML =
          `<img src="${imgUrl}" />` +
          `<span class="overlay-h overlay-h--e"></span>` +
          `<span class="overlay-h overlay-h--w"></span>` +
          `<span class="overlay-h overlay-h--n"></span>` +
          `<span class="overlay-h overlay-h--s"></span>` +
          `<span class="overlay-resize" title="Resize (proportional)"></span>`;
        makeDraggable(el);
      }
      // Restore saved position or apply default
      const saved = loadPositions()[el.id === 'stamp-container' ? 'stamp' : 'sig'];
      const hasValidCoords = saved && 
                             isValidCoordinate(saved.left) && 
                             isValidCoordinate(saved.top) && 
                             isValidCoordinate(saved.width) && 
                             isValidCoordinate(saved.height);
                             
      if (hasValidCoords) {
        el.style.left   = saved.left;
        el.style.top    = saved.top;
        el.style.width  = saved.width;
        el.style.height = saved.height;
      } else {
        el.style.left   = defaultPos.left;
        el.style.top    = defaultPos.top;
        el.style.width  = defaultPos.width;
        el.style.height = defaultPos.height;
      }
      el.classList.add('visible');
    }

    async function toggleStamp(checked) {
      const el = document.getElementById('stamp-container');
      if (!checked) { el.classList.remove('visible'); savePositions(); return; }
      if (!stampImgUrl) stampImgUrl = await loadAsset('stamp');
      if (stampImgUrl) {
        showOverlay(el, stampImgUrl, { left: 'calc(100% - 50mm)', top: 'calc(100% - 50mm)', width: '38mm', height: '38mm' });
        savePositions();
      } else {
        if (window.CrewOverlayToolbar) CrewOverlayToolbar.setStampOn(false);
        const isPdfExport = new URLSearchParams(location.search).get('pdfExport') === '1';
        if (!isPdfExport) {
          alert('Stamp not found. Please upload it in Settings.');
        }
      }
    }

    async function toggleSignature(checked) {
      const el = document.getElementById('sig-container');
      if (!checked) { el.classList.remove('visible'); savePositions(); return; }
      if (!sigImgUrl) sigImgUrl = await loadAsset('signature');
      if (sigImgUrl) {
        showOverlay(el, sigImgUrl, { left: 'calc(100% - 60mm)', top: 'calc(100% - 28mm)', width: '50mm', height: '20mm' });
        savePositions();
      } else {
        if (window.CrewOverlayToolbar) CrewOverlayToolbar.setSigOn(false);
        const isPdfExport = new URLSearchParams(location.search).get('pdfExport') === '1';
        if (!isPdfExport) {
          alert('Signature not found. Please upload it in Settings.');
        }
      }
    }

    /** Restore saved stamp/signature visibility on load (positions restored by showOverlay). */
    async function restoreOverlaySettings() {
      const saved = loadPositions();
      const stampVisible = !!(saved.stamp && saved.stamp.visible);
      const sigVisible = !!(saved.sig && saved.sig.visible);
      if (window.CrewOverlayToolbar) {
        CrewOverlayToolbar.setStampOn(stampVisible);
        CrewOverlayToolbar.setSigOn(sigVisible);
      }
      if (stampVisible) {
        try {
          await toggleStamp(true);
        } catch (e) {
          console.error('Failed to restore stamp', e);
        }
      }
      if (sigVisible) {
        try {
          await toggleSignature(true);
        } catch (e) {
          console.error('Failed to restore signature', e);
        }
      }
    }

    async function loadAsset(kind) {
      // 1. Try Electron API (desktop app)
      const api = electronApi();
      if (api) {
        try {
          const b64 = await api.readShipAsset(kind);
          if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
        } catch (e) { }
      }
      // 2. Fallback: read from IndexedDB (browser mode — same DB as the Angular app)
      try {
        const buf = await idbGetAsset(kind);
        if (buf) {
          const bytes = new Uint8Array(buf);
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          return `data:image/png;base64,${btoa(binary)}`;
        }
      } catch (e) { }
      return null;
    }

    function idbGetAsset(key) {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('crew-ship-assets');
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('assets')) { resolve(null); return; }
          const tx = db.transaction('assets', 'readonly');
          const get = tx.objectStore('assets').get(key);
          get.onsuccess = () => resolve(get.result ?? null);
          get.onerror = () => resolve(null);
        };
        req.onupgradeneeded = () => { /* don't create store, just read */ };
      });
    }

    function fmtDate(iso) {
      const F = window.HtmlFormDateFormat;
      if (F) return F.format(iso, F.getActive());
      if (!iso) return '';
      const parts = iso.split('-');
      if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
      return iso;
    }

    function dateIsoAttr(iso) {
      return window.HtmlFormDateFormat?.isoAttr(iso) || '';
    }

    async function loadAppData() {
      // Snapshot mode: an exact AppData slice (ship/ports/crew) passed by the Angular app
      // for PDF generation — already filtered/ordered, used as-is (no re-fetch, no re-filter).
      let snapshot = window.CrewHtmlFormPdfSnapshot
        ? CrewHtmlFormPdfSnapshot.read()
        : null;
      if (!snapshot) {
        const snapshotRaw = new URLSearchParams(window.location.search).get('data');
        if (snapshotRaw) {
          try { snapshot = JSON.parse(snapshotRaw); } catch (e) { }
        }
      }

      let appData = snapshot;
      const api = electronApi();
      if (!appData && api) {
        try { appData = await api.readData(); } catch (e) { }
      }
      if (!appData && !snapshot) {
        try { appData = JSON.parse(localStorage.getItem('crew-app-data')); } catch (e) { }
      }
      window._appData = appData; // Store globally

      let defaultMasterName = '';
      if (appData) {
        const ship = appData.ship || {};
        window._shipData = ship; // Save for setAD date switching

        const agencyEl = document.getElementById('h-agency');
        if (agencyEl) agencyEl.value = ship.charterer || '';

        document.getElementById('h-ship-name').value = ship.name || '';
        document.getElementById('h-port').value = ship.portOfCall || '';
        document.getElementById('h-nat').value = ship.nationality || '';

        const ports = appData.ports || [];
        document.getElementById('h-from').value = CrewPortFormat.formatPortsFromTo(
          ship.lastPortOfCall,
          ship.nextPortOfCall,
          ports,
        );

        // Read ?mode=arrival|departure from URL
        const urlMode = new URLSearchParams(window.location.search).get('mode');
        const isArrival = urlMode === 'departure' ? false : (urlMode === 'arrival' ? true : (ship.dateOfArrival && !ship.dateOfDeparture ? true : !ship.dateOfDeparture));

        if (isArrival) {
          setAD('arrival');
        } else {
          setAD('departure');
        }

        const imoEl = document.getElementById('h-imo');
        if (imoEl) imoEl.value = ship.imoNo || '';
        const callEl = document.getElementById('h-call');
        if (callEl) callEl.value = ship.callSign || '';
        const voyageEl = document.getElementById('h-voyage');
        if (voyageEl) voyageEl.value = ship.voyageNumber || '';

        let crewList = [];
        if (Array.isArray(appData.crew)) {
          // Snapshot mode already carries the exact filtered/ordered list — use as-is.
          crewList = snapshot
            ? appData.crew
            : appData.crew.filter(c => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false));
        }

        let master = null;
        if (crewList.length > 0) {
          master = crewList.find(c => c.rank && c.rank.toLowerCase().includes('master')) || crewList[0];
          defaultMasterName = master ? CrewNameFormat.formatCrewListName(master) : '';
        }

        crewList.forEach(c => {
          const name = CrewNameFormat.formatCrewListName(c);
          addRow({
            name,
            rank: c.rank || '',
            nat: c.nationality || '',
            dob: fmtDate(c.dateOfBirth),
            dobIso: c.dateOfBirth || '',
            pob: c.placeOfBirth || '',
            bno: c.seamansBook || '',
            bplace: (c.seamansBookPlaceOfIssue || '').toUpperCase(),
            bexp: fmtDate(c.sbookExpiryDate),
            bexpIso: c.sbookExpiryDate || '',
            passport: c.passport || '',
            pplace: (c.passportPlaceOfIssue || '').toUpperCase(),
            pexp: fmtDate(c.passportExpiryDate),
            pexpIso: c.passportExpiryDate || '',
          });
        });
      } else {
        DEMO.forEach(d => addRow(d));
      }

      const savedVar = appData?.documentOverlay?.crewList?.byType?.[CREW_FORM_07_TYPE];
      if (window.HtmlFormEditorOverlay) {
        HtmlFormEditorOverlay.applyFromVariant(
          savedVar,
          document.querySelector('.a4-page'),
          defaultMasterName,
        );
      }

      const targetRows = resolveTargetRowCount(
        savedVar?.tableRowCount,
        tbody.children.length,
        MAX_ROWS,
      );
      if (window.HtmlFormCrewListKit?.applyTargetRowCount) {
        HtmlFormCrewListKit.applyTargetRowCount(tbody, targetRows, () => addRow());
      } else {
        while (tbody.children.length > targetRows) tbody.removeChild(tbody.lastChild);
        for (let i = tbody.children.length; i < targetRows; i++) addRow();
      }
      refreshRowNumbers();
      applyEditorZoom();
    }

    /** html2canvas mis-renders <input> text; kit flatten keeps PDF layout = HTML. */
    function flattenInputsForExport() {
      if (window.HtmlFormCrewListKit?.flattenInputsForExport) {
        HtmlFormCrewListKit.flattenInputsForExport(document);
        return;
      }
      document.querySelectorAll('input.ci, textarea.ci, input.fi').forEach((input) => {
        const replacement = document.createElement('div');
        replacement.className = input.className;
        replacement.textContent = input.value || '';
        replacement.style.display = 'block';
        replacement.style.width = '100%';
        replacement.style.height = '100%';
        replacement.style.boxSizing = 'border-box';
        replacement.style.overflow = 'hidden';
        input.replaceWith(replacement);
      });
    }

    function exportToExcel() {
      const btn = document.getElementById('btn-export-excel');
      if (btn) btn.disabled = true;
      try {
        if (!window.CrewHtmlFormExcel) throw new Error('Excel export is not available');
        window.CrewHtmlFormExcel.export({
          listType: 'type6V3SbkP2',
          beforeExport: savePositions,
          loadPositions,
        });
      } catch (e) {
        console.error('Excel export failed', e);
        alert(e?.message || 'Excel export failed');
        if (btn) btn.disabled = false;
      }
    }
    window.exportToExcel = exportToExcel;

    (async () => {
      const isPdfExport = new URLSearchParams(location.search).get('pdfExport') === '1';
      if (isPdfExport) {
        document.body.classList.add('is-pdf-export');
      }
      await loadAppData();
      if (!isPdfExport && window.CrewOverlayToolbar) {
        CrewOverlayToolbar.init({
          onStampChange: (on) => void toggleStamp(on),
          onSigChange: (on) => void toggleSignature(on),
        });
      }
      HtmlFormHeaderCells.init({
        scope: '.a4-landscape-page',
        beforeHeaderSelect: clearSelection,
        syncToolbarFromCell,
      });
      await restoreOverlaySettings();
      restoreCellStyles(); // Restore cell styling
      restoreCellValues();
      // Readonly ship fields always win over stale/empty saved cellValues.
      if (window._shipData) {
        const ship = window._shipData;
        const voyageEl = document.getElementById('h-voyage');
        if (voyageEl) voyageEl.value = ship.voyageNumber || '';
        const imoEl = document.getElementById('h-imo');
        if (imoEl) imoEl.value = ship.imoNo || '';
        const callEl = document.getElementById('h-call');
        if (callEl) callEl.value = ship.callSign || '';
      }
      window.HtmlFormLiveVoyageDate?.sync?.(window._adMode || 'arrival');
      // Row № is auto-only — wipe any legacy manual values restored from cellValues.
      refreshRowNumbers();
      syncRowHeights();
      if (isPdfExport) {
        resetEditorZoomForExport();
        // Drop the toolbars from the DOM (not just hide them) so the body shrinks to
        // exactly the page content — capture target == document.body, no cropping needed.
        document.querySelectorAll('.side-panel').forEach((el) => el.remove());
        if (window.CrewHtmlFormPdfSnapshot?.withPinnedOverlays) {
          CrewHtmlFormPdfSnapshot.withPinnedOverlays(() => flattenInputsForExport());
        } else {
          flattenInputsForExport();
        }
        CrewHtmlFormPdfSnapshot?.pullOverlaysToFooter?.();
        window.CrewHtmlFormPdfSnapshot?.prepForPrint?.();
      } else {
        initEditorZoom();
        if (window.CrewCellAlignToolbar) {
          CrewCellAlignToolbar.init({
            getSelectedCells: () => [...selectedCells, ...HtmlFormHeaderCells.getSelected()],
          });
        }
        if (window.CrewHtmlFormEditorDirty) {
          CrewHtmlFormEditorDirty.captureBaseline(EDITOR_DIRTY_OPTS);
        }
      }
      // Signal to a headless capture (iframe + html2canvas) that the page is fully populated.
      window.__pdfReady = true;
      // ?print=1 → generate PDF: open the browser print dialog once everything is rendered.
      if (new URLSearchParams(location.search).get('print') === '1') {
        setTimeout(() => window.print(), 500);
      }
    })();
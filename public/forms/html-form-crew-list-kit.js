/**
 * Shared crew-list editor helpers (forms 03–07):
 * - decimal font size
 * - horizontal align with inset classes (incl. row №)
 * - second-click wrap mode: caret + Alt+Enter only (no typing / spaces)
 */
(function (global) {
  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function cellText(cell) {
    if (!cell) return '';
    if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') return cell.value || '';
    return (cell.innerText || cell.textContent || '').replace(/^\s+|\s+$/g, '');
  }

  function isWrapEditableCell(cell) {
    return !!cell && cell.classList.contains('ci') && !cell.classList.contains('ci-rno');
  }

  function applyHorizontalAlignToCell(cell, val, syncCellFlexAlignment) {
    if (!cell) return;
    if (global.CrewCellFormat?.applyHorizontalAlign) {
      global.CrewCellFormat.applyHorizontalAlign(cell, val);
    } else {
      cell.style.textAlign = val;
    }
    if (cell.classList.contains('ci-rno')) {
      cell.style.display = 'flex';
      cell.style.alignItems = cell.style.alignItems || 'center';
    }
    if (typeof syncCellFlexAlignment === 'function') syncCellFlexAlignment(cell);
  }

  function applyFontSizeToCell(cell, val) {
    if (!cell) return;
    if (global.CrewCellFormat?.formatFontSizePt) {
      cell.style.fontSize = global.CrewCellFormat.formatFontSizePt(val) || val;
    } else {
      cell.style.fontSize = val;
    }
  }

  function syncToolbarFromCell(cell) {
    if (!cell) return;
    const fontSel = document.getElementById('tb-font');
    const sizeInp = document.getElementById('tb-size');
    const font = global.CrewCellFormat
      ? global.CrewCellFormat.resolveFontSelectValue(cell.style.fontFamily, fontSel)
      : cell.style.fontFamily || 'Arial';
    const parsed = global.CrewCellFormat?.parseFontSizePt?.(cell.style.fontSize);
    const size = parsed != null ? parsed : 6;
    if (fontSel) fontSel.value = font;
    if (sizeInp) sizeInp.value = String(size);
  }

  function applyFontSizeFromToolbar(applyFormat) {
    const el = document.getElementById('tb-size');
    if (!el || typeof applyFormat !== 'function') return;
    const parsed = global.CrewCellFormat?.parseFontSizePt?.(el.value);
    if (parsed == null) return;
    const clamped = Math.min(24, Math.max(3, parsed));
    const css = global.CrewCellFormat?.formatFontSizePt
      ? global.CrewCellFormat.formatFontSizePt(clamped)
      : `${clamped}pt`;
    el.value = String(clamped);
    applyFormat('fontSize', css);
  }

  function minRowHeightPx(tableRoot) {
    const probe = tableRoot?.querySelector?.('td, .td-cell, .table-row');
    if (!probe) return 18;
    const tbl =
      tableRoot?.closest?.('.crew-tbl') ||
      tableRoot?.closest?.('.crew-table') ||
      tableRoot?.querySelector?.('.crew-tbl');
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

  function syncCellHeight(cell, tableRoot) {
    if (!cell || cell.tagName !== 'TEXTAREA') return;
    cell.style.height = '0px';
    const next = Math.max(cell.scrollHeight, minRowHeightPx(tableRoot));
    cell.style.height = `${next}px`;
  }

  function syncRowHeights(tableRoot, rowEl) {
    if (!tableRoot) return;
    const rows = rowEl
      ? [rowEl]
      : Array.from(tableRoot.children).filter(
          (el) => el.tagName === 'TR' || el.classList?.contains('table-row'),
        );
    rows.forEach((row) => {
      row.querySelectorAll('textarea.ci').forEach((ta) => syncCellHeight(ta, tableRoot));
    });
  }

  /**
   * Install second-click edit + Alt+Enter wrap on a crew-list table body.
   * @returns {{ getEditingCell, exitCellEdit, enterCellEdit, syncRowHeights, isEditing }}
   */
  function installWrapEdit(options) {
    const tableRoot = options.tableRoot;
    const pageSelector = options.pageSelector || '.a4-page, .a4-landscape-page';
    const getSelectedCells = options.getSelectedCells || (() => []);
    const isEditable = options.isEditableCell || isWrapEditableCell;
    let editingCell = null;

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
      // Allow copy / select-all; never cut/paste/typing.
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'C', 'A'].includes(e.key)) return true;
      return false;
    }

    /** True when Backspace/Delete would only remove a line break (or selection with \\n). */
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
      // Wrap mode: no typing/spaces. Allow delete only when removing a line break.
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

    function bindWrapOnlyGuards(cell) {
      cell.addEventListener('beforeinput', onEditBeforeInput);
      cell.addEventListener('paste', onEditPaste);
    }

    function unbindWrapOnlyGuards(cell) {
      cell.removeEventListener('beforeinput', onEditBeforeInput);
      cell.removeEventListener('paste', onEditPaste);
    }

    function exitCellEdit() {
      if (!editingCell) return;
      const cell = editingCell;
      editingCell = null;
      cell.classList.remove('ci-editing');
      unbindWrapOnlyGuards(cell);
      if (cell.tagName === 'TEXTAREA' || cell.tagName === 'INPUT') {
        cell.readOnly = true;
        cell.blur();
      } else if (cell.isContentEditable) {
        cell.contentEditable = 'false';
        cell.blur();
      }
      syncCellHeight(cell, tableRoot);
    }

    function enterCellEdit(cell) {
      if (!isEditable(cell)) return;
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
      bindWrapOnlyGuards(cell);
      syncCellHeight(cell, tableRoot);
    }

    function insertLineBreak(cell) {
      if (!cell) return;
      if (cell.tagName === 'TEXTAREA') {
        const start = cell.selectionStart ?? cell.value.length;
        const end = cell.selectionEnd ?? start;
        const v = cell.value;
        cell.value = `${v.slice(0, start)}\n${v.slice(end)}`;
        const pos = start + 1;
        cell.setSelectionRange(pos, pos);
      } else if (cell.tagName !== 'INPUT') {
        document.execCommand('insertLineBreak');
      }
      syncCellHeight(cell, tableRoot);
    }

    /** Undo one Alt+Enter at the caret (Alt+Backspace). */
    function removeLineBreak(cell) {
      if (!cell) return;
      if (cell.tagName === 'TEXTAREA') {
        const start = cell.selectionStart ?? 0;
        const end = cell.selectionEnd ?? start;
        let v = cell.value;
        if (start !== end) {
          // Selection: drop newlines inside, keep other characters.
          const next = v.slice(0, start) + v.slice(start, end).replace(/\n/g, '') + v.slice(end);
          cell.value = next;
          cell.setSelectionRange(start, start + (end - start - (v.slice(start, end).match(/\n/g) || []).length));
        } else if (start > 0 && v[start - 1] === '\n') {
          cell.value = v.slice(0, start - 1) + v.slice(start);
          cell.setSelectionRange(start - 1, start - 1);
        } else if (start < v.length && v[start] === '\n') {
          cell.value = v.slice(0, start) + v.slice(start + 1);
          cell.setSelectionRange(start, start);
        }
      } else if (cell.tagName !== 'INPUT' && cell.isContentEditable) {
        // Prefer deleting a <br> / newline near the caret.
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) {
          const text = range.toString();
          if (text.includes('\n')) {
            document.execCommand('insertText', false, text.replace(/\n/g, ''));
          }
          return;
        }
        // Try backspace over a line break via execCommand when possible.
        document.execCommand('delete');
        // If that deleted a letter, undo is not available — keep simple: only when
        // previous char is newline in textContent walk is hard; use Alt+Backspace
        // mainly for textarea cells.
      }
      syncCellHeight(cell, tableRoot);
    }

    /** Flatten Alt+Enter wraps (used by Reset). */
    function clearAllLineBreaks() {
      if (!tableRoot) return;
      tableRoot.querySelectorAll('textarea.ci').forEach((ta) => {
        if (!ta.value.includes('\n')) return;
        ta.value = ta.value.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ');
        syncCellHeight(ta, tableRoot);
      });
      tableRoot.querySelectorAll('.ci-name').forEach((el) => {
        const t = el.textContent || '';
        if (!t.includes('\n')) return;
        el.textContent = t.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ');
      });
    }

    /** @returns {'edit'|'select'|null} */
    function handleTableMouseDown(e, ctx) {
      const cell = e.target.closest('.ci');
      if (!cell || !tableRoot.contains(cell)) return null;

      if (editingCell && editingCell === cell) {
        return 'edit'; // allow caret
      }

      const selected = getSelectedCells();
      if (
        !e.shiftKey &&
        selected.length === 1 &&
        selected[0] === cell &&
        isEditable(cell)
      ) {
        e.preventDefault();
        if (ctx) ctx.isDragging = false;
        enterCellEdit(cell);
        return 'edit';
      }

      exitCellEdit();
      return 'select';
    }

    function handleKeydown(e) {
      if (!editingCell) {
        // Block typing into row №
        const selected = getSelectedCells();
        if (
          selected.length === 1 &&
          selected[0].classList.contains('ci-rno') &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          (e.key === 'Backspace' || e.key === 'Delete' || e.key.length === 1)
        ) {
          e.preventDefault();
          return true;
        }
        return false;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        exitCellEdit();
        return true;
      }
      // Alt+Enter → line break only (no free typing).
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        insertLineBreak(editingCell);
        return true;
      }
      // Alt+Backspace → remove one line break at caret.
      if (e.key === 'Backspace' && e.altKey) {
        e.preventDefault();
        removeLineBreak(editingCell);
        return true;
      }
      // Plain Backspace/Delete: only when removing a \\n (unwrap). Letters stay locked.
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const dir = e.key === 'Backspace' ? 'backward' : 'forward';
        if (canDeleteNewline(editingCell, dir)) {
          const start = editingCell.selectionStart ?? 0;
          const end = editingCell.selectionEnd ?? start;
          if (start !== end) {
            e.preventDefault();
            removeLineBreak(editingCell);
          }
          // Collapsed caret on \\n: let native delete + beforeinput through.
          return true;
        }
        e.preventDefault();
        return true;
      }
      if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        exitCellEdit();
        return true;
      }
      if (isCaretNavigationKey(e)) {
        return true; // allow caret move / copy
      }
      // Block letters, digits, Space, Tab typing, etc.
      e.preventDefault();
      return true;
    }

    tableRoot.addEventListener('input', (e) => {
      const cell = e.target.closest?.('.ci');
      if (cell && editingCell === cell) syncCellHeight(cell, tableRoot);
    });

    document.querySelector(pageSelector)?.addEventListener('mousedown', (e) => {
      if (!editingCell) return;
      if (editingCell.contains(e.target)) return;
      if (e.target.closest('.ci')) return;
      exitCellEdit();
    });

    return {
      getEditingCell: () => editingCell,
      isEditing: () => !!editingCell,
      exitCellEdit,
      enterCellEdit,
      handleTableMouseDown,
      handleKeydown,
      syncRowHeights: (row) => syncRowHeights(tableRoot, row),
      syncCellHeight: (cell) => syncCellHeight(cell, tableRoot),
      clearAllLineBreaks,
      removeLineBreak,
      cellText,
      escapeHtml,
      isWrapEditableCell: isEditable,
    };
  }

  /** Strip inline layout leftovers that can skew the date|place divider. */
  function repairBirthSplitLayout(root) {
    if (!root) return;
    root.querySelectorAll('.ci-birth-date, .ci-birth-place').forEach((el) => {
      el.style.removeProperty('width');
      el.style.removeProperty('max-width');
      el.style.removeProperty('flex');
      el.style.removeProperty('display');
      el.style.removeProperty('height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('align-items');
      el.style.removeProperty('justify-content');
    });
  }

  /**
   * Swap inputs/textareas for plain divs before PDF capture.
   * Keep row height/padding like the HTML editor (textarea min-height + vertical center).
   * Do NOT copy wrap-edit inline heights that stretch rows.
   */
  function flattenInputsForExport(root) {
    const scope = root || document;
    const rowMin = 'var(--crew-row-h, 5mm)';

    scope.querySelectorAll('input.ci, textarea.ci, input.fi').forEach((input) => {
      const replacement = document.createElement('div');
      replacement.className = input.className;
      const raw =
        input.tagName === 'INPUT' || input.tagName === 'TEXTAREA'
          ? input.value || ''
          : input.textContent || '';
      replacement.textContent = raw;

      // Typography / emphasis / align — not layout from wrap-edit.
      const s = input.style;
      if (s.fontFamily) replacement.style.fontFamily = s.fontFamily;
      if (s.fontSize) replacement.style.fontSize = s.fontSize;
      if (s.fontWeight) replacement.style.fontWeight = s.fontWeight;
      if (s.fontStyle) replacement.style.fontStyle = s.fontStyle;
      if (s.textDecoration) replacement.style.textDecoration = s.textDecoration;
      else if (s.textDecorationLine) replacement.style.textDecoration = s.textDecorationLine;
      if (s.textAlign) replacement.style.textAlign = s.textAlign;
      if (s.width && (input.classList.contains('fi') || input.classList.contains('form-footer__master'))) {
        replacement.style.width = s.width;
      }

      const inHeader =
        input.closest('.header-block') ||
        (input.closest('.imo-table') && !input.closest('.doc-footer'));
      if (inHeader || input.classList.contains('fi')) {
        replacement.style.border = 'none';
        replacement.style.borderBottom = 'none';
      }

      const isFooterDate =
        input.id === 'f-footer-date' || input.classList.contains('form-footer__date');
      if (isFooterDate) {
        replacement.style.display = 'inline';
        replacement.style.width = 'auto';
        replacement.style.maxWidth = '100%';
        replacement.style.overflow = 'visible';
        replacement.style.whiteSpace = 'nowrap';
        replacement.style.fontSize = s.fontSize || '8pt';
        replacement.style.fontWeight = s.fontWeight || '700';
        replacement.style.textAlign = s.textAlign || 'left';
        input.replaceWith(replacement);
        return;
      }

      if (input.classList.contains('ci')) {
        const ta = (s.textAlign || '').toLowerCase();
        const jc = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
        const isBirthDate = input.classList.contains('ci-birth-date');
        const isBirthPlace = input.classList.contains('ci-birth-place');
        const hasManualWrap = raw.includes('\n');
        // Editor textareas soft-wrap; PDF must do the same or long place/rank overflows.
        const allowSoftWrap =
          isBirthPlace ||
          input.tagName === 'TEXTAREA' ||
          hasManualWrap;

        replacement.style.boxSizing = 'border-box';
        replacement.style.width = '100%';
        replacement.style.minHeight = rowMin;
        replacement.style.overflow = 'hidden';
        replacement.style.lineHeight = '1.2';

        if (isBirthDate) {
          replacement.style.display = 'flex';
          replacement.style.alignItems = s.alignItems || 'center';
          replacement.style.justifyContent = jc;
          replacement.style.height = 'auto';
          replacement.style.alignSelf = 'center';
          replacement.style.whiteSpace = 'nowrap';
        } else if (allowSoftWrap) {
          // Match editor textarea: soft-wrap + grow row (HTML ≡ PDF).
          replacement.style.display = 'block';
          replacement.style.height = 'auto';
          replacement.style.alignSelf = isBirthPlace ? 'center' : '';
          replacement.style.whiteSpace = 'pre-wrap';
          replacement.style.overflowWrap = 'break-word';
          replacement.style.wordBreak = 'normal';
          if (ta) replacement.style.textAlign = ta;
        } else {
          replacement.style.display = 'flex';
          replacement.style.alignItems = s.alignItems || 'center';
          replacement.style.justifyContent = jc;
          replacement.style.height = '100%';
          replacement.style.whiteSpace = 'nowrap';
        }
      }

      input.replaceWith(replacement);
    });

    // Names are already divs — drop wrap-edit pixel heights, keep soft-wrap like editor.
    scope.querySelectorAll('div.ci.ci-name').forEach((el) => {
      el.style.removeProperty('height');
      if (!el.style.minHeight) el.style.minHeight = rowMin;
      el.style.display = 'block';
      el.style.whiteSpace = 'pre-wrap';
      el.style.overflowWrap = 'break-word';
      el.style.wordBreak = 'normal';
      el.style.lineHeight = el.style.lineHeight || '1.2';
      el.style.overflow = 'hidden';
    });
  }

  /** Build a textarea.ci markup snippet for addRow templates. */
  function textareaHtml(cls, val) {
    const c = cls ? ` ${cls}` : '';
    return `<textarea class="ci${c}" rows="1" readonly tabindex="-1">${escapeHtml(val || '')}</textarea>`;
  }

  global.HtmlFormCrewListKit = {
    escapeHtml,
    cellText,
    isWrapEditableCell,
    applyHorizontalAlignToCell,
    applyFontSizeToCell,
    syncToolbarFromCell,
    applyFontSizeFromToolbar,
    syncRowHeights,
    syncCellHeight,
    installWrapEdit,
    textareaHtml,
    repairBirthSplitLayout,
    flattenInputsForExport,
  };
})(typeof window !== 'undefined' ? window : globalThis);

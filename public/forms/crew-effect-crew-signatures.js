/**
 * Crew Effect forms 01/02 — per-row crew signatures inside Signature column cells.
 */
(function (global) {
  const IDB_NAME = 'crew-signatures';
  const IDB_STORE = 'signatures';

  function electronApi() {
    return global.electronAPI || (global.parent && global.parent.electronAPI) || null;
  }

  async function idbGetSignature(crewId) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          resolve(null);
          return;
        }
        const tx = db.transaction(IDB_STORE, 'readonly');
        const getReq = tx.objectStore(IDB_STORE).get(crewId);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
    });
  }

  function bytesToDataUrl(bytes, fileName) {
    const name = String(fileName || '').toLowerCase();
    const mime = name.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  async function loadCrewSignatureUrl(crewId) {
    const api = electronApi();
    if (api?.readCrewSignature) {
      try {
        const b64 = await api.readCrewSignature(crewId);
        if (!b64) return null;
        if (b64.startsWith('data:')) return b64;
        return `data:image/png;base64,${b64}`;
      } catch (e) {
        return null;
      }
    }
    try {
      const buf = await idbGetSignature(crewId);
      if (!buf) return null;
      return bytesToDataUrl(new Uint8Array(buf));
    } catch (e) {
      return null;
    }
  }

  function overlayChromeHtml(url) {
    return (
      `<img src="${url}" alt="" draggable="false" />` +
      `<span class="overlay-h overlay-h--e"></span>` +
      `<span class="overlay-h overlay-h--w"></span>` +
      `<span class="overlay-h overlay-h--n"></span>` +
      `<span class="overlay-h overlay-h--s"></span>` +
      `<span class="overlay-resize" title="Resize (proportional)"></span>`
    );
  }

  function defaultCellBox(cellEl) {
    const w = cellEl.clientWidth || 60;
    const h = cellEl.clientHeight || 18;
    const sigW = Math.max(20, Math.round(w * 0.88));
    const sigH = Math.max(10, Math.round(h * 0.75));
    return {
      left: `${Math.max(0, Math.round((w - sigW) / 2))}px`,
      top: `${Math.max(0, Math.round((h - sigH) / 2))}px`,
      width: `${sigW}px`,
      height: `${sigH}px`,
    };
  }

  function cellBoxFromTweak(tweak, cellEl) {
    if (tweak?.cellLeft && tweak?.cellTop && tweak?.cellWidth && tweak?.cellHeight) {
      return {
        left: tweak.cellLeft,
        top: tweak.cellTop,
        width: tweak.cellWidth,
        height: tweak.cellHeight,
      };
    }
    return defaultCellBox(cellEl);
  }

  function tweakFromElement(el) {
    if (!el) return {};
    return {
      cellLeft: el.style.left || `${el.offsetLeft}px`,
      cellTop: el.style.top || `${el.offsetTop}px`,
      cellWidth: el.style.width || `${el.offsetWidth}px`,
      cellHeight: el.style.height || `${el.offsetHeight}px`,
    };
  }

  function applyBox(el, box) {
    if (!el || !box) return;
    if (box.left != null) el.style.left = box.left;
    if (box.top != null) el.style.top = box.top;
    if (box.width != null) el.style.width = box.width;
    if (box.height != null) el.style.height = box.height;
  }

  function createModule() {
    let opts = null;
    let enabled = false;
    let showAll = true;
    let activeRow = 0;
    let byRow = {};
    let members = [];
    let crewSigDirty = false;
    const urlCache = new Map();

    function sigCell(row) {
      return document.querySelector(`.ced-sig-cell[data-ce-sig-row="${row}"]`);
    }

    function sigOverlay(row) {
      const cell = sigCell(row);
      return cell?.querySelector('.ced-crew-sig') || null;
    }

    function ensureOverlayEl(row) {
      const cell = sigCell(row);
      if (!cell) return null;
      let el = cell.querySelector('.ced-crew-sig');
      if (!el) {
        el = document.createElement('div');
        el.className = 'ced-crew-sig';
        el.dataset.crewSigRow = String(row);
        cell.appendChild(el);
      }
      return el;
    }

    function wrapSignatureCells() {
      const keyFn = opts?.signatureCol;
      if (!keyFn) return;
      document.querySelectorAll('#ced-crew tr.ced-tr-data').forEach((tr) => {
        const row = Number(tr.dataset.ceRow);
        if (!Number.isFinite(row)) return;
        const input = tr.querySelector(`[data-cell-key="${keyFn(row)}"]`);
        if (!input) return;
        const wrap = input.closest('.ced-data-val');
        if (!wrap) return;
        wrap.classList.add('ced-sig-cell');
        wrap.dataset.ceSigRow = String(row);
        ensureOverlayEl(row);
      });
    }

    function memberAt(row) {
      return members[row] || null;
    }

    function refreshMembers() {
      members = typeof opts?.getMembers === 'function' ? opts.getMembers() || [] : [];
      return members;
    }

    function populateRowSelect() {
      const sel = document.getElementById('ced-crew-sig-row');
      if (!sel) return;
      const prev = Number(sel.value);
      sel.innerHTML = '';
      members.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        const sigMark = m.hasSignature ? '' : ' (no file)';
        opt.textContent = `${i + 1} — ${m.label || 'Row ' + (i + 1)}${sigMark}`;
        sel.appendChild(opt);
      });
      if (members.length) {
        activeRow = Number.isFinite(prev) && prev >= 0 && prev < members.length ? prev : 0;
        sel.value = String(activeRow);
      }
    }

    function setEditableRow(row) {
      document.querySelectorAll('.ced-crew-sig').forEach((el) => {
        const r = Number(el.dataset.crewSigRow);
        const isActive = enabled && r === row;
        el.classList.toggle('ced-crew-sig--editable', isActive);
        el.classList.toggle('ced-crew-sig--ghost', enabled && showAll && r !== row);
      });
    }

    function makeDraggable(el) {
      if (!el || el.dataset.overlayDrag === '1' || !global.CrewOverlayDrag) return;
      el.dataset.overlayDrag = '1';
      CrewOverlayDrag.attach(el, () => (typeof opts?.getScale === 'function' ? opts.getScale() : 1), () => {
        const row = Number(el.dataset.crewSigRow);
        if (Number.isFinite(row)) {
          byRow[String(row)] = { ...(byRow[String(row)] || {}), ...tweakFromElement(el) };
        }
        if (opts?.onDirty) opts.onDirty();
        crewSigDirty = true;
      });
    }

    async function renderRow(row, { editable = false } = {}) {
      const member = memberAt(row);
      const el = ensureOverlayEl(row);
      if (!el || !enabled || !member?.hasSignature || !member.id) {
        el?.classList.remove('visible', 'ced-crew-sig--editable', 'ced-crew-sig--ghost');
        return;
      }

      let url = urlCache.get(member.id);
      if (!url) {
        url = await loadCrewSignatureUrl(member.id);
        if (url) urlCache.set(member.id, url);
      }
      if (!url) {
        el.classList.remove('visible');
        return;
      }

      if (!el.querySelector('img')) {
        el.innerHTML = overlayChromeHtml(url);
        makeDraggable(el);
      } else {
        el.querySelector('img').src = url;
      }

      const cell = sigCell(row);
      const box = cellBoxFromTweak(byRow[String(row)], cell || el.parentElement);
      applyBox(el, box);
      el.classList.add('visible');
      el.classList.toggle('ced-crew-sig--editable', editable);
      el.classList.toggle('ced-crew-sig--ghost', enabled && showAll && !editable);
    }

    async function refreshAll() {
      if (!enabled) {
        document.querySelectorAll('.ced-crew-sig').forEach((el) => {
          el.classList.remove('visible', 'ced-crew-sig--editable', 'ced-crew-sig--ghost');
        });
        return;
      }
      const jobs = [];
      for (let i = 0; i < members.length; i++) {
        const member = memberAt(i);
        if (!member?.hasSignature) continue;
        const show = showAll || i === activeRow;
        if (!show) {
          const el = sigOverlay(i);
          el?.classList.remove('visible');
          continue;
        }
        jobs.push(renderRow(i, { editable: i === activeRow }));
      }
      await Promise.all(jobs);
      setEditableRow(activeRow);
    }

    function bindPanel() {
      const onToggle = document.getElementById('ced-crew-sig-on');
      const allToggle = document.getElementById('ced-crew-sig-all');
      const rowSel = document.getElementById('ced-crew-sig-row');
      const applyBtn = document.getElementById('ced-crew-sig-apply-all');

      onToggle?.addEventListener('change', () => {
        enabled = !!onToggle.checked;
        void refreshAll();
        if (opts?.onDirty) opts.onDirty();
        crewSigDirty = true;
      });

      allToggle?.addEventListener('change', () => {
        showAll = !!allToggle.checked;
        void refreshAll();
      });

      rowSel?.addEventListener('change', () => {
        activeRow = Number(rowSel.value) || 0;
        void refreshAll();
      });

      applyBtn?.addEventListener('click', () => {
        const el = sigOverlay(activeRow);
        if (!el) return;
        const tweak = tweakFromElement(el);
        members.forEach((m, i) => {
          if (!m?.hasSignature) return;
          byRow[String(i)] = { ...(byRow[String(i)] || {}), ...tweak };
        });
        void refreshAll();
        if (opts?.onDirty) opts.onDirty();
        crewSigDirty = true;
      });
    }

    function syncPanel() {
      const onToggle = document.getElementById('ced-crew-sig-on');
      const allToggle = document.getElementById('ced-crew-sig-all');
      if (onToggle) onToggle.checked = enabled;
      if (allToggle) allToggle.checked = showAll;
      populateRowSelect();
    }

    return {
      init(options) {
        opts = options || {};
        wrapSignatureCells();
        bindPanel();
      },

      restoreFromOverlay(variant) {
        enabled = !!variant?.useCrewSignatures;
        crewSigDirty = false;
        byRow = {};
        const raw = variant?.crewSignatureByRow;
        if (raw && typeof raw === 'object') {
          for (const [key, val] of Object.entries(raw)) {
            if (!val || typeof val !== 'object') continue;
            byRow[key] = { ...val };
          }
        }
        refreshMembers();
        syncPanel();
      },

      async restore() {
        refreshMembers();
        syncPanel();
        await refreshAll();
      },

      collectState() {
        document.querySelectorAll('.ced-crew-sig.visible').forEach((el) => {
          const row = el.dataset.crewSigRow;
          if (row == null) return;
          byRow[row] = { ...(byRow[row] || {}), ...tweakFromElement(el) };
        });
        const out = {};
        for (const [key, tweak] of Object.entries(byRow)) {
          if (!tweak || typeof tweak !== 'object') continue;
          const entry = {};
          if (tweak.cellLeft) entry.cellLeft = tweak.cellLeft;
          if (tweak.cellTop) entry.cellTop = tweak.cellTop;
          if (tweak.cellWidth) entry.cellWidth = tweak.cellWidth;
          if (tweak.cellHeight) entry.cellHeight = tweak.cellHeight;
          if (tweak.offsetX != null) entry.offsetX = tweak.offsetX;
          if (tweak.offsetY != null) entry.offsetY = tweak.offsetY;
          if (tweak.width != null) entry.width = tweak.width;
          if (tweak.height != null) entry.height = tweak.height;
          if (Object.keys(entry).length) out[key] = entry;
        }
        return {
          useCrewSignatures: enabled,
          crewSignatureByRow: out,
        };
      },

      isEnabled() {
        return enabled;
      },

      isDirty(savedEnabled) {
        if (crewSigDirty) return true;
        return enabled !== !!savedEnabled;
      },

      async onMembersChanged() {
        urlCache.clear();
        refreshMembers();
        populateRowSelect();
        await refreshAll();
      },

      reset() {
        enabled = false;
        byRow = {};
        crewSigDirty = false;
        urlCache.clear();
        document.querySelectorAll('.ced-crew-sig').forEach((el) => {
          el.classList.remove('visible', 'ced-crew-sig--editable', 'ced-crew-sig--ghost');
          el.style.cssText = '';
          el.innerHTML = '';
          delete el.dataset.overlayDrag;
        });
        syncPanel();
      },

      /** PDF export — draw signatures into cells (no chrome). */
      async renderForExport(pageEl, variant, membersList) {
        if (!variant?.useCrewSignatures || !pageEl) return;
        const rows = membersList || members;
        const saved = variant.crewSignatureByRow || {};
        for (let i = 0; i < rows.length; i++) {
          const member = rows[i];
          if (!member?.hasSignature || !member.id) continue;
          const cell = pageEl.querySelector(`.ced-sig-cell[data-ce-sig-row="${i}"]`);
          if (!cell) continue;
          let el = cell.querySelector('.ced-crew-sig');
          if (!el) {
            el = document.createElement('div');
            el.className = 'ced-crew-sig visible';
            cell.appendChild(el);
          }
          const url = await loadCrewSignatureUrl(member.id);
          if (!url) continue;
          el.innerHTML = `<img src="${url}" alt="" />`;
          applyBox(el, cellBoxFromTweak(saved[String(i)], cell));
          el.classList.add('visible');
        }
      },
    };
  }

  global.CrewEffectCrewSignatures = { create: createModule, loadCrewSignatureUrl };
})(typeof window !== 'undefined' ? window : globalThis);

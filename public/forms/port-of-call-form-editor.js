/**
 * Port of Call HTML editor shell — save, zoom, overlay persistence.
 */
(function (global) {
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;
  const APP_DATA_SCHEMA_VERSION = 19;
  let editorZoomPct = 100;

  function electronApi() {
    return global.electronAPI || (global.parent && global.parent.electronAPI) || null;
  }

  /** Full AppData from disk — used for Save (never a PDF capture snapshot). */
  async function readPersistedAppData() {
    const api = electronApi();
    if (api) {
      try {
        const data = await api.readData();
        if (data) return data;
      } catch (e) {
        /* ignore */
      }
    }
    try {
      const raw = localStorage.getItem('crew-app-data');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
    return global._appData || null;
  }

  /** Bootstrap editor/PDF: prefer capture snapshot, else live AppData. */
  async function readBootstrapAppData() {
    const snapshot = global.CrewHtmlFormPdfSnapshot ? global.CrewHtmlFormPdfSnapshot.read() : null;
    if (snapshot) return snapshot;
    return readPersistedAppData();
  }

  function cssBoxFromVariant(box) {
    if (!box || typeof box !== 'object') return null;
    if (
      typeof box.left === 'string' &&
      typeof box.top === 'string' &&
      typeof box.width === 'string' &&
      typeof box.height === 'string'
    ) {
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    return null;
  }

  function overlayCssBox(saved, prevBox, defaults) {
    const box = { ...(defaults || {}), ...(prevBox || {}) };
    if (saved?.left) box.left = saved.left;
    if (saved?.top) box.top = saved.top;
    if (saved?.width) box.width = saved.width;
    if (saved?.height) box.height = saved.height;
    if (
      typeof box.left === 'string' &&
      typeof box.top === 'string' &&
      typeof box.width === 'string' &&
      typeof box.height === 'string'
    ) {
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    return undefined;
  }

  function createEditor(overlayKey, feedbackParam) {
    global._currentPositions = null;
    let cellBridge = null;
    let rowsBridge = null;
    let savedRowsPerPage = null;
    /** After first paint, keep in-session toggle state across page changes. */
    let overlayFlagsHydrated = false;

    function loadPositions() {
      if (global._currentPositions) return global._currentPositions;

      let loaded = null;
      try {
        const variant = global._appData?.documentOverlay?.[overlayKey];
        if (variant) {
          const stampCss = cssBoxFromVariant(variant.stampBox);
          const sigCss = cssBoxFromVariant(variant.signatureBox);
          loaded = {
            stamp: {
              visible: !!variant.useStamp,
              left: stampCss?.left,
              top: stampCss?.top,
              width: stampCss?.width,
              height: stampCss?.height,
            },
            sig: {
              visible: !!variant.useSignature,
              left: sigCss?.left,
              top: sigCss?.top,
              width: sigCss?.width,
              height: sigCss?.height,
            },
            cellStyles: variant.cellStyles || {},
            cellValues: variant.cellValues || {},
            dateDisplayFormat: variant.dateDisplayFormat || 'dot',
            rowsPerPage:
              typeof variant.rowsPerPage === 'number'
                ? variant.rowsPerPage
                : global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11,
          };
        }
      } catch (e) {
        /* ignore */
      }

      global._currentPositions = loaded || {
        stamp: {},
        sig: {},
        cellStyles: {},
        cellValues: {},
        dateDisplayFormat: 'dot',
        rowsPerPage: global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11,
      };
      savedRowsPerPage = global._currentPositions.rowsPerPage;
      return global._currentPositions;
    }

    function captureRowsPerPage() {
      const count = rowsBridge?.getCount?.() ?? global.PortOfCallFormRows?.getRowsPerPage?.();
      if (typeof count === 'number') {
        if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {} };
        global._currentPositions.rowsPerPage = count;
      }
    }

    function isEditorDirty() {
      captureRowsPerPage();
      if (global.PortOfCallFormCells?.isDirty?.()) return true;
      if (savedRowsPerPage !== null && global._currentPositions?.rowsPerPage !== savedRowsPerPage) {
        return true;
      }
      savePositions();
      const extra = {
        rowsPerPage: global._currentPositions?.rowsPerPage ?? null,
        dateDisplayFormat:
          global.HtmlFormDateFormat?.getActive?.() ||
          global._currentPositions?.dateDisplayFormat ||
          'dot',
      };
      if (global.CrewHtmlFormEditorDirty?.isOverlayDirty) {
        return global.CrewHtmlFormEditorDirty.isOverlayDirty(() => loadPositions(), extra);
      }
      return false;
    }

    function captureEditorDirtyBaseline() {
      loadPositions();
      // Do NOT call savePositions() here. Early row-baseline capture runs before
      // overlays are restored; reading empty DOM would clobber useStamp/useSignature
      // loaded from app data into visible:false, and restore would then skip them.
      captureRowsPerPage();
      savedRowsPerPage = global._currentPositions?.rowsPerPage ?? null;
      const extra = {
        rowsPerPage: savedRowsPerPage,
        dateDisplayFormat:
          global.HtmlFormDateFormat?.getActive?.() ||
          global._currentPositions?.dateDisplayFormat ||
          'dot',
      };
      if (global.CrewHtmlFormEditorDirty?.captureOverlayBaseline) {
        global.CrewHtmlFormEditorDirty.captureOverlayBaseline(() => loadPositions(), extra);
      }
    }

    function hydrateOverlayFlagsFromAppData() {
      const variant = global._appData?.documentOverlay?.[overlayKey];
      if (!variant) return;
      if (!global._currentPositions) {
        loadPositions();
        return;
      }
      global._currentPositions.stamp = {
        ...(global._currentPositions.stamp || {}),
        visible: !!variant.useStamp,
        ...(cssBoxFromVariant(variant.stampBox) || {}),
      };
      global._currentPositions.sig = {
        ...(global._currentPositions.sig || {}),
        visible: !!variant.useSignature,
        ...(cssBoxFromVariant(variant.signatureBox) || {}),
      };
    }

    function captureCellStyles() {
      if (cellBridge?.collect) {
        if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
        global._currentPositions.cellStyles = cellBridge.collect();
      }
    }

    function captureCellValues() {
      if (!cellBridge?.collectValues) return;
      const pageIndex = global.PortOfCallFormPages?.getCurrent?.() ?? 0;
      const rowsPerPage =
        global._currentPositions?.rowsPerPage ?? global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11;
      const voyOffset = pageIndex * rowsPerPage;
      if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
      global._currentPositions.cellValues = {
        ...(global._currentPositions.cellValues || {}),
        ...cellBridge.collectValues(voyOffset),
      };
    }

    function overlayBoxFromElement(el) {
      if (!el || !el.classList.contains('visible')) return {};
      const left = el.style.left;
      const top = el.style.top;
      const width = el.style.width;
      const height = el.style.height;
      // Prefer explicit style (mm / calc / px). offset* only when style was cleared
      // after a drag pin — never invent 0px for an unpositioned hidden sibling.
      return {
        left: left || (el.offsetLeft ? `${el.offsetLeft}px` : undefined),
        top: top || (el.offsetTop ? `${el.offsetTop}px` : undefined),
        width: width || (el.offsetWidth ? `${el.offsetWidth}px` : undefined),
        height: height || (el.offsetHeight ? `${el.offsetHeight}px` : undefined),
      };
    }

    function savePositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const stampVisible = !!stamp?.classList.contains('visible');
      const sigVisible = !!sig?.classList.contains('visible');
      // Toolbar may already be "on" while the sibling overlay is not painted yet
      // (restore enables stamp then signature). Only read geometry from visible nodes.
      const stampOn = stampVisible || (global.CrewOverlayToolbar?.isStampOn() ?? false);
      const sigOn = sigVisible || (global.CrewOverlayToolbar?.isSigOn() ?? false);
      const stampBox = stampVisible ? overlayBoxFromElement(stamp) : {};
      const sigBox = sigVisible ? overlayBoxFromElement(sig) : {};
      if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {} };
      global._currentPositions.stamp = {
        visible: stampOn,
        left: stampBox.left || global._currentPositions.stamp?.left,
        top: stampBox.top || global._currentPositions.stamp?.top,
        width: stampBox.width || global._currentPositions.stamp?.width,
        height: stampBox.height || global._currentPositions.stamp?.height,
      };
      global._currentPositions.sig = {
        visible: sigOn,
        left: sigBox.left || global._currentPositions.sig?.left,
        top: sigBox.top || global._currentPositions.sig?.top,
        width: sigBox.width || global._currentPositions.sig?.width,
        height: sigBox.height || global._currentPositions.sig?.height,
      };
      if (global.CrewOverlayToolbar) {
        CrewOverlayToolbar.setStampOn(stampOn);
        CrewOverlayToolbar.setSigOn(sigOn);
      }
    }

    function navigateBack(feedback) {
      const params = new URLSearchParams(location.search);
      const returnRaw = params.get('return');
      const base = returnRaw ? decodeURIComponent(returnRaw) : '/?portOfCallSettings=1';
      const url = new URL(base, location.origin);
      url.searchParams.set(feedbackParam, feedback);
      window.location.href = url.pathname + url.search;
    }

    async function persistAllChanges() {
      savePositions();
      captureCellStyles();
      captureCellValues();
      captureRowsPerPage();
      const appData = await readPersistedAppData();
      if (!appData?.ship) {
        alert('Cannot save: application data is not loaded.');
        return;
      }
      if (!appData.documentOverlay) appData.documentOverlay = {};
      const prev = appData.documentOverlay[overlayKey] || {};
      const defaultStamp = global.CrewPortOfCallPdf?.defaultStampCss?.() || null;
      const defaultSig = global.CrewPortOfCallPdf?.defaultSignatureCss?.() || null;
      const stampBox = overlayCssBox(
        global._currentPositions.stamp,
        cssBoxFromVariant(prev.stampBox),
        defaultStamp,
      );
      const signatureBox = overlayCssBox(
        global._currentPositions.sig,
        cssBoxFromVariant(prev.signatureBox),
        defaultSig,
      );
      const { footerSignatureDate: _omitFooterDate, ...prevWithoutFooterDate } = prev;
      appData.documentOverlay[overlayKey] = {
        ...prevWithoutFooterDate,
        useStamp: !!global._currentPositions.stamp.visible,
        useSignature: !!global._currentPositions.sig.visible,
        ...(stampBox && global._currentPositions.stamp.visible ? { stampBox } : {}),
        ...(signatureBox && global._currentPositions.sig.visible ? { signatureBox } : {}),
        cellStyles: global._currentPositions.cellStyles || {},
        cellValues: global.HtmlFormLiveVoyageDate?.stripLiveVoyageKeys
          ? global.HtmlFormLiveVoyageDate.stripLiveVoyageKeys(global._currentPositions.cellValues || {})
          : global._currentPositions.cellValues || {},
        dateDisplayFormat: global.HtmlFormDateFormat?.getActive?.() || global._currentPositions.dateDisplayFormat || 'dot',
        rowsPerPage: global._currentPositions.rowsPerPage ?? global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11,
        ...(global.HtmlFormFooterFields?.getMasterName?.()?.trim()
          ? { footerMasterName: global.HtmlFormFooterFields.getMasterName().trim() }
          : {}),
      };
      appData.seedVersion = APP_DATA_SCHEMA_VERSION;
      global._appData = appData;
      try {
        const api = electronApi();
        if (api) await api.writeData(appData);
        else localStorage.setItem('crew-app-data', JSON.stringify(appData));
      } catch (e) {
        console.error(e);
        alert('Failed to save settings.');
        return;
      }
      navigateBack('saved');
    }

    function showConfirmModal() {
      if (!isEditorDirty()) {
        navigateBack('cancelled');
        return;
      }
      document.getElementById('confirm-modal').style.display = 'flex';
    }

    function hideConfirmModal() {
      document.getElementById('confirm-modal').style.display = 'none';
    }

    function confirmCancel() {
      hideConfirmModal();
      navigateBack('cancelled');
    }

    function resetOverlays() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      if (stamp) {
        stamp.classList.remove('visible');
        stamp.style.cssText = '';
        stamp.innerHTML = '';
        delete stamp.dataset.overlayDrag;
      }
      if (sig) {
        sig.classList.remove('visible');
        sig.style.cssText = '';
        sig.innerHTML = '';
        delete sig.dataset.overlayDrag;
      }
      if (global.CrewOverlayToolbar) {
        CrewOverlayToolbar.setStampOn(false);
        CrewOverlayToolbar.setSigOn(false);
      }
    }

    function resetPositions() {
      global._currentPositions = {
        stamp: { visible: false },
        sig: { visible: false },
        cellStyles: {},
        cellValues: {},
        dateDisplayFormat: 'dot',
        rowsPerPage: global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11,
      };
      overlayFlagsHydrated = true;
      resetOverlays();
      if (cellBridge?.resetPage) cellBridge.resetPage();
    }

    async function loadAsset(kind) {
      return global.CrewPortOfCallPdf?.loadAsset?.(kind) ?? null;
    }

    function editorScaleFactor() {
      return editorZoomPct / 100;
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

    function makeDraggable(el) {
      if (!el || el.dataset.overlayDrag === '1') return;
      el.dataset.overlayDrag = '1';
      if (global.CrewOverlayDrag) {
        CrewOverlayDrag.attach(el, editorScaleFactor, savePositions);
      }
    }

    function overlayCssPos(saved, defaults) {
      const pick = (v, fallback) =>
        typeof v === 'string' && v.trim() && v.trim() !== '0px' ? v : fallback;
      return {
        left: pick(saved?.left, defaults.left),
        top: pick(saved?.top, defaults.top),
        width: pick(saved?.width, defaults.width),
        height: pick(saved?.height, defaults.height),
      };
    }

    function showOverlay(el, url, pos) {
      if (!el) return;
      if (!el.querySelector('img')) {
        el.innerHTML = overlayChromeHtml(url);
        makeDraggable(el);
      } else {
        el.querySelector('img').src = url;
      }
      if (pos?.left) el.style.left = pos.left;
      if (pos?.top) el.style.top = pos.top;
      if (pos?.width) el.style.width = pos.width;
      if (pos?.height) el.style.height = pos.height;
      el.classList.add('visible');
    }

    async function toggleStamp(checked) {
      const el = document.getElementById('stamp-container');
      if (!checked) {
        el?.classList.remove('visible');
        savePositions();
        return;
      }
      const url = await loadAsset('stamp');
      if (url) {
        const saved = loadPositions().stamp;
        const defaults = global.CrewPortOfCallPdf?.defaultStampCss?.() || {};
        showOverlay(el, url, overlayCssPos(saved, defaults));
        savePositions();
      } else {
        if (global.CrewOverlayToolbar) CrewOverlayToolbar.setStampOn(false);
        alert('Stamp not found. Please upload it in Settings.');
      }
    }

    async function toggleSignature(checked) {
      const el = document.getElementById('sig-container');
      if (!checked) {
        el?.classList.remove('visible');
        savePositions();
        return;
      }
      const url = await loadAsset('signature');
      if (url) {
        const saved = loadPositions().sig;
        const defaults = global.CrewPortOfCallPdf?.defaultSignatureCss?.() || {};
        showOverlay(el, url, overlayCssPos(saved, defaults));
        savePositions();
      } else {
        if (global.CrewOverlayToolbar) CrewOverlayToolbar.setSigOn(false);
        alert('Signature not found. Please upload it in Settings.');
      }
    }

    async function restoreOverlaySettings() {
      // First restore only: re-apply useStamp/useSignature from AppData (global Settings
      // toggles + last Save). Later page changes keep in-session toggle state.
      if (!overlayFlagsHydrated) {
        hydrateOverlayFlagsFromAppData();
        overlayFlagsHydrated = true;
      }
      const saved = loadPositions();
      if (global.CrewOverlayToolbar) {
        CrewOverlayToolbar.setStampOn(!!saved.stamp?.visible);
        CrewOverlayToolbar.setSigOn(!!saved.sig?.visible);
      }
      if (saved.stamp?.visible) {
        try {
          await toggleStamp(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        document.getElementById('stamp-container')?.classList.remove('visible');
      }
      if (saved.sig?.visible) {
        try {
          await toggleSignature(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        document.getElementById('sig-container')?.classList.remove('visible');
      }
    }

    function applyEditorZoom() {
      const stage = document.getElementById('doc-zoom-stage');
      const pad = document.getElementById('doc-zoom-pad');
      const slot = document.getElementById('doc-zoom-slot');
      const page = stage?.querySelector('.a4-page');
      const nav = document.getElementById('poc-page-nav');
      const label = document.getElementById('zoom-label');
      const scale = editorZoomPct / 100;
      const isPdfExport = document.body.classList.contains('is-pdf-export');

      if (slot) {
        slot.style.width = '';
        slot.style.height = '';
      }

      if (stage) {
        stage.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
        stage.style.transformOrigin = 'top center';
        stage.style.marginBottom = '0';
        stage.style.zoom = '';
      }

      if (isPdfExport) {
        if (pad) {
          pad.style.width = '';
          pad.style.height = '';
        }
        if (label) label.textContent = `${editorZoomPct}%`;
        return;
      }

      const padX = 24;
      const padY = 56;

      if (pad && page) {
        const pageW = page.offsetWidth;
        const pageH = page.offsetHeight;
        const navBlock = nav && !nav.hidden ? nav.offsetHeight + 10 : 0;
        const contentW = Math.max(pageW * scale, nav?.offsetWidth || 0);
        pad.style.width = `${Math.ceil(contentW + padX)}px`;
        pad.style.height = `${Math.ceil(navBlock + pageH * scale + padY)}px`;
      } else if (pad) {
        pad.style.width = '';
        pad.style.height = '';
      }

      if (label) label.textContent = `${editorZoomPct}%`;
    }

    function setEditorZoom(pct) {
      editorZoomPct = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pct));
      applyEditorZoom();
      requestAnimationFrame(() => applyEditorZoom());
    }

    function zoomStep(delta) {
      setEditorZoom(editorZoomPct + delta * ZOOM_STEP);
    }

    function initEditorZoom() {
      applyEditorZoom();
      const viewport = document.getElementById('doc-zoom-viewport');
      if (!viewport || !global.CrewHtmlFormEditorWheel) return;
      global.CrewHtmlFormEditorWheel.attach(viewport, {
        onZoomStep: (step) => setEditorZoom(editorZoomPct + step * ZOOM_STEP),
      });
    }

    function resetEditorZoomForExport() {
      editorZoomPct = 100;
      const stage = document.getElementById('doc-zoom-stage');
      const pad = document.getElementById('doc-zoom-pad');
      const slot = document.getElementById('doc-zoom-slot');
      if (stage) {
        stage.style.transform = 'none';
        stage.style.marginBottom = '0';
        stage.style.zoom = '';
      }
      if (pad) {
        pad.style.width = '';
        pad.style.height = '';
      }
      if (slot) {
        slot.style.width = '';
        slot.style.height = '';
      }
    }

    global.persistAllChanges = persistAllChanges;
    global.showConfirmModal = showConfirmModal;
    global.hideConfirmModal = hideConfirmModal;
    global.closeConfirmModal = hideConfirmModal;
    global.confirmCancel = confirmCancel;
    global.resetPositions = resetPositions;
    global.zoomStep = zoomStep;

    return {
      readPersistedAppData,
      readBootstrapAppData,
      loadPositions,
      savePositions,
      captureCellStyles,
      restoreOverlaySettings,
      initEditorZoom,
      resetEditorZoomForExport,
      applyEditorZoom,
      connectCellEditor(bridge) {
        cellBridge = bridge;
      },
      connectRowsEditor(bridge) {
        rowsBridge = bridge;
      },
      initSavedRowsBaseline() {
        loadPositions();
        captureEditorDirtyBaseline();
      },
      captureEditorDirtyBaseline,
      initOverlayToolbar() {
        if (global.CrewOverlayToolbar) {
          CrewOverlayToolbar.init({
            onStampChange: (on) => void toggleStamp(on),
            onSigChange: (on) => void toggleSignature(on),
          });
        }
      },
    };
  }

  global.PortOfCallFormEditor = { createEditor };
})(typeof window !== 'undefined' ? window : globalThis);

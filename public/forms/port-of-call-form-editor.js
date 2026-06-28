/**
 * Shared HTML editor chrome for Port of Call forms 01 & 02 (overlay, save, zoom).
 */
(function (global) {
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;
  const APP_DATA_SCHEMA_VERSION = 16;
  let editorZoomPct = 100;

  function electronApi() {
    return global.electronAPI || (global.parent && global.parent.electronAPI) || null;
  }

  async function readPersistedAppData() {
    const snapshot = global.CrewHtmlFormPdfSnapshot ? global.CrewHtmlFormPdfSnapshot.read() : null;
    if (snapshot) return snapshot;

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

  function overlayCssBox(saved, prevBox) {
    const box = { ...(prevBox || {}) };
    if (saved?.left) box.left = saved.left;
    if (saved?.top) box.top = saved.top;
    if (saved?.width) box.width = saved.width;
    if (saved?.height) box.height = saved.height;
    return Object.keys(box).length ? box : undefined;
  }

  function createEditor(overlayKey, feedbackParam) {
    global._currentPositions = null;
    let cellBridge = null;
    let rowsBridge = null;
    let savedRowsPerPage = null;

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
      if (savedRowsPerPage === null) return false;
      return global._currentPositions?.rowsPerPage !== savedRowsPerPage;
    }

    function captureCellStyles() {
      if (cellBridge?.collect) {
        if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {} };
        global._currentPositions.cellStyles = cellBridge.collect();
      }
    }

    function savePositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const stampOn = global.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = global.CrewOverlayToolbar?.isSigOn() ?? false;
      if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {} };
      global._currentPositions.stamp = {
        visible: stampOn,
        left: stamp?.style.left || global._currentPositions.stamp?.left,
        top: stamp?.style.top || global._currentPositions.stamp?.top,
        width: stamp?.style.width || global._currentPositions.stamp?.width,
        height: stamp?.style.height || global._currentPositions.stamp?.height,
      };
      global._currentPositions.sig = {
        visible: sigOn,
        left: sig?.style.left || global._currentPositions.sig?.left,
        top: sig?.style.top || global._currentPositions.sig?.top,
        width: sig?.style.width || global._currentPositions.sig?.width,
        height: sig?.style.height || global._currentPositions.sig?.height,
      };
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
      captureRowsPerPage();
      const appData = await readPersistedAppData();
      if (!appData?.ship) {
        alert('Cannot save: application data is not loaded.');
        return;
      }
      if (!appData.documentOverlay) appData.documentOverlay = {};
      const prev = appData.documentOverlay[overlayKey] || {};
      const stampBox = overlayCssBox(global._currentPositions.stamp, cssBoxFromVariant(prev.stampBox));
      const signatureBox = overlayCssBox(global._currentPositions.sig, cssBoxFromVariant(prev.signatureBox));
      appData.documentOverlay[overlayKey] = {
        ...prev,
        useStamp: !!global._currentPositions.stamp.visible,
        useSignature: !!global._currentPositions.sig.visible,
        ...(stampBox ? { stampBox } : {}),
        ...(signatureBox ? { signatureBox } : {}),
        cellStyles: global._currentPositions.cellStyles || {},
        rowsPerPage: global._currentPositions.rowsPerPage ?? global.PortOfCallFormRows?.DEFAULT_ROWS ?? 11,
        ...(document.getElementById('poc-footer-date')?.value?.trim()
          ? { footerSignatureDate: document.getElementById('poc-footer-date').value.trim() }
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

    function resetPositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      if (stamp) {
        stamp.classList.remove('visible');
        stamp.style.cssText = '';
        stamp.innerHTML = '';
      }
      if (sig) {
        sig.classList.remove('visible');
        sig.style.cssText = '';
        sig.innerHTML = '';
      }
      if (global.CrewOverlayToolbar) {
        CrewOverlayToolbar.setStampOn(false);
        CrewOverlayToolbar.setSigOn(false);
      }
      global._currentPositions = { stamp: { visible: false }, sig: { visible: false } };
    }

    async function loadAsset(kind) {
      return global.CrewPortOfCallPdf?.loadAsset?.(kind) ?? null;
    }

    function showOverlay(el, url, pos) {
      if (!el) return;
      el.classList.add('visible');
      el.innerHTML = `<img src="${url}" alt="" draggable="false" />`;
      if (pos?.left) el.style.left = pos.left;
      if (pos?.top) el.style.top = pos.top;
      if (pos?.width) el.style.width = pos.width;
      if (pos?.height) el.style.height = pos.height;
      if (global.CrewOverlayDrag) CrewOverlayDrag.attach(el);
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
        showOverlay(el, url, saved);
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
        showOverlay(el, url, saved);
        savePositions();
      } else {
        if (global.CrewOverlayToolbar) CrewOverlayToolbar.setSigOn(false);
        alert('Signature not found. Please upload it in Settings.');
      }
    }

    async function restoreOverlaySettings() {
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
      }
      if (saved.sig?.visible) {
        try {
          await toggleSignature(true);
        } catch (e) {
          console.error(e);
        }
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
      const padX = 24;
      const padY = 56;

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
      if (!viewport) return;
      viewport.addEventListener(
        'wheel',
        (e) => {
          if (document.body.classList.contains('is-pdf-export')) return;
          e.preventDefault();
          setEditorZoom(editorZoomPct + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        },
        { passive: false },
      );
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
      applyEditorZoom();
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
      },
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

/**
 * Ship Stores HTML editor shell — save, zoom, overlay persistence.
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
    let savedStampVisible = false;
    let savedSigVisible = false;

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
      };
      savedStampVisible = !!global._currentPositions.stamp?.visible;
      savedSigVisible = !!global._currentPositions.sig?.visible;
      return global._currentPositions;
    }

    function isEditorDirty() {
      if (global.ShipStoresFormCells?.isDirty?.()) return true;
      savePositions();
      if (global.CrewHtmlFormEditorDirty?.isOverlayDirty) {
        return global.CrewHtmlFormEditorDirty.isOverlayDirty(() => loadPositions());
      }
      const stampOn = global.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = global.CrewOverlayToolbar?.isSigOn() ?? false;
      return stampOn !== savedStampVisible || sigOn !== savedSigVisible;
    }

    function captureCellStyles() {
      if (cellBridge?.collect) {
        if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
        global._currentPositions.cellStyles = cellBridge.collect();
      }
    }

    function captureCellValues() {
      if (!cellBridge?.collectValues) return;
      if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
      global._currentPositions.cellValues = cellBridge.collectValues();
      const depOn = document.getElementById('ssd-cb-dep')?.textContent === '\u2713';
      global._currentPositions.cellValues._ssMode = depOn ? 'departure' : 'arrival';
    }

    function overlayBoxFromElement(el) {
      if (!el) return {};
      return {
        left: el.style.left || `${el.offsetLeft}px`,
        top: el.style.top || `${el.offsetTop}px`,
        width: el.style.width || `${el.offsetWidth}px`,
        height: el.style.height || `${el.offsetHeight}px`,
      };
    }

    function savePositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const stampOn = global.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = global.CrewOverlayToolbar?.isSigOn() ?? false;
      const stampBox = stampOn ? overlayBoxFromElement(stamp) : {};
      const sigBox = sigOn ? overlayBoxFromElement(sig) : {};
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
    }

    function navigateBack(feedback) {
      const params = new URLSearchParams(location.search);
      const returnRaw = params.get('return');
      const base = returnRaw ? decodeURIComponent(returnRaw) : '/?shipStoresSettings=1';
      const url = new URL(base, location.origin);
      url.searchParams.set(feedbackParam, feedback);
      window.location.href = url.pathname + url.search;
    }

    async function persistAllChanges() {
      savePositions();
      captureCellStyles();
      captureCellValues();
      const appData = await readPersistedAppData();
      if (!appData) {
        alert('Cannot save: application data is not loaded.');
        return;
      }
      if (overlayKey === 'shipStores' && global.ShipStoresForm01?.collectIntoAppData) {
        global.ShipStoresForm01.collectIntoAppData(appData);
      }
      if (overlayKey === 'shipStores02' && global.ShipStoresForm02?.collectIntoAppData) {
        global.ShipStoresForm02.collectIntoAppData(appData);
      }
      if (!appData.documentOverlay) appData.documentOverlay = {};
      const prev = appData.documentOverlay[overlayKey] || {};
      const stampBox = overlayCssBox(global._currentPositions.stamp, cssBoxFromVariant(prev.stampBox));
      const signatureBox = overlayCssBox(
        global._currentPositions.sig,
        cssBoxFromVariant(prev.signatureBox),
      );
      appData.documentOverlay[overlayKey] = {
        ...prev,
        useStamp: !!global._currentPositions.stamp.visible,
        useSignature: !!global._currentPositions.sig.visible,
        cellStyles: global._currentPositions.cellStyles || {},
        cellValues: global._currentPositions.cellValues || {},
        ...(stampBox ? { stampBox } : {}),
        ...(signatureBox ? { signatureBox } : {}),
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

    function captureDirtyBaseline() {
      savePositions();
      savedStampVisible = global.CrewOverlayToolbar?.isStampOn() ?? false;
      savedSigVisible = global.CrewOverlayToolbar?.isSigOn() ?? false;
      if (global.CrewHtmlFormEditorDirty?.captureOverlayBaseline) {
        global.CrewHtmlFormEditorDirty.captureOverlayBaseline(() => loadPositions());
      }
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
      };
      resetOverlays();
      if (cellBridge?.resetPage) cellBridge.resetPage();
    }

    async function loadAsset(kind) {
      return global.CrewShipStoresPdf?.loadAsset?.(kind) ?? null;
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
        const defaults = global.CrewShipStoresPdf?.defaultStampCss?.() || {};
        showOverlay(el, url, {
          left: saved.left || defaults.left,
          top: saved.top || defaults.top,
          width: saved.width || defaults.width,
          height: saved.height || defaults.height,
        });
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
        const defaults = global.CrewShipStoresPdf?.defaultSignatureCss?.() || {};
        showOverlay(el, url, {
          left: saved.left || defaults.left,
          top: saved.top || defaults.top,
          width: saved.width || defaults.width,
          height: saved.height || defaults.height,
        });
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
      const page = stage?.querySelector('.a4-page, .ssd-sheet');
      const label = document.getElementById('zoom-label');
      const scale = editorZoomPct / 100;

      if (slot) {
        slot.style.width = '';
        slot.style.height = '';
      }

      if (stage) {
        stage.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
        stage.style.transformOrigin = 'top left';
        stage.style.marginBottom = '0';
        stage.style.zoom = '';
      }

      if (pad && page) {
        pad.style.width = `${page.offsetWidth * scale}px`;
        pad.style.height = `${page.offsetHeight * scale}px`;
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
      restoreOverlaySettings,
      initEditorZoom,
      resetEditorZoomForExport,
      connectCellEditor(bridge) {
        cellBridge = bridge;
      },
      initOverlayToolbar() {
        if (global.CrewOverlayToolbar) {
          CrewOverlayToolbar.init({
            onStampChange: (on) => void toggleStamp(on),
            onSigChange: (on) => void toggleSignature(on),
          });
        }
      },
      captureDirtyBaseline,
    };
  }

  global.ShipStoresFormEditor = { createEditor };
})(typeof window !== 'undefined' ? window : globalThis);

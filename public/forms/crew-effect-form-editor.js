/**
 * Crew Effect HTML editor shell — save, zoom, overlay persistence.
 */
(function (global) {
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;
  const APP_DATA_SCHEMA_VERSION = 18;
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

  function cssBoxFromVariant(box, stampBox) {
    if (global.CrewCrewEffectPdf?.overlayBoxFromPersisted) {
      return global.CrewCrewEffectPdf.overlayBoxFromPersisted(box, stampBox);
    }
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

  function pinOverlayElement(el, scale) {
    if (!el) return;
    const page = overlayPage(el);
    if (!page) return;
    const er = el.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    const zoom = scale || 1;
    const left = (er.left - pr.left) / zoom;
    const top = (er.top - pr.top) / zoom;
    const width = er.width / zoom;
    const height = er.height / zoom;
    if (width < 8 || height < 8) return;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.width = `${Math.round(width)}px`;
    el.style.height = `${Math.round(height)}px`;
  }

  function scheduleOverlayPin(el, scale) {
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pinOverlayElement(el, scale);
      });
    });
  }

  function signatureFallbackFromStampEl(scale) {
    const stamp = document.getElementById('stamp-container');
    if (!stamp?.classList.contains('visible')) return null;
    const page = overlayPage(stamp);
    if (!page) return null;
    const er = stamp.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    const zoom = scale || 1;
    const left = (er.left - pr.left) / zoom;
    const top = (er.top - pr.top) / zoom + er.height / zoom + 4;
    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: '55mm',
      height: '12mm',
    };
  }

  function isUsableSavedOverlay(box) {
    if (global.CrewCrewEffectPdf?.isUsableHtmlCssBox) {
      return global.CrewCrewEffectPdf.isUsableHtmlCssBox(box);
    }
    if (!box?.left || !box?.top || !box?.width || !box?.height) return false;
    const left = String(box.left);
    const top = String(box.top);
    const width = String(box.width);
    const height = String(box.height);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return false;
    if (left.endsWith('px') && top.endsWith('px')) {
      const l = parseFloat(left);
      const t = parseFloat(top);
      if (!Number.isFinite(l) || !Number.isFinite(t)) return false;
      if (l < 24 || t < 40) return false;
      return true;
    }
    if (left.endsWith('mm') && top.endsWith('mm')) {
      const l = parseFloat(left);
      const t = parseFloat(top);
      if (!Number.isFinite(l) || !Number.isFinite(t)) return false;
      if (t < 120) return false;
      return true;
    }
    return true;
  }

  function overlayPage(el) {
    return el?.closest('#ce-page, .ced-sheet, .a4-page') || null;
  }

  function overlayCssBox(saved, prevBox) {
    const box = { ...(prevBox || {}) };
    if (saved?.left) box.left = saved.left;
    if (saved?.top) box.top = saved.top;
    if (saved?.width) box.width = saved.width;
    if (saved?.height) box.height = saved.height;
    if (!isUsableSavedOverlay(box)) {
      if (isUsableSavedOverlay(saved)) {
        return {
          left: saved.left,
          top: saved.top,
          width: saved.width,
          height: saved.height,
        };
      }
      return undefined;
    }
    return box;
  }

  function waitForOverlayImage(el) {
    const img = el?.querySelector('img');
    if (!img) return Promise.resolve();
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }

  function createEditor(overlayKey, feedbackParam) {
    global._currentPositions = null;
    let cellBridge = null;
    let crewSigBridge = null;
    let savedStampVisible = false;
    let savedSigVisible = false;
    let savedUseCrewSignatures = false;

    function loadPositions() {
      if (global._currentPositions) return global._currentPositions;

      let loaded = null;
      try {
        const variant = global._appData?.documentOverlay?.[overlayKey];
        if (variant) {
          let stampCss = cssBoxFromVariant(variant.stampBox);
          if (!isUsableSavedOverlay(stampCss)) {
            stampCss = global.CrewCrewEffectPdf?.defaultStampCss?.() || stampCss;
          }
          let sigCss = cssBoxFromVariant(variant.signatureBox, stampCss);
          if (!isUsableSavedOverlay(sigCss)) {
            sigCss =
              stampCss && isUsableSavedOverlay(stampCss)
                ? global.CrewCrewEffectPdf?.defaultSignatureCss?.(stampCss)
                : global.CrewCrewEffectPdf?.defaultSignatureCss?.();
          }
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
            useCrewSignatures: !!variant.useCrewSignatures,
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
        useCrewSignatures: false,
      };
      savedStampVisible = !!global._currentPositions.stamp?.visible;
      savedSigVisible = !!global._currentPositions.sig?.visible;
      savedUseCrewSignatures = !!global._currentPositions.useCrewSignatures;
      return global._currentPositions;
    }

    function isEditorDirty() {
      if (global.CrewEffectFormCells?.isDirty?.()) return true;
      if (global.CrewEffectFormCellsV2?.isDirty?.()) return true;
      if (crewSigBridge?.isDirty?.(savedUseCrewSignatures)) return true;
      savePositions();
      if (global.CrewHtmlFormEditorDirty?.isOverlayDirty) {
        return global.CrewHtmlFormEditorDirty.isOverlayDirty(() => loadPositions(), {
          useCrewSignatures: !!global._currentPositions?.useCrewSignatures,
        });
      }
      const stampOn = global.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = global.CrewOverlayToolbar?.isSigOn() ?? false;
      if (stampOn !== savedStampVisible || sigOn !== savedSigVisible) return true;
      return false;
    }

    function captureEditorDirtyBaseline() {
      savePositions();
      savedStampVisible = global.CrewOverlayToolbar?.isStampOn() ?? false;
      savedSigVisible = global.CrewOverlayToolbar?.isSigOn() ?? false;
      savedUseCrewSignatures = !!global._currentPositions?.useCrewSignatures;
      if (global.CrewHtmlFormEditorDirty?.captureOverlayBaseline) {
        global.CrewHtmlFormEditorDirty.captureOverlayBaseline(() => loadPositions(), {
          useCrewSignatures: savedUseCrewSignatures,
        });
      }
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
    }

    function overlayBoxFromElement(el) {
      if (!el || !el.classList.contains('visible')) return {};
      const box = {
        left: el.style.left || `${el.offsetLeft}px`,
        top: el.style.top || `${el.offsetTop}px`,
        width: el.style.width || `${el.offsetWidth}px`,
        height: el.style.height || `${el.offsetHeight}px`,
      };
      return isUsableSavedOverlay(box) ? box : {};
    }

    function mergeOverlaySlot(savedBox, prev) {
      if (isUsableSavedOverlay(savedBox)) return savedBox;
      if (isUsableSavedOverlay(prev)) return prev;
      return savedBox?.left ? savedBox : prev || {};
    }

    function savePositions() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const stampOn = global.CrewOverlayToolbar?.isStampOn() ?? false;
      const sigOn = global.CrewOverlayToolbar?.isSigOn() ?? false;
      const stampBox = stampOn ? overlayBoxFromElement(stamp) : {};
      const sigBox = sigOn ? overlayBoxFromElement(sig) : {};
      if (!global._currentPositions) global._currentPositions = { stamp: {}, sig: {} };
      const prevStamp = global._currentPositions.stamp || {};
      const prevSig = global._currentPositions.sig || {};
      const mergedStamp = mergeOverlaySlot(stampBox, prevStamp);
      const mergedSig = mergeOverlaySlot(sigBox, prevSig);
      global._currentPositions.stamp = {
        visible: stampOn,
        left: mergedStamp.left,
        top: mergedStamp.top,
        width: mergedStamp.width,
        height: mergedStamp.height,
      };
      global._currentPositions.sig = {
        visible: sigOn,
        left: mergedSig.left,
        top: mergedSig.top,
        width: mergedSig.width,
        height: mergedSig.height,
      };
    }

    async function finalizeOverlayLayout() {
      const stamp = document.getElementById('stamp-container');
      const sig = document.getElementById('sig-container');
      const waits = [];
      if (stamp?.classList.contains('visible')) waits.push(waitForOverlayImage(stamp));
      if (sig?.classList.contains('visible')) waits.push(waitForOverlayImage(sig));
      if (waits.length) await Promise.all(waits);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scale = editorZoomPct / 100;
      if (stamp?.classList.contains('visible')) pinOverlayElement(stamp, scale);
      if (sig?.classList.contains('visible')) pinOverlayElement(sig, scale);
      savePositions();
    }

    function navigateBack(feedback) {
      const params = new URLSearchParams(location.search);
      const returnRaw = params.get('return');
      const base = returnRaw ? decodeURIComponent(returnRaw) : '/?crewEffectSettings=1';
      const url = new URL(base, location.origin);
      url.searchParams.set(feedbackParam, feedback);
      window.location.href = url.pathname + url.search;
    }

    async function persistAllChanges() {
      await finalizeOverlayLayout();
      captureCellStyles();
      captureCellValues();
      const appData = await readPersistedAppData();
      if (!appData) {
        alert('Cannot save: application data is not loaded.');
        return;
      }
      if (!appData.documentOverlay) appData.documentOverlay = {};
      const prev = appData.documentOverlay[overlayKey] || {};
      const stampBox = overlayCssBox(global._currentPositions.stamp, cssBoxFromVariant(prev.stampBox));
      const signatureBox = overlayCssBox(
        global._currentPositions.sig,
        cssBoxFromVariant(prev.signatureBox, cssBoxFromVariant(prev.stampBox)),
      );
      const crewSigState = crewSigBridge?.collectState?.() || {};
      const overlayEntry = {
        ...prev,
        useStamp: !!global._currentPositions.stamp.visible,
        useSignature: !!global._currentPositions.sig.visible,
        useCrewSignatures: !!crewSigState.useCrewSignatures,
        cellStyles: global._currentPositions.cellStyles || {},
        cellValues: global._currentPositions.cellValues || {},
      };
      if (stampBox) overlayEntry.stampBox = stampBox;
      if (signatureBox) overlayEntry.signatureBox = signatureBox;
      else delete overlayEntry.signatureBox;
      if (crewSigState.crewSignatureByRow && Object.keys(crewSigState.crewSignatureByRow).length) {
        overlayEntry.crewSignatureByRow = crewSigState.crewSignatureByRow;
      } else {
        delete overlayEntry.crewSignatureByRow;
      }
      if (!crewSigState.useCrewSignatures) {
        delete overlayEntry.crewSignatureByRow;
      }
      appData.documentOverlay[overlayKey] = overlayEntry;
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
      };
      resetOverlays();
      crewSigBridge?.reset?.();
      if (cellBridge?.resetPage) cellBridge.resetPage();
    }

    async function loadAsset(kind) {
      return global.CrewCrewEffectPdf?.loadAsset?.(kind) ?? null;
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
      if (pos?.left != null && pos.left !== '') el.style.left = pos.left;
      if (pos?.top != null && pos.top !== '') el.style.top = pos.top;
      if (pos?.width != null && pos.width !== '') el.style.width = pos.width;
      if (pos?.height != null && pos.height !== '') el.style.height = pos.height;
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
        const savedRaw = loadPositions().stamp;
        const saved = isUsableSavedOverlay(savedRaw) ? savedRaw : {};
        const defaults = global.CrewCrewEffectPdf?.defaultStampCss?.() || {};
        showOverlay(el, url, {
          left: saved.left || defaults.left,
          top: saved.top || defaults.top,
          width: saved.width || defaults.width,
          height: saved.height || defaults.height,
        });
        scheduleOverlayPin(el, editorZoomPct / 100);
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
        const savedRaw = loadPositions().sig;
        const saved = isUsableSavedOverlay(savedRaw) ? savedRaw : {};
        const stampSaved = loadPositions().stamp;
        const defaults = global.CrewCrewEffectPdf?.defaultSignatureCss?.(stampSaved) || {};
        const fromStamp = signatureFallbackFromStampEl(editorZoomPct / 100);
        showOverlay(el, url, {
          left: saved.left || fromStamp?.left || defaults.left,
          top: saved.top || fromStamp?.top || defaults.top,
          width: saved.width || fromStamp?.width || defaults.width,
          height: saved.height || fromStamp?.height || defaults.height,
        });
        scheduleOverlayPin(el, editorZoomPct / 100);
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
      try {
        await finalizeOverlayLayout();
      } catch (e) {
        console.error(e);
      }
    }

    function applyEditorZoom() {
      const stage = document.getElementById('doc-zoom-stage');
      const pad = document.getElementById('doc-zoom-pad');
      const slot = document.getElementById('doc-zoom-slot');
      const page = stage?.querySelector('.a4-page, .ced-sheet');
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
      captureEditorDirtyBaseline,
      connectCellEditor(bridge) {
        cellBridge = bridge;
      },
      connectCrewSignatures(bridge) {
        crewSigBridge = bridge;
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

  global.CrewEffectFormEditor = { createEditor };
})(typeof window !== 'undefined' ? window : globalThis);

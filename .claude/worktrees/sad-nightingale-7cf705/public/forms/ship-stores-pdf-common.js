/**
 * Ship Stores HTML forms 01 & 02 — stamp/signature overlay helpers for PDF export.
 */
(function (global) {
  const A4_W_PT = 595.28;
  const A4_H_PT = 842;

  function pdfBoxToCss(box) {
    if (!box || typeof box !== 'object') return null;
    if (typeof box.left === 'string' && typeof box.top === 'string') {
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    }
    if (typeof box.x !== 'number' || typeof box.y !== 'number') return null;
    const w = box.width || 0;
    const h = box.height || 0;
    return {
      left: `${((box.x / A4_W_PT) * 210).toFixed(2)}mm`,
      top: `${(((A4_H_PT - box.y - h) / A4_H_PT) * 297).toFixed(2)}mm`,
      width: `${((w / A4_W_PT) * 210).toFixed(2)}mm`,
      height: `${((h / A4_H_PT) * 297).toFixed(2)}mm`,
    };
  }

  function defaultStampCss() {
    return {
      left: '125mm',
      top: '235mm',
      width: '65mm',
      height: '28mm',
    };
  }

  function defaultSignatureCss() {
    const stamp = defaultStampCss();
    return {
      left: stamp.left,
      top: `calc(${stamp.top} + ${stamp.height} + 1mm)`,
      width: '55mm',
      height: '12mm',
    };
  }

  function electronApi() {
    return typeof global.electronAPI !== 'undefined' ? global.electronAPI : null;
  }

  function idbGetAsset(key) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('crew-ship-assets', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('assets', 'readonly');
        const getReq = tx.objectStore('assets').get(key);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => reject(getReq.error);
      };
    });
  }

  async function loadAsset(kind) {
    const api = electronApi();
    if (api) {
      try {
        const b64 = await api.readShipAsset(kind);
        if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      } catch (e) {
        /* ignore */
      }
    }
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
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function applyBox(el, box) {
    if (!el || !box) return;
    el.style.left = box.left;
    el.style.top = box.top;
    el.style.width = box.width;
    el.style.height = box.height;
  }

  async function renderOverlays(pageEl, overlayKey, snapshot) {
    if (!snapshot.withOverlay) return;
    const opts = snapshot.documentOverlay?.[overlayKey];
    if (!opts) return;

    const stampEl = pageEl.querySelector('#stamp-container');
    const sigEl = pageEl.querySelector('#sig-container');
    if (!stampEl || !sigEl) return;

    if (opts.useStamp) {
      const url = await loadAsset('stamp');
      if (url) {
        stampEl.classList.add('visible');
        stampEl.innerHTML = `<img src="${url}" alt="" />`;
        applyBox(stampEl, pdfBoxToCss(opts.stampBox) || defaultStampCss());
      }
    }

    if (opts.useSignature) {
      const url = await loadAsset('signature');
      if (url) {
        sigEl.classList.add('visible');
        sigEl.innerHTML = `<img src="${url}" alt="" />`;
        applyBox(sigEl, pdfBoxToCss(opts.signatureBox) || defaultSignatureCss());
      }
    }
  }

  global.CrewShipStoresPdf = global.CrewShipStoresPdf || {};
  Object.assign(global.CrewShipStoresPdf, {
    pdfBoxToCss,
    defaultStampCss,
    defaultSignatureCss,
    loadAsset,
    renderOverlays,
  });
})(typeof window !== 'undefined' ? window : globalThis);

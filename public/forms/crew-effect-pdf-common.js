/**
 * Crew Effect HTML forms — stamp/signature overlay helpers for PDF export.
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
      left: '120mm',
      top: '240mm',
      width: '65mm',
      height: '28mm',
    };
  }

  function defaultSignatureCss(stampCss) {
    if (stampCss && stampCss.left && stampCss.top) {
      const below = signatureCssBelowStamp(stampCss);
      if (below) return below;
    }
    return {
      left: '120mm',
      top: '269mm',
      width: '55mm',
      height: '12mm',
    };
  }

  function isPdfStampBox(box) {
    return !!box && typeof box.x === 'number' && typeof box.y === 'number';
  }

  function isCssOverlayBox(box) {
    return (
      !!box &&
      typeof box.left === 'string' &&
      typeof box.top === 'string' &&
      typeof box.width === 'string' &&
      typeof box.height === 'string'
    );
  }

  function signatureCssBelowStamp(stampCss) {
    if (!stampCss?.left || !stampCss?.top) return null;
    return {
      left: stampCss.left,
      top: `calc(${stampCss.top} + ${stampCss.height || '28mm'} + 2mm)`,
      width: '55mm',
      height: '12mm',
    };
  }

  function isUsableHtmlCssBox(box) {
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
      const t = parseFloat(top);
      if (!Number.isFinite(t) || t < 120) return false;
      return true;
    }
    return true;
  }

  function sanitizeHtmlCssBox(box) {
    if (!isUsableHtmlCssBox(box)) return null;
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  /** CSS box from persisted overlay — CSS only for HTML forms (legacy PDF dropped). */
  function overlayBoxFromPersisted(box, stampBox) {
    const css = sanitizeHtmlCssBox(box);
    if (css) return css;
    if (isPdfStampBox(box)) {
      if (stampBox && isCssOverlayBox(stampBox)) return null;
      const converted = pdfBoxToCss(box);
      return sanitizeHtmlCssBox(converted);
    }
    return null;
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
        applyBox(stampEl, sanitizeHtmlCssBox(opts.stampBox) || pdfBoxToCss(opts.stampBox) || defaultStampCss());
      }
    }

    if (opts.useSignature) {
      const url = await loadAsset('signature');
      if (url) {
        sigEl.classList.add('visible');
        sigEl.innerHTML = `<img src="${url}" alt="" />`;
        applyBox(
          sigEl,
          sanitizeHtmlCssBox(opts.signatureBox) || pdfBoxToCss(opts.signatureBox) || defaultSignatureCss(),
        );
      }
    }
  }

  function crewEffectRowHasContent(row) {
    if (!row || typeof row !== 'object') return false;
    const keys = [
      'familyGivenNames',
      'rankOrRating',
      'cigarettes',
      'spirits',
      'wines',
      'others',
      'signature',
      'tobaccoCigares',
      'beer',
      'other',
    ];
    return keys.some((k) => String(row[k] || '').trim() !== '');
  }

  function normalizeCrewEffectRowNo(row, index) {
    if (!crewEffectRowHasContent(row)) return '';
    const no = String(row.no ?? '').trim();
    return no || String(index + 1);
  }

  function normalizeCrewEffectRowNos(crew) {
    return (crew || []).map((row, i) => ({
      ...row,
      no: normalizeCrewEffectRowNo(row, i),
    }));
  }

  global.CrewCrewEffectPdf = {
    pdfBoxToCss,
    defaultStampCss,
    defaultSignatureCss,
    overlayBoxFromPersisted,
    isUsableHtmlCssBox,
    sanitizeHtmlCssBox,
    signatureCssBelowStamp,
    loadAsset,
    renderOverlays,
    crewEffectRowHasContent,
    normalizeCrewEffectRowNo,
    normalizeCrewEffectRowNos,
  };
})(typeof window !== 'undefined' ? window : globalThis);

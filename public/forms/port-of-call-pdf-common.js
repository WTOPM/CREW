/**
 * Shared helpers for Port of Call HTML PDF forms (01 list / 02 security).
 */
(function (global) {
  const A4_W_PT = 595.28;
  const A4_H_PT = 842;
  const ROWS_PER_PAGE = 11;
  const MAX_ROWS = 23;

  function formatDisplayDate(value, formatType) {
    const F = global.HtmlFormDateFormat;
    const fmt = formatType || F?.getActive?.() || 'dot';
    if (F && value) {
      const iso = F.parseToIso(value) || (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : '');
      if (iso) return F.format(iso, fmt);
    }
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
  }

  function formatPortName(name) {
    return String(name || '').trim().toUpperCase();
  }

  function portCountry(portName, ports) {
    if (!portName || !Array.isArray(ports)) return '';
    const found = ports.find((p) => p.name && p.name.toLowerCase() === String(portName).toLowerCase());
    return found?.country ? String(found.country).trim().toUpperCase() : '';
  }

  function portCode(portName, ports) {
    if (!portName || !Array.isArray(ports)) return '';
    const found = ports.find((p) => p.name && p.name.toLowerCase() === String(portName).toLowerCase());
    return found?.code ? String(found.code).trim().toUpperCase() : '';
  }

  function formatPortWithCountry(portName, ports) {
    const name = formatPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  }

  function normalizeSecLvl(value) {
    const v = String(value || '').trim().toUpperCase();
    return v === '1' || v === '2' || v === '3' ? v : '';
  }

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

  /** Default stamp area above field 15 signature line (matches pocStampBoxPdfLib × 0.72). */
  function defaultStampCss() {
    return pdfBoxToCss({ x: 318, y: 698, width: 200, height: 76 }) || {
      left: '112mm',
      top: '228mm',
      width: '70mm',
      height: '27mm',
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

    const stampEl = pageEl.querySelector('#stamp-container') || pageEl.querySelector('.poc-stamp');
    const sigEl = pageEl.querySelector('#sig-container') || pageEl.querySelector('.poc-signature');
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

  function findMaster(crew) {
    if (!Array.isArray(crew)) return null;
    const exact = crew.find((m) => String(m.rank || '').trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => String(m.rank || '').trim().toLowerCase().includes('master'));
  }

  function formatCaptainName(member) {
    const parts = [member?.familyName, member?.givenNames].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  function finishPdfExport() {
    document.body.classList.add('pdf-export');
    global.__pdfReady = true;
  }

  function orderPortHistory(history) {
    if (!Array.isArray(history)) return [];
    return [...history].sort((a, b) => {
      const aKey = a.arrivalDate || a.departureDate || '';
      const bKey = b.arrivalDate || b.departureDate || '';
      return bKey.localeCompare(aKey);
    });
  }

  function rowsPerPageFromOverlay(appData, overlayKey) {
    const raw = appData?.documentOverlay?.[overlayKey || 'portOfCall']?.rowsPerPage;
    const n = typeof raw === 'number' ? raw : ROWS_PER_PAGE;
    return Math.min(MAX_ROWS, Math.max(1, Math.round(n)));
  }

  function buildPagesFromData(appData, overlayKey, rowsPerPageOverride) {
    const rowsPerPage =
      typeof rowsPerPageOverride === 'number'
        ? Math.min(MAX_ROWS, Math.max(1, Math.round(rowsPerPageOverride)))
        : rowsPerPageFromOverlay(appData, overlayKey);
    const limit = Math.max(0, appData?.portOfCall?.pdfRowCount ?? rowsPerPage);
    const ordered = orderPortHistory(appData?.portCallHistory).slice(0, limit);
    if (ordered.length === 0) return [[]];
    const pages = [];
    for (let i = 0; i < ordered.length; i += rowsPerPage) {
      pages.push(ordered.slice(i, i + rowsPerPage));
    }
    return pages;
  }

  function snapshotFromAppData(appData, withOverlay, overlayKey) {
    const key = overlayKey || 'portOfCall';
    const rowsPerPage = rowsPerPageFromOverlay(appData, key);
    return {
      ship: appData.ship,
      ports: (appData.ports || []).map((p) => ({
        name: p.name,
        country: p.country || '',
        code: p.code || '',
      })),
      pages: buildPagesFromData(appData, key),
      rowsPerPage,
      portCallHistory: appData.portCallHistory,
      portOfCall: appData.portOfCall,
      documentOverlay: appData.documentOverlay,
      withOverlay,
      crew: (appData.crew || []).map((c) => ({
        rank: c.rank,
        familyName: c.familyName,
        givenNames: c.givenNames,
      })),
    };
  }

  global.CrewPortOfCallPdf = {
    ROWS_PER_PAGE,
    MAX_ROWS,
    formatDisplayDate,
    formatPortName,
    portCountry,
    portCode,
    formatPortWithCountry,
    normalizeSecLvl,
    pdfBoxToCss,
    renderOverlays,
    findMaster,
    formatCaptainName,
    finishPdfExport,
    loadAsset,
    buildPagesFromData,
    snapshotFromAppData,
  };
})(typeof window !== 'undefined' ? window : globalThis);

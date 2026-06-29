/**
 * Shared helpers for Ship Stores HTML PDF forms (01 short / 02 long).
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

  function placementToCss(placement, options) {
    const opts = options || {};
    const x = placement.x;
    const y = placement.y;
    const fontSize = placement.fontSize || opts.fontSize || 9;
    const maxWidth = placement.maxWidth;
    const style = {
      left: `${((x / A4_W_PT) * 210).toFixed(2)}mm`,
      top: `${(((A4_H_PT - y) / A4_H_PT) * 297).toFixed(2)}mm`,
      fontSize: `${fontSize}pt`,
    };
    if (maxWidth) {
      style.maxWidth = `${((maxWidth / A4_W_PT) * 210).toFixed(2)}mm`;
    }
    if (opts.bold) style.fontWeight = '700';
    if (opts.center) style.textAlign = 'center';
    if (opts.rightAlign) {
      style.left = 'auto';
      style.right = `${(((A4_W_PT - x) / A4_W_PT) * 210).toFixed(2)}mm`;
      style.textAlign = 'right';
    }
    return style;
  }

  /** Center text inside a horizontal cell band (form 02). */
  function centeredBoxCss(leftX, rightX, y, fontSize, options) {
    const opts = options || {};
    const widthPt = rightX - leftX;
    return {
      left: `${((leftX / A4_W_PT) * 210).toFixed(2)}mm`,
      top: `${(((A4_H_PT - y) / A4_H_PT) * 297).toFixed(2)}mm`,
      width: `${((widthPt / A4_W_PT) * 210).toFixed(2)}mm`,
      fontSize: `${fontSize || 9}pt`,
      textAlign: 'center',
      ...(opts.bold ? { fontWeight: '700' } : {}),
    };
  }

  function applyCenteredBox(el, leftX, rightX, y, fontSize, options) {
    if (!el) return;
    Object.assign(el.style, centeredBoxCss(leftX, rightX, y, fontSize, options));
  }

  function applyPlacement(el, placement, options) {
    if (!el) return;
    const css = placementToCss(placement, options);
    Object.assign(el.style, css);
  }

  function applyStyleObject(el, style) {
    if (!el || !style) return;
    Object.assign(el.style, style);
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

  function renderPageBackground(pageEl, backgroundUrl) {
    let img = pageEl.querySelector('.ss-pdf-bg');
    if (!img) {
      img = document.createElement('img');
      img.className = 'ss-pdf-bg';
      img.alt = '';
      img.draggable = false;
      pageEl.insertBefore(img, pageEl.firstChild);
    }
    if (!backgroundUrl) return Promise.resolve();
    if (img.getAttribute('src') === backgroundUrl && img.complete && img.naturalWidth > 0) {
      return Promise.resolve();
    }
    img.setAttribute('src', backgroundUrl);
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Ship Stores background failed: ${backgroundUrl}`));
    });
  }

  function backgroundUrlForVariant(variant) {
    if (variant === '02') return '/forms/ship-stores-form-02/ship-stores-form-02-bg.png?v=2';
    return '/forms/ship-stores-form-01/ship-stores-form-01-bg.png?v=2';
  }

  function finishPdfExport() {
    document.body.classList.add('pdf-export', 'is-pdf-export');
    global.__pdfReady = true;
  }

  /** Form 01 field placements (pdf-lib pt, origin bottom-left). */
  const FIELDS_01 = {
    pageNo: { x: 518, y: 764, fontSize: 9 },
    arrivalMark: { x: 323, y: 765, fontSize: 8 },
    shipName: { x: 191, y: 744, fontSize: 9, maxWidth: 120 },
    portOfCall: { x: 356, y: 745, fontSize: 9, maxWidth: 70 },
    voyageDate: { x: 457, y: 745, fontSize: 9, maxWidth: 80 },
    nationality: { x: 191, y: 723, fontSize: 9, maxWidth: 120 },
    portsRoute: { x: 397, y: 724, fontSize: 9, maxWidth: 150 },
    personsOnBoard: { x: 148, y: 702, fontSize: 9 },
    periodOfStay: { x: 257, y: 703, fontSize: 9 },
    placeOfStorage: { x: 396, y: 703, fontSize: 9, maxWidth: 120 },
  };

  const BODY_ROW_Y_01 = [
    663, 645, 627, 609, 590, 572, 554, 536, 518, 500, 482, 463, 445, 427, 410, 390, 371, 354, 336,
    317, 301, 282, 264, 245, 227, 209, 191,
  ];

  const BODY_01 = {
    articleX: 112,
    quantityX: 266,
    unitRightX: 252,
    articleMaxWidth: 130,
    fontSize: 9,
  };

  /** Form 02 field placements. */
  const FIELDS_02 = {
    shipName: { x: 40, y: 734, fontSize: 9, maxWidth: 100 },
    imoNo: { x: 145, y: 734, fontSize: 9, maxWidth: 70 },
    callSign: { x: 220, y: 734, fontSize: 9, maxWidth: 90 },
    arrivalMark: { x: 317, y: 756, fontSize: 9 },
    departureMark: { x: 432, y: 756, fontSize: 9 },
    pageNo: { x: 528, y: 756, fontSize: 9 },
    nationality: { x: 40, y: 711, fontSize: 9, maxWidth: 270 },
    portsRoute: { x: 317, y: 711, fontSize: 9, maxWidth: 250 },
    placeOfStorage: { x: 317, y: 689, fontSize: 9, maxWidth: 250 },
    personsOnBoard: { x: 40, y: 689, fontSize: 9, maxWidth: 100 },
    periodOfStay: { x: 145, y: 689, fontSize: 9, maxWidth: 130 },
    captainName: { x: 293, y: 128, fontSize: 9, maxWidth: 280 },
  };

  const BODY_02 = {
    articleX: 21,
    quantityX: 232,
    unitX: 274,
    articleMaxWidth: 203,
    fontSize: 8,
    rowCount: 43,
    firstY: 665,
    lastY: 147,
  };

  function bodyRowY02(index) {
    const { firstY, lastY, rowCount } = BODY_02;
    return Math.round(firstY - (index * (firstY - lastY)) / (rowCount - 1));
  }

  function fillHeaderFields(pageEl, header, variant) {
    const fields = variant === '02' ? FIELDS_02 : FIELDS_01;
    Object.keys(fields).forEach((key) => {
      const el = pageEl.querySelector(`[data-ss-field="${key}"]`);
      if (!el) return;
      const value = (header[key] || '').trim();
      el.textContent = value;
      applyPlacement(el, fields[key], { bold: key !== 'pageNo' && key !== 'arrivalMark' && key !== 'departureMark' });
    });
  }

  function fillBodyRows(pageEl, rows, variant) {
    const container = pageEl.querySelector('.ss-body-fields');
    if (!container) return;
    container.innerHTML = '';

    rows.forEach((row, i) => {
      const y = variant === '02' ? bodyRowY02(i) : BODY_ROW_Y_01[i];
      if (y == null) return;

      const body = variant === '02' ? BODY_02 : BODY_01;
      const name = (row.name || '').trim();
      const quantity = (row.quantity || '').trim();
      const unit = (row.unit || '').trim();
      if (!name && !quantity && !unit) return;

      if (name) {
        const el = document.createElement('span');
        el.className = 'ss-field ss-field--body';
        el.textContent = name;
        applyPlacement(el, { x: body.articleX, y, fontSize: body.fontSize, maxWidth: body.articleMaxWidth });
        container.appendChild(el);
      }

      if (quantity) {
        const el = document.createElement('span');
        el.className = 'ss-field ss-field--body';
        el.textContent = quantity;
        applyPlacement(el, { x: body.quantityX, y, fontSize: body.fontSize });
        container.appendChild(el);
      }

      if (unit) {
        const el = document.createElement('span');
        el.className = 'ss-field ss-field--body ss-field--unit';
        el.textContent = unit;
        if (variant === '02') {
          applyPlacement(el, { x: body.unitX, y, fontSize: body.fontSize });
        } else {
          applyPlacement(el, { x: body.unitRightX, y, fontSize: body.fontSize }, { rightAlign: true });
        }
        container.appendChild(el);
      }
    });
  }

  async function renderPage(snapshot) {
    const pageEl = document.getElementById('ss-page');
    if (!pageEl) return;

    const bgUrl = snapshot.backgroundUrl || backgroundUrlForVariant(snapshot.variant);
    await renderPageBackground(pageEl, bgUrl);
    fillHeaderFields(pageEl, snapshot.header || {}, snapshot.variant);
    fillBodyRows(pageEl, snapshot.rows || [], snapshot.variant);
    await renderOverlays(pageEl, snapshot.overlayKey, snapshot);
  }

  function formatPortName(name) {
    return String(name || '').trim().toUpperCase();
  }

  function formatDisplayDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
  }

  function portCountry(portName, ports) {
    if (!portName || !Array.isArray(ports)) return '';
    const found = ports.find((p) => p.name && p.name.toLowerCase() === String(portName).toLowerCase());
    return found?.country ? String(found.country).trim().toUpperCase() : '';
  }

  function formatPortsRoute01(last, next, current) {
    const from = formatPortName(last);
    const to = formatPortName(next || current);
    if (from && to) return `${from} / ${to}`;
    return from || to;
  }

  function formatPortsRoute02(last, next, current, ports) {
    const fmt = (portName) => {
      const name = formatPortName(portName);
      if (!name) return '';
      const country = portCountry(portName, ports);
      return country ? `${name} / ${country}` : name;
    };
    const from = fmt(last);
    const to = fmt(next || current);
    if (from && to) return `${from}    ${to}`;
    return from || to;
  }

  function periodDays(arrivalIso, departureIso) {
    const parse = (v) => {
      const s = String(v || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const d = new Date(`${s}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const arrival = parse(arrivalIso);
    const departure = parse(departureIso);
    if (!arrival || !departure) return 1;
    const days = Math.floor((departure.getTime() - arrival.getTime()) / 86400000);
    return days <= 0 ? 1 : days;
  }

  function formatPeriod(days) {
    const n = Math.max(1, Math.floor(days));
    return n === 1 ? '1 day' : `${n} days`;
  }

  function formatQuantity(articleName, quantity) {
    if (!String(articleName || '').trim()) return '';
    const v = String(quantity || '').trim();
    if (!v) return '';
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isNaN(n) && n === 0) return 'NIL';
    return v;
  }

  function formatUnit(articleName, unit) {
    if (!String(articleName || '').trim()) return '';
    const u = String(unit || '').trim();
    if (!u || u === 'NIL') return '';
    return u;
  }

  function normalizeRows(rawRows, count) {
    const rows = Array.isArray(rawRows) ? [...rawRows] : [];
    while (rows.length < count) rows.push({ name: '', quantity: '', unit: '' });
    return rows.slice(0, count).map((r) => ({
      name: String(r?.name || '').trim(),
      quantity: formatQuantity(r?.name, r?.quantity),
      unit: formatUnit(r?.name, r?.unit),
    }));
  }

  function activeCrew(data, list) {
    const isArrival = list === 'arrival';
    return (data.crew || []).filter(
      (c) => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false),
    );
  }

  function activePax(data, list) {
    const isArrival = list === 'arrival';
    return (data.passengers || []).filter(
      (p) => !p.archived && (isArrival ? p.onArrivalList !== false : p.onDepartureList !== false),
    );
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

  function snapshotFromAppData(appData, variant, withOverlay) {
    const ship = appData.ship || {};
    const ports = appData.ports || [];
    if (variant === '02') {
      const form = appData.shipStoresForm02 || {};
      const isArrival = appData.crewArr?.isArrival !== false;
      const list = isArrival ? 'arrival' : 'departure';
      const crew = activeCrew(appData, list);
      const pax = activePax(appData, list);
      const master = findMaster(crew);
      return {
        variant: '02',
        overlayKey: 'shipStores02',
        backgroundUrl: '/forms/ship-stores-form-02/ship-stores-form-02-bg.png?v=2',
        header: {
          pageNo: '1',
          arrivalMark: isArrival ? 'X' : '',
          departureMark: isArrival ? '' : 'X',
          shipName: formatPortName(ship.name),
          imoNo: String(ship.imoNo || '').trim(),
          callSign: String(ship.callSign || '').trim(),
          nationality: formatPortName(ship.nationality),
          portsRoute: formatPortsRoute02(ship.lastPortOfCall, ship.nextPortOfCall, ship.portOfCall, ports),
          placeOfStorage: String(form.placeOfStorage || '').trim(),
          personsOnBoard: String(crew.length + pax.length),
          periodOfStay: formatPeriod(periodDays(ship.dateOfArrival, ship.dateOfDeparture)),
          captainName: master ? formatCaptainName(master) : '',
        },
        rows: normalizeRows(form.rows, BODY_02.rowCount),
        documentOverlay: appData.documentOverlay,
        withOverlay: !!withOverlay,
      };
    }

    const form = appData.shipStoresForm || {};
    const crew = activeCrew(appData, 'arrival');
    const pax = activePax(appData, 'arrival');
    return {
      variant: '01',
      overlayKey: 'shipStores',
      backgroundUrl: '/forms/ship-stores-form-01/ship-stores-form-01-bg.png?v=2',
      header: {
        pageNo: '1',
        arrivalMark: 'X',
        shipName: formatPortName(ship.name),
        portOfCall: formatPortName(ship.portOfCall),
        voyageDate: formatDisplayDate(ship.dateOfArrival),
        nationality: formatPortName(ship.nationality),
        portsRoute: formatPortsRoute01(ship.lastPortOfCall, ship.nextPortOfCall, ship.portOfCall),
        personsOnBoard: String(crew.length + pax.length),
        periodOfStay: formatPeriod(periodDays(ship.dateOfArrival, ship.dateOfDeparture)),
        placeOfStorage: String(form.placeOfStorage || '').trim(),
      },
      rows: normalizeRows(form.rows, BODY_ROW_Y_01.length),
      documentOverlay: appData.documentOverlay,
      withOverlay: !!withOverlay,
    };
  }

  global.CrewShipStoresPdf = {
    A4_W_PT,
    A4_H_PT,
    pdfBoxToCss,
    placementToCss,
    applyPlacement,
    defaultStampCss,
    defaultSignatureCss,
    loadAsset,
    renderOverlays,
    renderPageBackground,
    backgroundUrlForVariant,
    renderPage,
    finishPdfExport,
    snapshotFromAppData,
    FIELDS_01,
    FIELDS_02,
    BODY_ROW_Y_01,
    BODY_01,
    BODY_02,
    bodyRowY02,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Build Form 02 snapshot data for HTML editor / PDF.
 */
(function (global) {
  const ROW_COUNT = 43;

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
    const needle = String(portName).trim().toLowerCase();
    const found = ports.find((p) => p.name && String(p.name).trim().toLowerCase() === needle);
    return found?.country ? String(found.country).trim().toUpperCase() : '';
  }

  function formatPortWithCountry(portName, ports) {
    const name = formatPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name}, ${country}` : name;
  }

  function formatPortsRoute02(last, next, current, ports) {
    const from = formatPortWithCountry(last, ports);
    const to = formatPortWithCountry(next || current, ports);
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

  function findMaster(crew) {
    const exact = crew.find((c) => String(c.rank || '').trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((c) => String(c.rank || '').trim().toLowerCase().includes('master'));
  }

  function formatMasterName(member) {
    if (!member) return '';
    const parts = [member.familyName, member.givenNames].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.join(' ').toUpperCase();
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

  function normalizeRows(rawRows, formatForPdf) {
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const out = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const r = rows[i] || {};
      const name = String(r.name || '').trim();
      const quantity = String(r.quantity || '').trim();
      const unitRaw = String(r.unit || '').trim();
      const unit = unitRaw === 'NIL' ? '' : unitRaw;
      out.push({
        nameOfArticle: name,
        quantity: formatForPdf ? formatQuantity(name, quantity) : quantity,
        unit: formatForPdf ? formatUnit(name, unit) : unit,
        colAfterQuantity: formatForPdf ? formatUnit(name, unit) : unit,
        officialUse: '',
        colRight1: '',
        colRight2: '',
      });
    }
    return out;
  }

  function buildForm02FromAppData(appData, formatForPdf, options) {
    const ignoreOverlay = !!(options && options.ignoreOverlay);
    const ship = appData.ship || {};
    const form = appData.shipStoresForm02 || {};
    const overlay = appData.documentOverlay?.shipStores02;
    const cv = ignoreOverlay ? {} : overlay?.cellValues || {};
    const isArrival = ignoreOverlay
      ? appData.crewArr?.isArrival !== false
      : cv._ssMode !== 'departure';
    const list = isArrival ? 'arrival' : 'departure';
    const crew = activeCrew(appData, list);
    const pax = activePax(appData, list);

    const defaultArticles = normalizeRows(form.rows, !!formatForPdf);
    const articles = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const base = defaultArticles[i] || {
        nameOfArticle: '',
        quantity: '',
        unit: '',
        colAfterQuantity: '',
        officialUse: '',
        colRight1: '',
        colRight2: '',
      };
      const name = cv[`d-${i}-0`] !== undefined ? String(cv[`d-${i}-0`]) : base.nameOfArticle;
      const quantity = cv[`d-${i}-1`] !== undefined ? String(cv[`d-${i}-1`]) : base.quantity;
      const unit = cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.unit;
      const colAfterQuantity =
        cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.colAfterQuantity;
      const officialUse = cv[`d-${i}-3`] !== undefined ? String(cv[`d-${i}-3`]) : base.officialUse;
      const colRight1 = cv[`d-${i}-4`] !== undefined ? String(cv[`d-${i}-4`]) : base.colRight1;
      const colRight2 = cv[`d-${i}-5`] !== undefined ? String(cv[`d-${i}-5`]) : base.colRight2;
      articles.push({
        nameOfArticle: name,
        quantity: formatForPdf ? formatQuantity(name, quantity) : quantity,
        unit: formatForPdf ? formatUnit(name, unit) : unit,
        colAfterQuantity: formatForPdf ? formatUnit(name, colAfterQuantity) : colAfterQuantity,
        officialUse,
        colRight1,
        colRight2,
      });
    }

    return {
      arrival: isArrival,
      departure: !isArrival,
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: cv['h-nameOfShip'] ?? formatPortName(ship.name),
      imoNumber: cv['h-imo'] ?? String(ship.imoNo || '').trim(),
      callSign: cv['h-callSign'] ?? String(ship.callSign || '').trim(),
      portOfArrivalDeparture:
        cv['h-port'] ?? formatPortWithCountry(ship.portOfCall, appData.ports || []),
      dateOfArrivalDeparture:
        cv['h-date'] ??
        formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      nationalityOfShip: cv['h-nationality'] ?? formatPortName(ship.nationality),
      lastNextPortOfCall:
        cv['h-portsRoute'] ??
        formatPortsRoute02(ship.lastPortOfCall, ship.nextPortOfCall, ship.portOfCall, appData.ports || []),
      numberOfPersonsOnBoard: cv['h-persons'] ?? String(crew.length + pax.length),
      periodOfStay: cv['h-period'] ?? formatPeriod(periodDays(ship.dateOfArrival, ship.dateOfDeparture)),
      placeOfStorage: cv['h-storage'] ?? String(form.placeOfStorage || '').trim(),
      articles,
      footerDate:
        cv['footer-date'] ??
        formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      footerMaster: cv['footer-master'] ?? formatMasterName(findMaster(crew)),
    };
  }

  global.CrewShipStoresPdf = global.CrewShipStoresPdf || {};
  global.CrewShipStoresPdf.buildForm02FromAppData = buildForm02FromAppData;
  global.CrewShipStoresPdf.ROW_COUNT_02 = ROW_COUNT;
})(typeof window !== 'undefined' ? window : globalThis);

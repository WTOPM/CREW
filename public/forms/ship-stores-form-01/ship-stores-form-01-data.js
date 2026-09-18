/**
 * Build Form 01 snapshot data for HTML editor / PDF (shared with Angular util).
 */
(function (global) {
  const ROW_COUNT = 27;

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

  function formatPortsRoute(last, next, current, ports) {
    const from = formatPortWithCountry(last, ports);
    const to = formatPortWithCountry(next || current, ports);
    if (from && to) return `${from} / ${to}`;
    return from || to;
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
    if (global.CrewNameFormat?.formatCrewListName) {
      return global.CrewNameFormat.formatCrewListName(member, { upper: true });
    }
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
      });
    }
    return out;
  }

  function buildForm01FromAppData(appData, formatForPdf, options) {
    const ignoreOverlay = !!(options && options.ignoreOverlay);
    const ship = appData.ship || {};
    const form = appData.shipStoresForm || {};
    const overlay = appData.documentOverlay?.shipStores;
    const cv = ignoreOverlay ? {} : overlay?.cellValues || {};
    const isArrival = ignoreOverlay ? true : cv._ssMode !== 'departure';
    const list = isArrival ? 'arrival' : 'departure';
    const crew = activeCrew(appData, list);
    const pax = activePax(appData, list);

    const articles = normalizeRows(form.rows, !!formatForPdf);
    // Articles + ship headers always from live AppData. Overlay may only keep
    // _ssMode / h-pageNo / Form-02 extra cols (and styles) — see stripLiveShipStoresCellValues.

    return {
      arrival: isArrival,
      departure: !isArrival,
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: formatPortName(ship.name),
      portOfArrivalDeparture: formatPortName(ship.portOfCall),
      dateOfArrivalDeparture: formatDisplayDate(
        isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
      ),
      nationalityOfShip: formatPortName(ship.nationality),
      portArrivedFromOrDestination: formatPortsRoute(
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.portOfCall,
        appData.ports || [],
      ),
      numberOfPersonsOnBoard: String(crew.length + pax.length),
      periodOfStay: formatPeriod(periodDays(ship.dateOfArrival, ship.dateOfDeparture)),
      placeOfStorage: String(form.placeOfStorage || '').trim(),
      articles,
      footerDate: formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      footerMaster: formatMasterName(findMaster(crew)),
    };
  }

  global.CrewShipStoresPdf = global.CrewShipStoresPdf || {};
  global.CrewShipStoresPdf.buildForm01FromAppData = buildForm01FromAppData;
  global.CrewShipStoresPdf.ROW_COUNT_01 = ROW_COUNT;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Build Form 02 snapshot data for Crew Effect HTML editor / PDF.
 */
(function (global) {
  const ROW_COUNT = 18;
  const NIL = 'NIL';

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

  function formatCrewName(member) {
    if (!member) return '';
    if (global.CrewNameFormat?.formatCrewListName) {
      return global.CrewNameFormat.formatCrewListName(member, { upper: true });
    }
    const parts = [member.familyName, member.givenNames].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.join(' ').toUpperCase();
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

  function normalizeForm(raw) {
    const defaults = {
      others: '- P. E. -',
      nilCigarettes: false,
      nilTobaccoCigars: false,
      nilSpirits: false,
      nilBeer: false,
      appendPassengers: false,
    };
    const legacy = raw || {};
    const others = String(legacy.others ?? legacy.signatureText ?? defaults.others).trim();
    return {
      others: others || defaults.others,
      nilCigarettes: !!legacy.nilCigarettes,
      nilTobaccoCigars: !!legacy.nilTobaccoCigars,
      nilSpirits: !!legacy.nilSpirits,
      nilBeer: !!legacy.nilBeer,
      appendPassengers: !!legacy.appendPassengers,
    };
  }

  function activeCrew(data, list) {
    const isArrival = list === 'arrival';
    return (data.crew || []).filter(
      (c) => !c.archived && (isArrival ? !!c.onArrivalList : !!c.onDepartureList),
    );
  }

  function activePax(data, list) {
    const isArrival = list === 'arrival';
    return (data.passengers || []).filter(
      (p) => !p.archived && (isArrival ? !!p.onArrivalList : !!p.onDepartureList),
    );
  }

  function passengersToCrewRows(passengers) {
    return (passengers || []).map((p) => ({
      familyName: p.familyName,
      givenNames: p.givenNames,
      rank: p.rank || 'PASSENGER',
    }));
  }

  function crewListRows(appData, appendPassengers, maxRows, list) {
    const crew = activeCrew(appData, list).slice(0, maxRows);
    if (!appendPassengers) return crew;
    const remaining = maxRows - crew.length;
    if (remaining <= 0) return crew;
    return [...crew, ...passengersToCrewRows(activePax(appData, list)).slice(0, remaining)];
  }

  function baseRowFromMember(member, index, form) {
    const other = form.others.trim();
    return {
      no: String(index + 1),
      familyGivenNames: formatCrewName(member),
      rankOrRating: String(member.rank || '').trim(),
      cigarettes: form.nilCigarettes ? NIL : '',
      tobaccoCigares: form.nilTobaccoCigars ? NIL : '',
      spirits: form.nilSpirits ? NIL : '',
      beer: form.nilBeer ? NIL : '',
      other,
      signature: '',
    };
  }

  function emptyRow() {
    return {
      no: '',
      familyGivenNames: '',
      rankOrRating: '',
      cigarettes: '',
      tobaccoCigares: '',
      spirits: '',
      beer: '',
      other: '',
      signature: '',
    };
  }

  const CREW_CELL_FIELDS_02 = [
    'no',
    'familyGivenNames',
    'rankOrRating',
    'cigarettes',
    'tobaccoCigares',
    'spirits',
    'beer',
    'other',
    'signature',
  ];

  function applyCrewRowOverrides(row, rowIndex, cv) {
    if (!cv || !row) return row;
    const out = { ...row };
    CREW_CELL_FIELDS_02.forEach((field, col) => {
      const key = `d-${rowIndex}-${col}`;
      if (cv[key] !== undefined) out[field] = cv[key];
    });
    return out;
  }

  function buildForm02FromAppData(appData, formatForPdf, options) {
    const ignoreOverlay = !!(options && options.ignoreOverlay);
    const modeOverride = options && options.mode;
    const ship = appData.ship || {};
    const form = normalizeForm(appData.crewEffectForm02);
    const overlay = appData.documentOverlay?.crewEffect02;
    const cv = ignoreOverlay ? {} : overlay?.cellValues || {};
    // Document A/D from editor Save (`_ceMode`); optional override while toggling in UI.
    let isArrival;
    if (modeOverride === 'arrival' || modeOverride === 'departure') {
      isArrival = modeOverride === 'arrival';
    } else if (Object.prototype.hasOwnProperty.call(cv, '_ceMode')) {
      isArrival = cv._ceMode !== 'departure';
    } else {
      isArrival = appData.crewArr?.isArrival !== false;
    }
    const list = isArrival ? 'arrival' : 'departure';
    const crewList = activeCrew(appData, list);
    const members = crewListRows(appData, form.appendPassengers, ROW_COUNT, list);

    const defaultCrew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      defaultCrew.push(members[i] ? baseRowFromMember(members[i], i, form) : emptyRow());
    }

    // Crew identity always live; optional NIL / goods cell tweaks may remain in overlay
    // but name/rank/no are never pinned (see strip on normalize/save).
    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const row = applyCrewRowOverrides(defaultCrew[i] || emptyRow(), i, cv);
      // Re-assert live identity after any legacy frozen d-*-0/1/2 values.
      if (defaultCrew[i]) {
        row.no = defaultCrew[i].no;
        row.familyGivenNames = defaultCrew[i].familyGivenNames;
        row.rankOrRating = defaultCrew[i].rankOrRating;
      }
      crew.push(row);
    }

    const voyageIso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;

    return {
      arrival: isArrival,
      departure: !isArrival,
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: formatPortName(ship.name),
      portOfArrivalDeparture: formatPortWithCountry(ship.portOfCall, appData.ports || []),
      dateOfArrivalDeparture: formatDisplayDate(voyageIso),
      nationalityOfShip: formatPortName(ship.nationality),
      crew: global.CrewCrewEffectPdf.normalizeCrewEffectRowNos(crew),
      footerDate: formatDisplayDate(voyageIso),
      footerMaster: formatMasterName(findMaster(crewList)),
    };
  }

  function crewSignatureMembers(appData, list) {
    if (!appData) return [];
    const form = normalizeForm(appData.crewEffectForm02);
    const cv = appData.documentOverlay?.crewEffect02?.cellValues || {};
    let mode = list;
    if (!mode) {
      if (Object.prototype.hasOwnProperty.call(cv, '_ceMode')) {
        mode = cv._ceMode === 'departure' ? 'departure' : 'arrival';
      } else {
        mode = appData.crewArr?.isArrival !== false ? 'arrival' : 'departure';
      }
    }
    return crewListRows(appData, form.appendPassengers, ROW_COUNT, mode).map((m) => ({
      id: m.id,
      hasSignature: !!m.hasSignature,
      label: formatCrewName(m),
    }));
  }

  global.CrewCrewEffectPdf = global.CrewCrewEffectPdf || {};
  global.CrewCrewEffectPdf.buildForm02FromAppData = buildForm02FromAppData;
  global.CrewCrewEffectPdf.crewSignatureMembers02 = (appData) => crewSignatureMembers(appData);
  global.CrewCrewEffectPdf.ROW_COUNT_02 = ROW_COUNT;
})(typeof window !== 'undefined' ? window : globalThis);

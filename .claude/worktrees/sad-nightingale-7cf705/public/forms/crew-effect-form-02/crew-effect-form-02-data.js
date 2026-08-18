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
      (c) => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false),
    );
  }

  function activePax(data, list) {
    const isArrival = list === 'arrival';
    return (data.passengers || []).filter(
      (p) => !p.archived && (isArrival ? p.onArrivalList !== false : p.onDepartureList !== false),
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

  function emptyRow(index) {
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

  function buildForm02FromAppData(appData, formatForPdf, options) {
    const ignoreOverlay = !!(options && options.ignoreOverlay);
    const ship = appData.ship || {};
    const form = normalizeForm(appData.crewEffectForm02);
    const overlay = appData.documentOverlay?.crewEffect02;
    const cv = ignoreOverlay ? {} : overlay?.cellValues || {};
    const isArrival = ignoreOverlay
      ? appData.crewArr?.isArrival !== false
      : cv._ceMode === 'departure'
        ? false
        : cv._ceMode === 'arrival'
          ? true
          : appData.crewArr?.isArrival !== false;
    const list = isArrival ? 'arrival' : 'departure';
    const crewList = activeCrew(appData, list);
    const members = crewListRows(appData, form.appendPassengers, ROW_COUNT, list);

    // Crew grid rows are always live — never pinned by the cell overlay, so the
    // document can never freeze on stale crew/passenger data (header/footer below
    // remain manually overridable).
    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      crew.push(members[i] ? baseRowFromMember(members[i], i, form) : emptyRow(i));
    }

    const voyageIso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;

    return {
      arrival: isArrival,
      departure: !isArrival,
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: cv['h-nameOfShip'] ?? formatPortName(ship.name),
      portOfArrivalDeparture:
        cv['h-port'] ?? formatPortWithCountry(ship.portOfCall, appData.ports || []),
      dateOfArrivalDeparture: cv['h-date'] ?? formatDisplayDate(voyageIso),
      nationalityOfShip: cv['h-nationality'] ?? formatPortName(ship.nationality),
      crew,
      footerDate:
        cv['footer-date'] ??
        formatDisplayDate(voyageIso),
      footerMaster: cv['footer-master'] ?? formatMasterName(findMaster(crewList)),
    };
  }

  function crewSignatureMembers(appData, list) {
    if (!appData) return [];
    const form = normalizeForm(appData.crewEffectForm02);
    const mode = list || 'arrival';
    return crewListRows(appData, form.appendPassengers, ROW_COUNT, mode).map((m) => ({
      id: m.id,
      hasSignature: !!m.hasSignature,
      label: formatCrewName(m),
    }));
  }

  global.CrewCrewEffectPdf = global.CrewCrewEffectPdf || {};
  global.CrewCrewEffectPdf.buildForm02FromAppData = buildForm02FromAppData;
  global.CrewCrewEffectPdf.crewSignatureMembers02 = (appData) => {
    const overlay = appData?.documentOverlay?.crewEffect02;
    const cv = overlay?.cellValues || {};
    const isArrival = cv._ceMode === 'departure' ? false : cv._ceMode === 'arrival' ? true : true;
    return crewSignatureMembers(appData, isArrival ? 'arrival' : 'departure');
  };
  global.CrewCrewEffectPdf.ROW_COUNT_02 = ROW_COUNT;
})(typeof window !== 'undefined' ? window : globalThis);

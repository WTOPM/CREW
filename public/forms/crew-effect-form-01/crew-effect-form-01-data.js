/**
 * Build Form 01 snapshot data for Crew Effect HTML editor / PDF.
 */
(function (global) {
  const ROW_COUNT = 24;
  const DATA_ROWS = ROW_COUNT;
  const NIL = 'NIL';

  function formatPortName(name) {
    return String(name || '').trim().toUpperCase();
  }

  function formatCrewName(member) {
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
      nilSpirits: false,
      nilWines: false,
      appendPassengers: false,
    };
    const legacy = raw || {};
    const others = String(legacy.others ?? legacy.signatureText ?? defaults.others).trim();
    return {
      others: others || defaults.others,
      nilCigarettes: !!legacy.nilCigarettes,
      nilSpirits: !!legacy.nilSpirits,
      nilWines: !!legacy.nilWines,
      appendPassengers: !!legacy.appendPassengers,
    };
  }

  function activeCrew(data) {
    return (data.crew || []).filter((c) => !c.archived && c.onArrivalList !== false);
  }

  function activePax(data) {
    return (data.passengers || []).filter((p) => !p.archived && p.onArrivalList !== false);
  }

  function passengersToCrewRows(passengers) {
    return (passengers || []).map((p) => ({
      familyName: p.familyName,
      givenNames: p.givenNames,
      rank: p.rank || 'PASSENGER',
    }));
  }

  function crewListRows(appData, appendPassengers, maxRows) {
    const crew = activeCrew(appData).slice(0, maxRows);
    if (!appendPassengers) return crew;
    const remaining = maxRows - crew.length;
    if (remaining <= 0) return crew;
    return [...crew, ...passengersToCrewRows(activePax(appData)).slice(0, remaining)];
  }

  function baseRowFromMember(member, index, form) {
    const others = form.others.trim();
    return {
      no: String(index + 1),
      familyGivenNames: formatCrewName(member),
      rankOrRating: String(member.rank || '').trim(),
      cigarettes: form.nilCigarettes ? NIL : '',
      spirits: form.nilSpirits ? NIL : '',
      wines: form.nilWines ? NIL : '',
      others: others,
      signature: '',
    };
  }

  function emptyRow() {
    return {
      no: '',
      familyGivenNames: '',
      rankOrRating: '',
      cigarettes: '',
      spirits: '',
      wines: '',
      others: '',
      signature: '',
    };
  }

  const CREW_CELL_FIELDS = [
    'no',
    'familyGivenNames',
    'rankOrRating',
    'cigarettes',
    'spirits',
    'wines',
    'others',
    'signature',
  ];

  /** Apply AA/Aa (and other) editor text overrides onto a live crew row. */
  function applyCrewRowOverrides(row, rowIndex, cv) {
    if (!cv || !row) return row;
    const out = { ...row };
    CREW_CELL_FIELDS.forEach((field, col) => {
      const key = `d-${rowIndex}-${col}`;
      if (cv[key] !== undefined) out[field] = cv[key];
    });
    return out;
  }

  function formatDisplayDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
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

  function buildForm01FromAppData(appData, formatForPdf, options) {
    const ignoreOverlay = !!(options && options.ignoreOverlay);
    const ship = appData.ship || {};
    const form = normalizeForm(appData.crewEffectForm);
    const overlay = appData.documentOverlay?.crewEffect;
    const cv = ignoreOverlay ? {} : overlay?.cellValues || {};
    const members = crewListRows(appData, form.appendPassengers, DATA_ROWS);
    const crewList = activeCrew(appData);

    const defaultCrew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      if (i < DATA_ROWS && members[i]) {
        defaultCrew.push(baseRowFromMember(members[i], i, form));
      } else {
        defaultCrew.push(emptyRow());
      }
    }

    // Live crew/passenger list first; overlay cellValues (AA/Aa etc.) override after.
    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      crew.push(applyCrewRowOverrides(defaultCrew[i] || emptyRow(), i, cv));
    }

    return {
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: cv['h-nameOfShip'] ?? formatPortName(ship.name),
      nationalityOfShip: cv['h-nationality'] ?? formatPortName(ship.nationality),
      crew: global.CrewCrewEffectPdf.normalizeCrewEffectRowNos(crew),
      footerMaster: cv['footer-master'] ?? formatMasterName(findMaster(crewList)),
    };
  }

  function crewSignatureMembers(appData) {
    if (!appData) return [];
    const form = normalizeForm(appData.crewEffectForm);
    return crewListRows(appData, form.appendPassengers, DATA_ROWS).map((m) => ({
      id: m.id,
      hasSignature: !!m.hasSignature,
      label: formatCrewName(m),
    }));
  }

  global.CrewCrewEffectPdf = global.CrewCrewEffectPdf || {};
  global.CrewCrewEffectPdf.buildForm01FromAppData = buildForm01FromAppData;
  global.CrewCrewEffectPdf.crewSignatureMembers01 = crewSignatureMembers;
  global.CrewCrewEffectPdf.ROW_COUNT_01 = ROW_COUNT;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Build Form 01 snapshot data for Crew Effect HTML editor / PDF.
 */
(function (global) {
  const ROW_COUNT = 24;
  const DATA_ROWS = 13;
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

  function emptyRow(index) {
    return {
      no: String(index + 1),
      familyGivenNames: '',
      rankOrRating: '',
      cigarettes: '',
      spirits: '',
      wines: '',
      others: '',
      signature: '',
    };
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
        defaultCrew.push(emptyRow(i));
      }
    }

    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const base = defaultCrew[i] || emptyRow(i);
      crew.push({
        no: cv[`d-${i}-0`] !== undefined ? String(cv[`d-${i}-0`]) : base.no,
        familyGivenNames:
          cv[`d-${i}-1`] !== undefined ? String(cv[`d-${i}-1`]) : base.familyGivenNames,
        rankOrRating: cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.rankOrRating,
        cigarettes: cv[`d-${i}-3`] !== undefined ? String(cv[`d-${i}-3`]) : base.cigarettes,
        spirits: cv[`d-${i}-4`] !== undefined ? String(cv[`d-${i}-4`]) : base.spirits,
        wines: cv[`d-${i}-5`] !== undefined ? String(cv[`d-${i}-5`]) : base.wines,
        others: cv[`d-${i}-6`] !== undefined ? String(cv[`d-${i}-6`]) : base.others,
        signature: cv[`d-${i}-7`] !== undefined ? String(cv[`d-${i}-7`]) : base.signature,
      });
    }

    return {
      pageNo: cv['h-pageNo'] ?? '1',
      nameOfShip: cv['h-nameOfShip'] ?? formatPortName(ship.name),
      nationalityOfShip: cv['h-nationality'] ?? formatPortName(ship.nationality),
      crew,
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

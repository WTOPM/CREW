/**
 * Arrival / Departure list mode for HTML crew & passenger forms.
 * Rebuilds table rows when the user toggles Arrival ↔ Departure (date alone is not enough).
 */
(function (global) {
  function isArrivalMode(mode) {
    return String(mode || '').toLowerCase() !== 'departure';
  }

  function orderByIds(members, orderIds) {
    if (!Array.isArray(members) || !members.length) return [];
    if (!Array.isArray(orderIds) || !orderIds.length) return members.slice();
    const byId = new Map(members.map((m) => [m.id, m]));
    const ordered = [];
    const seen = new Set();
    for (const id of orderIds) {
      const m = byId.get(id);
      if (m && !seen.has(id)) {
        ordered.push(m);
        seen.add(id);
      }
    }
    for (const m of members) {
      if (m?.id != null && !seen.has(m.id)) ordered.push(m);
    }
    return ordered;
  }

  /** Same membership + order as Angular filterActiveCrewList / filterActivePassengerList. */
  function filterCrew(appData, mode) {
    if (!appData || !Array.isArray(appData.crew)) return [];
    const arrival = isArrivalMode(mode);
    const active = appData.crew.filter(
      (c) => !c.archived && (arrival ? !!c.onArrivalList : !!c.onDepartureList),
    );
    const order = arrival ? appData.crewArrivalOrder : appData.crewDepartureOrder;
    return orderByIds(active, order);
  }

  function filterPassengers(appData, mode) {
    if (!appData || !Array.isArray(appData.passengers)) return [];
    const arrival = isArrivalMode(mode);
    const active = appData.passengers.filter(
      (p) => !p.archived && (arrival ? !!p.onArrivalList : !!p.onDepartureList),
    );
    const order = arrival ? appData.passengerArrivalOrder : appData.passengerDepartureOrder;
    return orderByIds(active, order);
  }

  function applyAdCheckboxUi(mode) {
    const arrival = isArrivalMode(mode);
    const arrBox = document.getElementById('cb-arr');
    const depBox = document.getElementById('cb-dep');
    if (arrBox) arrBox.textContent = arrival ? '\u2713' : '';
    if (depBox) depBox.textContent = arrival ? '' : '\u2713';
    document.querySelectorAll('.ad-lbl').forEach((el) => {
      el.classList.toggle('ad-lbl--active', el.dataset.ad === (arrival ? 'arrival' : 'departure'));
    });
  }

  function applyVoyageDates(mode, ship) {
    if (!ship) return;
    const arrival = isArrivalMode(mode);
    const iso = arrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const dateEl = document.getElementById('h-date');
    const footerDateEl = document.getElementById('f-footer-date');
    const fmt =
      (global.HtmlFormDateFormat?.format && global.HtmlFormDateFormat.format(iso, 'dot')) ||
      iso ||
      '';
    if (dateEl) {
      if (global.HtmlFormDateFormat?.setElement) global.HtmlFormDateFormat.setElement(dateEl, iso);
      else dateEl.value = fmt;
    }
    if (footerDateEl) {
      if (global.HtmlFormDateFormat?.setElement) {
        global.HtmlFormDateFormat.setElement(footerDateEl, iso);
      } else {
        footerDateEl.value = fmt;
      }
    }
    global.HtmlFormLiveVoyageDate?.sync?.(arrival ? 'arrival' : 'departure');
  }

  function pickMasterName(members, options) {
    const opts = options || {};
    const list = Array.isArray(members) ? members : [];
    if (!list.length) return '';
    const master =
      list.find((c) => c.rank && String(c.rank).trim().toLowerCase() === 'master') ||
      list.find((c) => c.rank && String(c.rank).toLowerCase().includes('master')) ||
      list[0];
    if (!master || !global.CrewNameFormat?.formatCrewListName) return '';
    return global.CrewNameFormat.formatCrewListName(master, {
      upper: !!opts.upper,
    });
  }

  function clearBody(bodyEl) {
    if (!bodyEl) return;
    while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
  }

  function captureBodyCellStyles(bodyEl) {
    const cellStyles = {};
    if (!bodyEl) return cellStyles;
    const rows = bodyEl.querySelectorAll(':scope > tr, :scope > .table-row');
    rows.forEach((tr, rowIndex) => {
      tr.querySelectorAll('input.ci').forEach((input, colIndex) => {
        const style = global.CrewCellFormat?.readStyle?.(input) || null;
        if (style) cellStyles[`${rowIndex}-${colIndex}`] = style;
      });
      const nameCell = tr.querySelector('.ci-name');
      if (nameCell) {
        const nameStyle = global.CrewCellFormat?.readStyle?.(nameCell) || null;
        if (nameStyle) cellStyles[`${rowIndex}-name`] = nameStyle;
      }
    });
    if (global.HtmlFormHeaderCells?.collectStyles) {
      Object.assign(cellStyles, global.HtmlFormHeaderCells.collectStyles());
    }
    return cellStyles;
  }

  /**
   * Rebuild crew/pax data rows for the selected Arrival/Departure mode.
   * Keeps stamp/signature DOM; restores cellStyles by row index after fill.
   *
   * @param {object} opts
   * @param {'arrival'|'departure'} opts.mode
   * @param {'crew'|'pax'} opts.kind
   * @param {object} opts.appData
   * @param {Element} opts.bodyEl — tbody or form-03 tableBody
   * @param {(rowData: object) => void} opts.addRow
   * @param {(member: object) => object} opts.mapMember
   * @param {number} [opts.maxRows]
   * @param {number|string} [opts.tableRowCount] — saved padding from overlay
   * @param {() => void} [opts.restoreStyles]
   * @param {() => void} [opts.refreshRowNumbers]
   * @param {boolean} [opts.masterNameUpper]
   * @param {() => void} [opts.afterFill] — form-03 temperatures, etc.
   * @param {boolean} [opts.updateFooterMaster=true]
   * @param {string[]} [opts.overlayPath]
   */
  function rebuildList(opts) {
    const o = opts || {};
    if (!o.bodyEl || typeof o.addRow !== 'function' || typeof o.mapMember !== 'function') return [];
    // Only skip during real PDF capture. Editor also sets __pdfReady=true after load —
    // that must NOT block Arrival/Departure list rebuilds.
    if (
      document.body.classList.contains('is-pdf-export') ||
      new URLSearchParams(location.search).get('pdfExport') === '1'
    ) {
      return [];
    }

    const liveStyles = captureBodyCellStyles(o.bodyEl);
    if (!global._currentPositions) {
      global._currentPositions = { stamp: {}, sig: {}, cellStyles: {}, cellValues: {} };
    }
    global._currentPositions.cellStyles = {
      ...(global._currentPositions.cellStyles || {}),
      ...liveStyles,
    };

    // Keep previous pad density when overlay has no tableRowCount (few A/D members
    // must not leave only 2–3 rows that stretch across the page).
    const priorRowCount = o.bodyEl.children.length;

    const mode = isArrivalMode(o.mode) ? 'arrival' : 'departure';
    const members =
      o.kind === 'pax' ? filterPassengers(o.appData, mode) : filterCrew(o.appData, mode);

    clearBody(o.bodyEl);
    for (const member of members) {
      o.addRow(o.mapMember(member));
    }

    const maxRows = Number(o.maxRows) > 0 ? Number(o.maxRows) : 0;
    if (maxRows > 0 && global.HtmlFormCrewListKit?.applyTargetRowCount) {
      let target = o.bodyEl.children.length;
      const savedOrPrior =
        o.tableRowCount != null && o.tableRowCount !== '' ? o.tableRowCount : priorRowCount;
      if (global.HtmlFormCrewListKit.resolveTargetRowCount) {
        target = global.HtmlFormCrewListKit.resolveTargetRowCount(
          savedOrPrior,
          o.bodyEl.children.length,
          maxRows,
        );
      } else if (Number(savedOrPrior) > target) {
        target = Number(savedOrPrior);
      }
      global.HtmlFormCrewListKit.applyTargetRowCount(o.bodyEl, Math.min(target, maxRows), () =>
        o.addRow({}),
      );
    }

    if (o.updateFooterMaster !== false) {
      const masterName = pickMasterName(members, { upper: !!o.masterNameUpper });
      const locked = o.appData?.documentOverlay
        ? findFooterMasterOverride(o.appData, o.overlayPath)
        : '';
      if (!locked && global.HtmlFormFooterFields?.setMasterName) {
        global.HtmlFormFooterFields.setMasterName(masterName);
      }
    }

    if (typeof o.restoreStyles === 'function') o.restoreStyles();
    // Clear zoom-polluted inline heights from addRow sync, then measure in layout px.
    o.bodyEl.querySelectorAll?.('textarea.ci').forEach((ta) => {
      ta.style.removeProperty('height');
    });
    if (global.HtmlFormCrewListKit?.syncRowHeights) {
      global.HtmlFormCrewListKit.syncRowHeights(o.bodyEl);
    }
    if (typeof o.refreshRowNumbers === 'function') o.refreshRowNumbers();
    if (typeof o.afterFill === 'function') o.afterFill(members);

    return members;
  }

  function findFooterMasterOverride(appData, overlayPath) {
    if (!overlayPath) return '';
    // overlayPath like ['crewList','byType','type1Passport'] or ['pax']
    let cur = appData.documentOverlay;
    for (const key of overlayPath) {
      if (!cur || typeof cur !== 'object') return '';
      cur = cur[key];
    }
    const name = cur?.footerMasterName;
    return typeof name === 'string' ? name.trim() : '';
  }

  /**
   * Standard Arrival/Departure UI + voyage date + optional list rebuild.
   * Pass `rebuild` to refresh crew/pax rows; omit during initial loadAppData fill.
   */
  function setArrivalDeparture(mode, options) {
    const opts = options || {};
    const next = isArrivalMode(mode) ? 'arrival' : 'departure';
    global._adMode = next;
    applyAdCheckboxUi(next);
    applyVoyageDates(next, opts.ship || global._shipData);
    if (opts.rebuild && typeof opts.rebuild === 'function') {
      opts.rebuild(next);
    }
    return next;
  }

  global.HtmlFormListMode = {
    isArrivalMode,
    filterCrew,
    filterPassengers,
    applyAdCheckboxUi,
    applyVoyageDates,
    pickMasterName,
    clearBody,
    rebuildList,
    setArrivalDeparture,
  };
})(typeof window !== 'undefined' ? window : globalThis);

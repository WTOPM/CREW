/**
 * Keep HTML form voyage dates (and Port of Call ship/port headers) in sync with Home.
 * Saved cellValues / footerSignatureDate must not freeze old voyage fields into PDFs.
 */
(function (global) {
  function fmtDate(iso) {
    if (global.HtmlFormDateFormat) {
      return global.HtmlFormDateFormat.format(iso, global.HtmlFormDateFormat.getActive?.() || 'dot');
    }
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso || '');
    const [y, m, d] = String(iso).split('-');
    return `${d}.${m}.${y}`;
  }

  function setInputOrText(el, display, iso) {
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = display;
    } else {
      el.textContent = display;
    }
    if (iso && global.HtmlFormDateFormat?.isoAttr) {
      const attr = global.HtmlFormDateFormat.isoAttr(iso);
      if (attr) {
        const m = /^(\S+)=["']([^"']*)["']$/.exec(attr.trim());
        if (m) el.setAttribute(m[1], m[2]);
      }
      el.dataset.isoDate = iso;
    }
  }

  function setCellKey(key, display, iso) {
    document.querySelectorAll(`input.ci[data-cell-key="${key}"]`).forEach((el) => {
      setInputOrText(el, display, iso);
    });
  }

  function formatPortHeader(name, ports, withCountry) {
    const POC = global.CrewPortOfCallPdf;
    if (!POC) return String(name || '');
    if (withCountry) return POC.formatPortWithCountry(name, ports);
    return POC.formatPortName(name);
  }

  /**
   * @param {'arrival'|'departure'} mode
   * @param {{ ship?: object, ports?: object[] } | null} [opts]
   */
  function sync(mode, opts) {
    const ship = opts?.ship || global._shipData || global._appData?.ship;
    if (!ship) return;
    const iso = mode === 'departure' ? ship.dateOfDeparture : ship.dateOfArrival;
    const display = fmtDate(iso);
    const ids = ['h-date', 'f-footer-date', 'poc-footer-date'];
    ids.forEach((id) => setInputOrText(document.getElementById(id), display, iso));
    document.querySelectorAll('input.ci[data-cell-key="h-0-3"], input.ci[data-cell-key="h-date"]').forEach((el) => {
      setInputOrText(el, display, iso);
    });
    document.querySelectorAll('[data-cell-key="footer-date"]').forEach((el) => {
      setInputOrText(el, display, iso);
    });

    // Port of Call headers — always follow Home (not frozen overlay cellValues).
    const ports =
      opts?.ports ||
      global._pocEditorSnapshot?.ports ||
      global._appData?.ports ||
      [];
    const isForm02 = !!document.querySelector('.poc-form-02');
    const isForm01 = !!document.querySelector('.poc-form-01');
    if (!isForm01 && !isForm02) return;

    setCellKey('h-0-0', String(ship.name || ''));
    if (isForm02) {
      setCellKey('h-0-1', String(ship.imoNo || ''));
      setCellKey('h-0-2', formatPortHeader(ship.portOfCall, ports, true));
      setCellKey('h-1-0', formatPortHeader(ship.nationality, ports, false));
      setCellKey('h-1-1', formatPortHeader(ship.lastPortOfCall, ports, true));
      setCellKey('h-1-2', formatPortHeader(ship.nextPortOfCall, ports, true));
    } else {
      setCellKey('h-0-1', String(ship.callSign || ''));
      setCellKey('h-0-2', formatPortHeader(ship.portOfCall, ports, false));
      setCellKey('h-1-0', formatPortHeader(ship.nationality, ports, false));
      setCellKey('h-1-1', formatPortHeader(ship.homeport, ports, false));
      setCellKey('h-1-2', formatPortHeader(ship.lastPortOfCall, ports, false));
      setCellKey('h-1-3', formatPortHeader(ship.nextPortOfCall, ports, false));
    }
  }

  /** Keys that must always follow Home voyage fields — strip on save / skip on restore. */
  const LIVE_VOYAGE_VALUE_KEYS = new Set([
    'h-date',
    'h-0-0',
    'h-0-1',
    'h-0-2',
    'h-0-3',
    'h-1-0',
    'h-1-1',
    'h-1-2',
    'h-1-3',
    'footer-date',
    'f-footer-date',
    'poc-footer-date',
  ]);

  function stripLiveVoyageKeys(cellValues) {
    if (!cellValues || typeof cellValues !== 'object') return cellValues || {};
    const out = { ...cellValues };
    for (const key of Object.keys(out)) {
      if (LIVE_VOYAGE_VALUE_KEYS.has(key)) delete out[key];
      // Drop frozen port-history / LOCODE cells from older Saves.
      if (/^d-\d+-\d+[a-z]*$/i.test(key)) delete out[key];
    }
    return out;
  }

  global.HtmlFormLiveVoyageDate = {
    sync,
    stripLiveVoyageKeys,
    LIVE_VOYAGE_VALUE_KEYS,
  };
})(typeof window !== 'undefined' ? window : globalThis);

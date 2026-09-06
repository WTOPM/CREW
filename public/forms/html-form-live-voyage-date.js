/**
 * Keep HTML form voyage dates in sync with Home (ship.dateOfArrival / dateOfDeparture).
 * Saved cellValues / footerSignatureDate must not freeze an old voyage date into PDFs.
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

  /**
   * @param {'arrival'|'departure'} mode
   * @param {{ ship?: object } | null} [opts]
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
  }

  /** Keys that must always follow Home voyage dates — strip on save / skip on restore. */
  const LIVE_VOYAGE_VALUE_KEYS = new Set([
    'h-date',
    'h-0-3',
    'footer-date',
    'f-footer-date',
    'poc-footer-date',
  ]);

  function stripLiveVoyageKeys(cellValues) {
    if (!cellValues || typeof cellValues !== 'object') return cellValues || {};
    const out = { ...cellValues };
    for (const key of Object.keys(out)) {
      if (LIVE_VOYAGE_VALUE_KEYS.has(key)) delete out[key];
    }
    return out;
  }

  global.HtmlFormLiveVoyageDate = {
    sync,
    stripLiveVoyageKeys,
    LIVE_VOYAGE_VALUE_KEYS,
  };
})(typeof window !== 'undefined' ? window : globalThis);

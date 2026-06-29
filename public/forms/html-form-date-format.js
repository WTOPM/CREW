/**
 * Shared date display formats for HTML form editors (crew / passenger / port of call).
 * Canonical storage: ISO yyyy-MM-dd on data-date-iso; display cycles via toolbar button.
 */
(function (global) {
  const TYPES = ['dot', 'shortMonth', 'fullMonth'];
  const SHORT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const FULL_MONTHS = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  const LABELS = {
    dot: 'DD.MM.YYYY',
    shortMonth: 'DD MON YYYY',
    fullMonth: 'DD MONTH YYYY',
  };
  const SAMPLE = {
    dot: '16.06.2026',
    shortMonth: '16 JUN 2026',
    fullMonth: '16 JUNE 2026',
  };

  let activeType = 'dot';

  function normalizeType(type) {
    return TYPES.includes(type) ? type : 'dot';
  }

  function parseDotDate(value) {
    const m = String(value || '')
      .trim()
      .match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!m) return '';
    let y = parseInt(m[3], 10);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(iso)) ? '' : iso;
  }

  function parseMonthDate(value, months) {
    const m = String(value || '')
      .trim()
      .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!m) return '';
    const mon = m[2].toUpperCase();
    const idx = months.indexOf(mon);
    if (idx < 0) return '';
    const iso = `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(iso)) ? '' : iso;
  }

  function parseToIso(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const dot = parseDotDate(raw);
    if (dot) return dot;
    const short = parseMonthDate(raw, SHORT_MONTHS);
    if (short) return short;
    const full = parseMonthDate(raw, FULL_MONTHS);
    if (full) return full;
    return '';
  }

  function partsFromIso(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-');
    const mi = parseInt(m, 10) - 1;
    if (mi < 0 || mi > 11) return null;
    return { d, m, y, mi };
  }

  function format(iso, type) {
    const t = normalizeType(type);
    const parts = partsFromIso(iso);
    if (!parts) return iso ? String(iso) : '';
    if (t === 'shortMonth') return `${parts.d} ${SHORT_MONTHS[parts.mi]} ${parts.y}`;
    if (t === 'fullMonth') return `${parts.d} ${FULL_MONTHS[parts.mi]} ${parts.y}`;
    return `${parts.d}.${parts.m}.${parts.y}`;
  }

  function isoAttr(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    return ` data-date-iso="${iso}"`;
  }

  function setElement(el, iso, type) {
    if (!el) return;
    const t = normalizeType(type || activeType);
    const parsed = iso || parseToIso(el.value || el.textContent || '');
    if (parsed) el.dataset.dateIso = parsed;
    else delete el.dataset.dateIso;
    const text = parsed ? format(parsed, t) : el.value || el.textContent || '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = text;
    else el.textContent = text;
  }

  function applyToScope(scope, type) {
    const root = scope || document;
    const t = normalizeType(type || activeType);
    root.querySelectorAll('[data-date-iso]').forEach((el) => {
      const iso = el.dataset.dateIso;
      if (!iso) return;
      const text = format(iso, t);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = text;
      else el.textContent = text;
    });
  }

  function syncIsoFromDisplay(el) {
    if (!el) return;
    const iso = parseToIso(el.value || el.textContent || '');
    if (iso) el.dataset.dateIso = iso;
  }

  function getActive() {
    return activeType;
  }

  function setActive(type) {
    activeType = normalizeType(type);
  }

  function nextType(type) {
    const t = normalizeType(type || activeType);
    const i = TYPES.indexOf(t);
    return TYPES[(i + 1) % TYPES.length];
  }

  function cycleActive(scope) {
    activeType = nextType(activeType);
    applyToScope(scope, activeType);
    return activeType;
  }

  function buttonLabel(type) {
    const t = normalizeType(type || activeType);
    return SAMPLE[t] || LABELS[t];
  }

  function tipLabel(type) {
    const t = normalizeType(type || activeType);
    return `Date format: ${LABELS[t]} (click to change)`;
  }

  global.HtmlFormDateFormat = {
    TYPES,
    LABELS,
    format,
    parseToIso,
    isoAttr,
    setElement,
    applyToScope,
    syncIsoFromDisplay,
    getActive,
    setActive,
    nextType,
    cycleActive,
    buttonLabel,
    tipLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);

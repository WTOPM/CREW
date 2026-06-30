/**
 * Footer date + master name — editable, selectable like other form cells.
 */
(function (global) {
  const FOOTER_DATE_SELECTOR = '#f-footer-date, #poc-footer-date, .poc-form-footer__date';
  const FOOTER_MASTER_SELECTOR = '#f-master-name, #poc-footer-master, .poc-form-footer__master';

  function ensureFooterStyles() {
    if (document.getElementById('html-form-footer-styles')) return;
    const link = document.createElement('link');
    link.id = 'html-form-footer-styles';
    link.rel = 'stylesheet';
    link.href = '../html-form-footer.css';
    document.head.appendChild(link);
  }

  function isPocFooterMaster(el) {
    return el?.classList?.contains('poc-form-footer__master');
  }

  function isPocFooterDate(el) {
    return el?.classList?.contains('poc-form-footer__date');
  }

  function ensureMasterInput(el) {
    if (!el) return null;
    if (isPocFooterMaster(el)) {
      if (!el.dataset.cellKey) el.dataset.cellKey = 'footer-master';
      return el;
    }
    if (el.tagName === 'INPUT') {
      el.classList.add('ci', 'ci-footer');
      if (!el.dataset.cellKey) el.dataset.cellKey = 'footer-master';
      el.readOnly = true;
      el.tabIndex = -1;
      return el;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.id = el.id || 'f-master-name';
    input.className = `${el.className} ci ci-footer`.trim();
    if (el.getAttribute('style')) input.setAttribute('style', el.getAttribute('style'));
    input.value = (el.textContent || '').trim();
    input.readOnly = true;
    input.tabIndex = -1;
    input.dataset.cellKey = 'footer-master';
    el.replaceWith(input);
    return input;
  }

  function prepareFooterDate(el) {
    if (!el) return;
    if (isPocFooterDate(el)) {
      if (!el.dataset.cellKey) el.dataset.cellKey = 'footer-date';
      if (el.tagName === 'INPUT') {
        el.readOnly = true;
        el.tabIndex = -1;
      }
      return;
    }
    el.classList.add('ci', 'ci-footer', 'fi');
    if (!el.dataset.cellKey) el.dataset.cellKey = 'footer-date';
    el.readOnly = true;
    el.tabIndex = -1;
  }

  function init(scope) {
    ensureFooterStyles();
    const root = scope || document;
    root.querySelectorAll(FOOTER_MASTER_SELECTOR).forEach(ensureMasterInput);
    root.querySelectorAll(FOOTER_DATE_SELECTOR).forEach(prepareFooterDate);
  }

  function masterEl(scope) {
    const root = scope || document;
    return root.querySelector(FOOTER_MASTER_SELECTOR);
  }

  function dateEl(scope) {
    const root = scope || document;
    return root.querySelector(FOOTER_DATE_SELECTOR);
  }

  function getMasterName(scope) {
    const el = masterEl(scope);
    if (!el) return '';
    return el.value || el.textContent || '';
  }

  function setMasterName(text, scope) {
    const el = masterEl(scope);
    if (!el) return;
    if (el.tagName === 'INPUT') el.value = text || '';
    else el.textContent = text || '';
  }

  global.HtmlFormFooterFields = {
    init,
    masterEl,
    dateEl,
    getMasterName,
    setMasterName,
    FOOTER_DATE_SELECTOR,
    FOOTER_MASTER_SELECTOR,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Load / save shared HTML form overlay fields (footer master name; date format on Port of Call only).
 */
(function (global) {
  function applyFromVariant(variant, scope, options) {
    const dateFormat = options?.dateFormat === true;
    const page = scope || document.querySelector('.a4-page') || document;
    if (dateFormat && global.HtmlFormDateFormat) {
      global.HtmlFormDateFormat.setActive(variant?.dateDisplayFormat || 'dot');
    }
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(page);
      if (variant?.footerMasterName) {
        global.HtmlFormFooterFields.setMasterName(variant.footerMasterName, page);
      }
    }
    if (dateFormat && global.HtmlFormDateFormat) {
      global.HtmlFormDateFormat.applyToScope(page, global.HtmlFormDateFormat.getActive());
    }
  }

  function collectForSave(scope, options) {
    const dateFormat = options?.dateFormat === true;
    const page = scope || document;
    return {
      ...(dateFormat
        ? { dateDisplayFormat: global.HtmlFormDateFormat?.getActive?.() || 'dot' }
        : {}),
      footerMasterName: global.HtmlFormFooterFields?.getMasterName?.(page)?.trim() || undefined,
    };
  }

  global.HtmlFormEditorOverlay = { applyFromVariant, collectForSave };
})(typeof window !== 'undefined' ? window : globalThis);

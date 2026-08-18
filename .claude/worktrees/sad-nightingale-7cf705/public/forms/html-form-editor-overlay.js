/**
 * Load / save shared HTML form footer fields (crew list editors).
 */
(function (global) {
  function applyFromVariant(variant, scope, defaultMasterName) {
    const page = scope || document.querySelector('.a4-page') || document;
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(page);
      if (variant?.footerMasterName) {
        global.HtmlFormFooterFields.setMasterName(variant.footerMasterName, page);
      } else if (defaultMasterName) {
        global.HtmlFormFooterFields.setMasterName(defaultMasterName, page);
      }
    }
  }

  function collectForSave(scope) {
    return {
      footerMasterName: global.HtmlFormFooterFields?.getMasterName?.(scope || document)?.trim() || undefined,
    };
  }

  global.HtmlFormEditorOverlay = { applyFromVariant, collectForSave };
})(typeof window !== 'undefined' ? window : globalThis);

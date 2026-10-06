/**
 * Load / save shared HTML form footer fields (crew list editors).
 * Master signature name is always live from the current crew/pax list —
 * never restored from a frozen overlay value.
 */
(function (global) {
  function applyFromVariant(variant, scope, defaultMasterName) {
    const page = scope || document.querySelector('.a4-page') || document;
    if (!global.HtmlFormFooterFields) return;
    global.HtmlFormFooterFields.init(page);
    // Prefer the name derived from the list being printed (arrival/departure).
    // Ignore variant.footerMasterName — it freezes the previous captain after TO ARRIVAL.
    if (defaultMasterName != null) {
      global.HtmlFormFooterFields.setMasterName(String(defaultMasterName), page);
    }
  }

  function collectForSave(scope) {
    // Do not persist footer master — always re-derived from the list on open/rebuild.
    return {};
  }

  /** Drop live-derived footer fields so saves cannot re-freeze an old captain. */
  function stripLiveFields(partial) {
    if (!partial || typeof partial !== 'object') return {};
    const {
      footerMasterName: _omitMaster,
      footerSignatureDate: _omitDate,
      ...rest
    } = partial;
    return rest;
  }

  global.HtmlFormEditorOverlay = { applyFromVariant, collectForSave, stripLiveFields };
})(typeof window !== 'undefined' ? window : globalThis);

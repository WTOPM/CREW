/**
 * PDF capture passes AppData snapshots via sessionStorage (?pdfData=1) so large
 * payloads (crew + cell styles) never hit URL/header size limits (HTTP 431).
 */
(function () {
  const KEY = 'crew-html-form-pdf-snapshot';
  const PARAM = 'pdfData';

  function read() {
    const params = new URLSearchParams(window.location.search);
    const inline = params.get('data');
    if (inline) {
      try {
        return JSON.parse(inline);
      } catch (e) {
        /* legacy inline snapshot — ignore parse errors */
      }
    }
    if (params.get(PARAM) === '1') {
      try {
        const raw = sessionStorage.getItem(KEY);
        if (raw) {
          sessionStorage.removeItem(KEY);
          return JSON.parse(raw);
        }
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  window.CrewHtmlFormPdfSnapshot = { read, KEY, PARAM };
})();

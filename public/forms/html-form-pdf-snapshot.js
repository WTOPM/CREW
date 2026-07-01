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

  const PAGE_SELECTORS =
    '.a4-page, .a4-landscape-page, .ssd-sheet, .ced-sheet, .nil-page, .poc-pages';

  /** Hoist Port of Call pages to body — zoom chrome can add a phantom print page. */
  function flattenPortOfCallDom() {
    if (!document.body.classList.contains('poc-editor')) return;
    const pocPages = document.getElementById('poc-pages');
    if (!pocPages) return;

    document.getElementById('poc-page-nav')?.remove();
    document.body.appendChild(pocPages);
    document.getElementById('doc-zoom-viewport')?.remove();

    pocPages.style.gap = '0';
    pocPages.style.margin = '0';
    pocPages.style.padding = '0';

    const pages = pocPages.querySelectorAll('.a4-page');
    pages.forEach((page, index) => {
      page.style.margin = '0';
      page.style.boxShadow = 'none';
      page.style.border = 'none';
      page.style.height = '297mm';
      page.style.maxHeight = '297mm';
      page.style.pageBreakAfter = index < pages.length - 1 ? 'always' : 'avoid';
      page.style.breakAfter = index < pages.length - 1 ? 'page' : 'avoid';
    });

    document.body.style.display = 'block';
    document.body.style.width = '210mm';
    document.body.style.minHeight = '0';
    document.body.style.height = 'auto';
    document.body.style.maxHeight = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.padding = '0';
    document.body.style.margin = '0';
    document.body.style.background = '#fff';
  }

  /** Final DOM cleanup before Electron printToPDF (keeps vector/searchable text). */
  function prepForPrint() {
    const html = document.documentElement;
    html.style.height = 'auto';
    html.style.overflow = 'visible';
    html.style.background = '#fff';

    document.body.classList.add('is-pdf-export', 'pdf-export');

    document.querySelectorAll('.side-panel, .confirm-backdrop').forEach((el) => el.remove());

    flattenPortOfCallDom();

    ['doc-zoom-stage', 'doc-zoom-viewport', 'doc-zoom-pad', 'doc-zoom-slot'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.transform = 'none';
      el.style.zoom = '1';
      el.style.margin = '0';
    });

    document.querySelectorAll(PAGE_SELECTORS).forEach((el) => {
      el.style.contain = 'none';
      el.style.isolation = 'auto';
      el.style.transform = 'none';
      el.style.filter = 'none';
    });

    document.querySelectorAll('div.ci, div.fi').forEach((el) => {
      const display = el.style.display || window.getComputedStyle(el).display;
      if (display !== 'flex') return;
      const ta =
        el.dataset.align ||
        el.style.textAlign ||
        window.getComputedStyle(el).textAlign ||
        'left';
      el.style.display = 'block';
      el.style.width = el.style.width || '100%';
      el.style.setProperty('text-align', ta === 'start' ? 'left' : ta === 'end' ? 'right' : ta, 'important');
      el.style.alignItems = '';
      el.style.justifyContent = '';
      el.style.whiteSpace = el.style.whiteSpace || 'nowrap';
      el.style.overflow = el.style.overflow || 'hidden';
    });

    if (document.querySelector('#ced-grid input.ci, #ced-crew input.ci')) {
      if (window.CrewEffectFormCells?.flattenInputsForExport) {
        window.CrewEffectFormCells.flattenInputsForExport();
      } else if (window.CrewEffectFormCellsV2?.flattenInputsForExport) {
        window.CrewEffectFormCellsV2.flattenInputsForExport();
      }
    }
  }

  function countPdfPages() {
    const n = document.querySelectorAll(
      '.a4-page, .a4-landscape-page, .ssd-sheet, .ced-sheet, .nil-page',
    ).length;
    return Math.max(n, 1);
  }

  window.CrewHtmlFormPdfSnapshot = { read, KEY, PARAM, prepForPrint, countPdfPages };
})();

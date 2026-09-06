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

  const OVERLAY_IDS = ['stamp-container', 'sig-container'];
  const FLOW_ANCHOR_SELECTORS = [
    '.form-footer',
    '.doc-footer',
    '.ced-footer',
    '.ssd-footer',
    '.nil-footer',
  ];

  function flowAnchor(root) {
    const scope = root || document;
    for (const sel of FLOW_ANCHOR_SELECTORS) {
      const el = scope.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function overlayEl(scope, id) {
    return scope.getElementById ? scope.getElementById(id) : document.getElementById(id);
  }

  /**
   * Move overlay onto the footer and set left/top in footer's local coords.
   * printToPDF often shrinks table/footer flow while markers on `.main-content`
   * keep their old absolute Y — parenting to the footer keeps HTML ≡ PDF.
   * No extra mm nudges — coordinates come only from the live HTML layout.
   */
  function setOverlayOnFooter(el, footer, dx, dy) {
    if (!el || !footer) return;
    const cs = window.getComputedStyle(footer);
    if (cs.position === 'static') {
      footer.style.position = 'relative';
    }
    if (el.parentElement !== footer) {
      footer.appendChild(el);
    }
    el.style.left = `${Math.round(dx)}px`;
    el.style.top = `${Math.round(dy)}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  /**
   * Remember stamp/signature offset from the signature footer BEFORE PDF layout
   * mutations. Uses getBoundingClientRect so zoom/transform do not skew dy.
   */
  function pinOverlaysToFlowAnchor(root) {
    const scope = root || document;
    const anchor = flowAnchor(scope);
    if (!anchor) return;
    const anchorR = anchor.getBoundingClientRect();
    OVERLAY_IDS.forEach((id) => {
      const el = overlayEl(scope, id);
      if (!el || !el.classList.contains('visible')) return;
      const elR = el.getBoundingClientRect();
      el.dataset.pdfAnchorDx = String(elR.left - anchorR.left);
      el.dataset.pdfAnchorDy = String(elR.top - anchorR.top);
      el.dataset.pdfAnchorW = el.style.width || `${el.offsetWidth}px`;
      el.dataset.pdfAnchorH = el.style.height || `${el.offsetHeight}px`;
    });
  }

  /**
   * Re-parent stamp/sig onto the footer using the exact HTML offsets (no clamp/nudge).
   */
  function applyPinnedOverlays(root) {
    const scope = root || document;
    const anchor = flowAnchor(scope);
    if (!anchor) return;

    OVERLAY_IDS.forEach((id) => {
      const el = overlayEl(scope, id);
      if (!el || !el.classList.contains('visible')) return;

      const elR = el.getBoundingClientRect();
      const anchorR = anchor.getBoundingClientRect();
      let dx = elR.left - anchorR.left;
      let dy = elR.top - anchorR.top;

      if (el.dataset.pdfAnchorDx != null && el.dataset.pdfAnchorDy != null) {
        const pdx = Number(el.dataset.pdfAnchorDx);
        const pdy = Number(el.dataset.pdfAnchorDy);
        if (Number.isFinite(pdx) && Number.isFinite(pdy)) {
          dx = pdx;
          dy = pdy;
        }
      }

      if (el.dataset.pdfAnchorW) el.style.width = el.dataset.pdfAnchorW;
      if (el.dataset.pdfAnchorH) el.style.height = el.dataset.pdfAnchorH;
      setOverlayOnFooter(el, anchor, dx, dy);
    });
  }

  /** Public alias — call after any late PDF layout pass. */
  function pullOverlaysToFooter(root) {
    applyPinnedOverlays(root);
  }

  /** Pin → mutate → restore exact HTML footer-relative positions. */
  function withPinnedOverlays(fn, root) {
    pinOverlaysToFlowAnchor(root);
    try {
      if (typeof fn === 'function') fn();
    } finally {
      applyPinnedOverlays(root);
    }
  }

  /** Zero @page margins so Chromium does not scale the fixed A4 sheet down (squash). */
  function injectPdfPageCss() {
    if (document.getElementById('crew-html-form-pdf-page-css')) return;
    const style = document.createElement('style');
    style.id = 'crew-html-form-pdf-page-css';
    style.textContent = `
      @page { margin: 0 !important; }
      @media print {
        @page { margin: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /** Final DOM cleanup before Electron printToPDF (keeps vector/searchable text). */
  function prepForPrint() {
    const html = document.documentElement;
    html.style.height = 'auto';
    html.style.overflow = 'visible';
    html.style.background = '#fff';

    document.body.classList.add('is-pdf-export', 'pdf-export');
    injectPdfPageCss();

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
      const cs = window.getComputedStyle(el);
      const display = el.style.display || cs.display;
      if (display !== 'flex') return;
      // Flex cells often center via justify-content only (e.g. .ci-rno). printToPDF
      // needs text-align on block boxes — map justify-content when text-align is default.
      const jc = (el.style.justifyContent || cs.justifyContent || '').toLowerCase();
      let ta =
        el.dataset.align ||
        el.style.textAlign ||
        '';
      if (!ta || ta === 'start') {
        if (jc === 'center') ta = 'center';
        else if (jc === 'flex-end' || jc === 'end' || jc === 'right') ta = 'right';
        else if (jc === 'flex-start' || jc === 'left') ta = 'left';
        else ta = cs.textAlign || 'left';
      }
      if (ta === 'start') ta = 'left';
      if (ta === 'end') ta = 'right';
      el.style.display = 'block';
      el.style.width = el.style.width || '100%';
      el.style.setProperty('text-align', ta, 'important');
      el.style.alignItems = '';
      el.style.justifyContent = '';

      // Never force nowrap onto cells that soft-wrap in the HTML editor
      // (birth place, textareas, Alt+Enter) — that was clipping PDF vs HTML.
      const ws = (el.style.whiteSpace || cs.whiteSpace || '').toLowerCase();
      const allowWrap =
        el.classList.contains('ci-birth-place') ||
        el.classList.contains('ci-name') ||
        ws.includes('pre-wrap') ||
        ws.includes('pre-line') ||
        ws === 'pre' ||
        (el.textContent || '').includes('\n');
      if (allowWrap) {
        el.style.whiteSpace = ws.includes('pre') ? el.style.whiteSpace || 'pre-wrap' : 'pre-wrap';
        el.style.overflowWrap = 'break-word';
        el.style.wordBreak = 'normal';
        // Keep explicit row/min heights from flatten — height:auto re-shrinks the table
        // and leaves stamp/signature too low vs the HTML editor.
        if (!el.style.height && !el.closest('tr')?.style?.height) {
          el.style.height = 'auto';
        }
        el.style.overflow = 'hidden';
      } else {
        el.style.whiteSpace = el.style.whiteSpace || 'nowrap';
        el.style.overflow = el.style.overflow || 'hidden';
      }
    });

    if (document.querySelector('#ced-grid input.ci, #ced-crew input.ci')) {
      withPinnedOverlays(() => {
        if (window.CrewEffectFormCells?.flattenInputsForExport) {
          window.CrewEffectFormCells.flattenInputsForExport();
        } else if (window.CrewEffectFormCellsV2?.flattenInputsForExport) {
          window.CrewEffectFormCellsV2.flattenInputsForExport();
        }
      });
    }

    // Last step: pull stamp/sig to the signature footer (clamps page-bottom drift).
    pullOverlaysToFooter();
  }

  function countPdfPages() {
    const n = document.querySelectorAll(
      '.a4-page, .a4-landscape-page, .ssd-sheet, .ced-sheet, .nil-page',
    ).length;
    return Math.max(n, 1);
  }

  window.CrewHtmlFormPdfSnapshot = {
    read,
    KEY,
    PARAM,
    prepForPrint,
    countPdfPages,
    pinOverlaysToFlowAnchor,
    applyPinnedOverlays,
    pullOverlaysToFooter,
    withPinnedOverlays,
    injectPdfPageCss,
  };
})();

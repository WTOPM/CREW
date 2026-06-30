/**
 * doc-zoom-viewport wheel: default zoom; Ctrl + wheel vertical scroll.
 */
(function (global) {
  function isPdfExport() {
    const body = document.body;
    return body.classList.contains('is-pdf-export') || body.classList.contains('pdf-export');
  }

  function attach(viewport, options) {
    if (!viewport || viewport.dataset.crewEditorWheel === '1') return;
    const onZoomStep = options?.onZoomStep;
    if (typeof onZoomStep !== 'function') return;

    viewport.dataset.crewEditorWheel = '1';
    viewport.addEventListener(
      'wheel',
      (e) => {
        if (isPdfExport()) return;
        if (e.ctrlKey) {
          e.preventDefault();
          viewport.scrollTop += e.deltaY;
          return;
        }
        e.preventDefault();
        onZoomStep(e.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
  }

  global.CrewHtmlFormEditorWheel = { attach, isPdfExport };
})(typeof window !== 'undefined' ? window : globalThis);

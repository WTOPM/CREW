/**
 * Form 02 - Ship Stores Long — HTML editor + PDF renderer.
 */
(function () {
  const SS = window.CrewShipStoresPdf;
  const OVERLAY_KEY = 'shipStores02';
  const FEEDBACK_PARAM = 'ssForm02Feedback';
  const editor = window.ShipStoresFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);

  async function loadSnapshot(withOverlay) {
    const fromSession = window.CrewHtmlFormPdfSnapshot?.read?.();
    if (fromSession?.variant) return fromSession;

    const appData = await editor.readPersistedAppData();
    if (!appData) return null;
    return SS.snapshotFromAppData(appData, '02', !!withOverlay);
  }

  async function initEditor() {
    const appData = await editor.readPersistedAppData();
    const snapshot = await loadSnapshot(false);
    if (!snapshot) {
      alert('Cannot load application data.');
      return;
    }
    window._appData = appData || { documentOverlay: snapshot.documentOverlay };
    editor.loadPositions();
    try {
      await SS.renderPage(snapshot);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to render Ship Stores form');
      return;
    }
    editor.initOverlayToolbar();
    await editor.restoreOverlaySettings();
    editor.initEditorZoom();
  }

  async function initPdfExport() {
    const snapshot = await loadSnapshot(true);
    if (!snapshot) {
      window.__pdfReady = true;
      return;
    }
    editor.resetEditorZoomForExport();
    document.body.classList.add('pdf-export');
    await SS.renderPage(snapshot);
    SS.finishPdfExport();
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('pdfExport') === '1') {
    void initPdfExport();
  } else {
    void initEditor();
  }
})();

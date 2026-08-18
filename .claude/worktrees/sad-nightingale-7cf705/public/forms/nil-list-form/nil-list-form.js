/**
 * NIL List — HTML editor + PDF export (?pdfExport=1).
 */
(function (global) {
  const OVERLAY_KEY = 'nilList';
  const FEEDBACK_PARAM = 'nilListFeedback';
  const editor = global.NilListFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function upper(value) {
    return String(value || '').trim().toUpperCase();
  }

  function formatDisplayDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
  }

  function portCountry(portName, ports) {
    if (!portName || !Array.isArray(ports)) return '';
    const needle = String(portName).trim().toLowerCase();
    const found = ports.find((p) => p.name && String(p.name).trim().toLowerCase() === needle);
    return found?.country ? String(found.country).trim().toUpperCase() : '';
  }

  function formatPortCallPortName(portName, ports) {
    const name = upper(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name}, ${country}` : name;
  }

  function activeCrewArrival(appData) {
    return (appData.crew || []).filter((c) => !c.archived && c.onArrivalList !== false);
  }

  function findMaster(crew) {
    const exact = crew.find((c) => String(c.rank || '').trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((c) => String(c.rank || '').trim().toLowerCase().includes('master'));
  }

  function formatMasterName(member) {
    if (!member) return '';
    if (global.CrewNameFormat?.formatCrewListName) {
      return global.CrewNameFormat.formatCrewListName(member, { upper: true });
    }
    const parts = [member.familyName, member.givenNames].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  function renderPhrases(container, phrases) {
    if (!container) return;
    container.innerHTML = '';
    const list = Array.isArray(phrases) ? phrases : [];
    for (const phrase of list) {
      if (!phrase || phrase.enabled === false || !String(phrase.text || '').trim()) continue;
      const line = document.createElement('p');
      line.className = 'nil-phrase';
      line.textContent = upper(phrase.text);
      container.appendChild(line);
    }
  }

  function applyFormFromAppData(appData) {
    if (!appData?.ship) return;
    const ship = appData.ship;
    const ports = appData.ports || [];
    const phrases = appData.nilListForm?.phrases || [];
    const master = findMaster(activeCrewArrival(appData));

    setText('vessel', upper(ship.name));
    setText('portOfRegistry', formatPortCallPortName(ship.homeport, ports));
    setText('port', formatPortCallPortName(ship.portOfCall, ports));
    setText('date', formatDisplayDate(ship.dateOfArrival));
    setText('masterName', formatMasterName(master));
    renderPhrases(document.getElementById('phrases'), phrases);
  }

  async function initPdfExport() {
    document.body.classList.add('pdf-export');
    editor.resetEditorZoomForExport();

    const snapshot = global.CrewHtmlFormPdfSnapshot?.read();
    if (!snapshot?.form) {
      global.CrewHtmlFormPdfSnapshot?.prepForPrint?.();
      global.__pdfReady = true;
      return;
    }

    const form = snapshot.form;
    setText('vessel', upper(form.vessel));
    setText('portOfRegistry', upper(form.portOfRegistry));
    setText('port', upper(form.port));
    setText('date', form.date || '');
    setText('masterName', upper(form.masterName));
    renderPhrases(document.getElementById('phrases'), form.phrases);

    const page = document.getElementById('nil-page');
    const pdfCommon = global.CrewShipStoresPdf;
    if (page && snapshot.withOverlay && pdfCommon?.renderOverlays) {
      await pdfCommon.renderOverlays(page, OVERLAY_KEY, snapshot);
    }

    global.CrewHtmlFormPdfSnapshot?.prepForPrint?.();
    global.__pdfReady = true;
  }

  async function initEditor() {
    const appData = await editor.readPersistedAppData();
    if (!appData) {
      console.warn('NIL List editor: no application data');
      return;
    }
    global._appData = appData;
    applyFormFromAppData(appData);
    editor.initOverlayToolbar();
    await editor.restoreOverlaySettings();
    editor.initEditorZoom();
  }

  async function boot() {
    const params = new URLSearchParams(global.location.search);
    if (params.get('pdfExport') === '1') {
      await initPdfExport();
      return;
    }
    await initEditor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void boot());
  } else {
    void boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);

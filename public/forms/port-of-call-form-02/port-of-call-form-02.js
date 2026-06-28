/**
 * Form 02 - PORTS OF CALL (Security) — HTML editor + PDF renderer.
 */
(function () {
  const POC = window.CrewPortOfCallPdf;
  const OVERLAY_KEY = 'portsOfCall';
  const FEEDBACK_PARAM = 'pocForm02Feedback';
  const editor = window.PortOfCallFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);

  function escAttr(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function ci(value, key, extra) {
    return `<input class="ci ${extra || ''}" type="text" data-cell-key="${key}" value="${escAttr(value)}" readonly tabindex="-1" />`;
  }

  function hdrCell(label, value, key, colspan) {
    const span = colspan ? ` colspan="${colspan}"` : '';
    return `<td class="poc02-hdr"${span}><div class="poc02-hdr-inner"><span class="poc02-hdr-lbl">${label}</span><div class="poc02-hdr-val">${ci(value, key, 'ci-hdr')}</div></div></td>`;
  }

  function thHeadCell(text, key) {
    return `<td><div class="ci ci-th" data-cell-key="${key}" tabindex="-1">${text}</div></td>`;
  }

  const SIGNATURE_LABEL = '15. Date and signature by master, authorised agent or officer';

  function portCountryCell(entry, ports) {
    if (!entry) return '';
    const port = POC.formatPortName(entry.portName);
    const country =
      String(entry.country || '').trim().toUpperCase() || POC.portCountry(entry.portName, ports);
    if (port && country) return `${port} / ${country}`;
    return port || country;
  }

  function resolveRowsPerPage(snapshot) {
    const max = window.PortOfCallFormRows?.MAX_ROWS ?? POC.MAX_ROWS ?? 23;
    let n;
    if (typeof snapshot?.rowsPerPage === 'number') n = snapshot.rowsPerPage;
    else {
      const fromOverlay = snapshot?.documentOverlay?.[OVERLAY_KEY]?.rowsPerPage;
      n = typeof fromOverlay === 'number' ? fromOverlay : POC.ROWS_PER_PAGE;
    }
    return Math.min(max, Math.max(1, Math.round(n)));
  }

  function dataRowCellsHtml(entry, rowIndex, ports) {
    const p = `d-${rowIndex}-`;
    let html = '';
    html += `<td>${ci(entry ? portCountryCell(entry, ports) : '', `${p}0`)}</td>`;
    html += `<td>${ci(entry ? POC.portCode(entry.portName, ports) : '', `${p}1`)}</td>`;
    html += `<td>${ci(entry ? POC.formatDisplayDate(entry.arrivalDate) : '', `${p}2`)}</td>`;
    html += `<td>${ci(entry ? POC.formatDisplayDate(entry.departureDate) : '', `${p}3`)}</td>`;
    html += `<td>${ci(entry ? POC.normalizeSecLvl(entry.secLvl) : '', `${p}4`)}</td>`;
    return html;
  }

  function dataRowsHtml(rows, ports, rowCount) {
    let html = '';
    for (let i = 0; i < rowCount; i++) {
      html += `<tr class="poc02-data-row">${dataRowCellsHtml(rows[i], i, ports)}</tr>`;
    }
    return html;
  }

  function masterDisplayName(snapshot) {
    const master = POC.findMaster(snapshot.crew);
    if (!master) return '';
    if (window.CrewNameFormat) {
      return window.CrewNameFormat.formatCrewListName(master, { upper: true });
    }
    return POC.formatCaptainName(master);
  }

  function footerSignatureDate(snapshot, overlayVariant) {
    const saved = overlayVariant?.footerSignatureDate;
    if (saved) return saved;
    return POC.formatDisplayDate(snapshot.ship?.dateOfArrival);
  }

  function footerHtml(snapshot, overlayVariant, pageIndex) {
    const date = escAttr(footerSignatureDate(snapshot, overlayVariant));
    const master = escAttr(masterDisplayName(snapshot));
    const dateId = pageIndex === 0 ? ' id="poc-footer-date"' : '';
    return `
        <div class="poc-form-footer">
          <p class="poc-foot-note">${SIGNATURE_LABEL}</p>
          <div class="poc-form-footer__sig-row">
            <div class="poc-form-footer__pad" aria-hidden="true"></div>
            <input type="text"${dateId} class="fi poc-form-footer__date" value="${date}" readonly tabindex="-1" />
            <div class="poc-form-footer__sig-rest">
              <div class="poc-sig-block">
                <span class="poc-sig-lbl">Master</span>
                <div class="fi poc-form-footer__master">${master}</div>
              </div>
            </div>
          </div>
        </div>`;
  }

  function renderPage(pageRows, pageIndex, snapshot, includeOverlays, rowCount, overlayVariant) {
    const ship = snapshot.ship || {};
    const ports = snapshot.ports || [];
    const overlayHtml = includeOverlays
      ? '<div id="stamp-container" class="overlay-marker"></div><div id="sig-container" class="overlay-marker"></div>'
      : '';
    const gridId = pageIndex === 0 ? ' id="poc-grid"' : '';

    return `
      <div class="a4-page poc-form-02" data-page="${pageIndex}">
        ${overlayHtml}
        <h1 class="poc02-title">PORTS OF CALL</h1>
        <table class="poc02-grid"${gridId}>
          <colgroup>
            <col class="poc02-col-a" /><col class="poc02-col-b" />
            <col class="poc02-col-c" /><col class="poc02-col-d" /><col class="poc02-col-e" />
          </colgroup>
          <tr class="poc-editable-row">
            ${hdrCell('Name of ship:', ship.name, 'h-0-0')}
            ${hdrCell('IMO Number', ship.imoNo, 'h-0-1')}
            ${hdrCell('Port of arrival:', POC.formatPortWithCountry(ship.portOfCall, ports), 'h-0-2')}
            ${hdrCell('Date of Arrival:', POC.formatDisplayDate(ship.dateOfArrival), 'h-0-3', 2)}
          </tr>
          <tr class="poc-editable-row">
            ${hdrCell('Nationality of ship:', POC.formatPortName(ship.nationality), 'h-1-0')}
            ${hdrCell('Port arrived from:', POC.formatPortWithCountry(ship.lastPortOfCall, ports), 'h-1-1', 2)}
            ${hdrCell('Next port:', POC.formatPortWithCountry(ship.nextPortOfCall, ports), 'h-1-2', 2)}
          </tr>
          <tr class="poc02-head-row poc-th-row">
            ${thHeadCell('NAME OF PORT &amp; COUNTRY', 't-0')}
            ${thHeadCell('LOCODE', 't-1')}
            ${thHeadCell('Date of Arrival', 't-2')}
            ${thHeadCell('Date of Departure', 't-3')}
            ${thHeadCell('SEC. LVL.', 't-4')}
          </tr>
          <tbody id="poc-tbody">${dataRowsHtml(pageRows, ports, rowCount)}</tbody>
        </table>
        ${footerHtml(snapshot, overlayVariant, pageIndex)}
      </div>`;
  }

  function renderAll(snapshot, editorMode) {
    const rowsPerPage = resolveRowsPerPage(snapshot);
    const pages = Array.isArray(snapshot.pages) && snapshot.pages.length ? snapshot.pages : [[]];
    const overlayVariant =
      snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY] || {};
    const mount = document.getElementById('poc-pages');
    if (!mount) return;

    if (!editorMode) {
      mount.className = 'poc-pages';
      mount.innerHTML = pages
        .map((pageRows, i) =>
          renderPage(pageRows, i, snapshot, false, rowsPerPage, overlayVariant),
        )
        .join('');
      window.PortOfCallFormPages?.setTotal?.(pages.length);
      return;
    }

    window.PortOfCallFormPages?.setTotal?.(pages.length);
    const pageIndex = window.PortOfCallFormPages?.getCurrent?.() ?? 0;

    mount.className = pages.length === 1 ? 'poc-pages poc-pages--single' : 'poc-pages';
    mount.innerHTML = renderPage(
      pages[pageIndex] || [],
      pageIndex,
      snapshot,
      pageIndex === 0,
      rowsPerPage,
      overlayVariant,
    );
    window.PortOfCallFormPages?.syncRowToolbar?.();
  }

  function afterEditorPageChange(overlayVariant) {
    const snapshot = window._pocEditorSnapshot;
    if (!snapshot) return;
    renderAll(snapshot, true);
    initCellEditor(overlayVariant || snapshot.documentOverlay?.[OVERLAY_KEY] || {});
    void editor.restoreOverlaySettings();
    window.PortOfCallFormPages?.syncRowToolbar?.();
    window.PortOfCallFormCells?.dismissSelection?.();
    editor.applyEditorZoom();
    document.getElementById('doc-zoom-viewport')?.scrollTo(0, 0);
  }

  async function refreshEditorLayout(overlayVariant) {
    const snapshot = window._pocEditorSnapshot;
    if (!snapshot) return;
    const count = window.PortOfCallFormRows.getRowsPerPage();
    snapshot.rowsPerPage = count;
    if (window._appData) {
      snapshot.pages = POC.buildPagesFromData(window._appData, OVERLAY_KEY, count);
    }
    renderAll(snapshot, true);
    initCellEditor(overlayVariant || snapshot.documentOverlay?.[OVERLAY_KEY] || {});
    await editor.restoreOverlaySettings();
    window.PortOfCallFormRows?.syncToolbarButtons?.();
    window.PortOfCallFormPages?.syncRowToolbar?.();
  }

  function initRowEditor(overlayVariant, snapshot) {
    const ports = snapshot.ports || [];
    const targetRows =
      overlayVariant?.rowsPerPage ?? snapshot?.rowsPerPage ?? window.PortOfCallFormRows.DEFAULT_ROWS;
    window.PortOfCallFormRows.init({
      rowSelector: 'tr.poc02-data-row',
      appendEmptyRow(rowIndex) {
        const tbody = document.getElementById('poc-tbody');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'poc02-data-row';
        tr.innerHTML = dataRowCellsHtml(null, rowIndex, ports);
        tbody.appendChild(tr);
      },
      onChange() {
        void refreshEditorLayout(overlayVariant);
      },
    });
    window.PortOfCallFormRows.ensureRowCount(targetRows, true);
    editor.connectRowsEditor({ getCount: () => window.PortOfCallFormRows.getRowsPerPage() });
    editor.initSavedRowsBaseline();
  }

  function initCellEditor(overlayVariant) {
    const table = document.getElementById('poc-grid');
    if (!table) return;
    window.PortOfCallFormCells.init(table);
    window.PortOfCallFormCells.restoreCellStyles(overlayVariant?.cellStyles || {});
    window.PortOfCallFormCells.captureDirtyBaseline();
    editor.connectCellEditor({ collect: () => window.PortOfCallFormCells.collectCellStyles() });
  }

  async function bootstrap() {
    const params = new URLSearchParams(location.search);
    const isPdfExport = params.get('pdfExport') === '1';

    let snapshot = window.CrewHtmlFormPdfSnapshot?.read() || null;
    if (!snapshot && !isPdfExport) {
      const appData = await editor.readPersistedAppData();
      if (appData) {
        window._appData = appData;
        snapshot = POC.snapshotFromAppData(appData, true, OVERLAY_KEY);
      }
    } else if (snapshot) {
      window._appData = snapshot;
    }

    if (!snapshot) {
      document.getElementById('poc-pages').innerHTML =
        '<p style="padding:2rem">No data — open from CREW Documents → Port Settings → Settings.</p>';
      window.__pdfReady = true;
      return;
    }

    window._pocEditorSnapshot = snapshot;

    const overlayVariant = snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY];

    if (!isPdfExport) {
      window.PortOfCallFormPages.init({
        onPageChange() {
          afterEditorPageChange(overlayVariant);
        },
      });
    }

    renderAll(snapshot, !isPdfExport);

    if (isPdfExport) {
      document.body.classList.add('is-pdf-export');
      window.PortOfCallFormCells.restoreAllCellStyles(overlayVariant?.cellStyles || {});
      const pageEls = document.querySelectorAll('.a4-page');
      for (let i = 0; i < pageEls.length; i++) {
        await POC.renderOverlays(pageEls[i], OVERLAY_KEY, snapshot);
      }
      window.PortOfCallFormCells.flattenAllInputsForExport();
      editor.resetEditorZoomForExport();
      document.querySelectorAll('.side-panel').forEach((el) => el.remove());
      POC.finishPdfExport();
      return;
    }

    initRowEditor(overlayVariant, snapshot);
    initCellEditor(overlayVariant);
    await editor.restoreOverlaySettings();
    editor.initOverlayToolbar();
    editor.initEditorZoom();
    window.__pdfReady = true;
  }

  bootstrap().catch((err) => {
    console.error(err);
    window.__pdfReady = true;
  });
})();

/**
 * Form 01 - Port of Call List — HTML editor + PDF renderer.
 */
(function () {
  const POC = window.CrewPortOfCallPdf;
  const OVERLAY_KEY = 'portOfCall';
  const FEEDBACK_PARAM = 'pocForm01Feedback';
  const editor = window.PortOfCallFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);

  const LABELS = {
    shipName: '1.Name of Ship',
    callSign: 'Call Sign',
    portOfArrival: '2.Port of Arrival',
    dateOfArrival: '3.Date of Arrival',
    nationality: '4.Nationality of Ship',
    homeport: '5. Homeport',
    arrivedFrom: '6.Port arrived from',
    sailingTo: '7.Sailing to',
    lastPort: '9. Last Port of Call',
    country: '10. Country',
    arrDate: '11.Date of Arrival',
    arrTime: '12. Time of arrival',
    arrTimeSub: 'Local Time',
    depDate: '13.Date of Departure',
    depTime: '14. Time of Departure',
    depTimeSub: 'Local Time',
    signature: '15. Date and signature by master, authorised agent or officer',
  };

  function escAttr(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function ci(value, key, extra, dateIso) {
    const ia = dateIso && window.HtmlFormDateFormat ? window.HtmlFormDateFormat.isoAttr(dateIso) : '';
    return `<input class="ci ${extra || ''}" type="text" data-cell-key="${key}"${ia} value="${escAttr(value)}" readonly tabindex="-1" />`;
  }

  function ciDate(iso, key, extra) {
    const F = window.HtmlFormDateFormat;
    const val = F ? F.format(iso, F.getActive()) : POC.formatDisplayDate(iso);
    return ci(val, key, extra, iso);
  }

  function hdrCell(label, value, short, key) {
    const cls = short ? 'hdr-cell hdr-cell--short' : 'hdr-cell';
    return `<td class="${cls}"><span class="hdr-lbl">${label}</span><div class="poc-hdr-val">${ci(value, key, 'ci-hdr')}</div></td>`;
  }

  function hdrMerged(label, value, colspan, short, key) {
    const cls = short ? 'hdr-cell hdr-cell--short' : 'hdr-cell';
    return `<td class="${cls}" colspan="${colspan}"><span class="hdr-lbl">${label}</span><div class="poc-hdr-val">${ci(value, key, 'ci-hdr')}</div></td>`;
  }

  function hdrMergedDate(label, iso, colspan, short, key) {
    const cls = short ? 'hdr-cell hdr-cell--short' : 'hdr-cell';
    const inner = iso ? ciDate(iso, key, 'ci-hdr') : ci('', key, 'ci-hdr');
    return `<td class="${cls}" colspan="${colspan}"><span class="hdr-lbl">${label}</span><div class="poc-hdr-val">${inner}</div></td>`;
  }

  function thCell(html, key, cls, rowspan) {
    const rs = rowspan ? ` rowspan="${rowspan}"` : '';
    return `<td class="${cls}"${rs}><div class="ci ci-th" data-cell-key="${key}" tabindex="-1">${html}</div></td>`;
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

  function dataRowCellsHtml(entry, rowIndex, voyOffset) {
    const p = `d-${rowIndex}-`;
    let html = '';
    html += `<td><div class="poc-data-val">${ci(entry ? voyOffset + rowIndex + 1 : '', `${p}0`, 'ci-rno')}</div></td>`;
    html += `<td><div class="poc-data-val">${ci(entry ? POC.formatPortName(entry.portName) : '', `${p}1`)}</div></td>`;
    html += `<td><div class="poc-data-val">${ci(entry ? entry.country : '', `${p}2`)}</div></td>`;
    html += `<td><div class="poc-data-val">${entry ? ciDate(entry.arrivalDate, `${p}3`) : ci('', `${p}3`)}</div></td>`;
    html += `<td><div class="poc-data-val">${ci(entry ? entry.arrivalTime : '', `${p}4`)}</div></td>`;
    html += `<td><div class="poc-data-val">${entry ? ciDate(entry.departureDate, `${p}5`) : ci('', `${p}5`)}</div></td>`;
    html += `<td><div class="poc-data-val">${ci(entry ? entry.departureTime : '', `${p}6`)}</div></td>`;
    return html;
  }

  function dataRowsHtml(rows, voyOffset, rowCount) {
    let html = '';
    for (let i = 0; i < rowCount; i++) {
      html += `<tr class="data-row">${dataRowCellsHtml(rows[i], i, voyOffset)}</tr>`;
    }
    return html;
  }

  function refreshVoyageNumbers(voyOffset) {
    const tbody = document.getElementById('poc-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.data-row').forEach((tr, i) => {
      const rno = tr.querySelector('.ci-rno');
      if (!rno) return;
      const portCell = tr.querySelector('input[data-cell-key$="-1"]');
      const hasData = portCell && portCell.value.trim();
      rno.value = hasData ? String(voyOffset + i + 1) : '';
    });
  }

  function masterDisplayName(snapshot) {
    const master = POC.findMaster(snapshot.crew);
    if (!master) return '';
    if (window.CrewNameFormat) {
      return window.CrewNameFormat.formatCrewListName(master, { upper: true });
    }
    return POC.formatCaptainName(master);
  }

  function footerMasterName(snapshot, overlayVariant) {
    const saved =
      overlayVariant?.footerMasterName ||
      overlayVariant?.cellValues?.['footer-master'];
    if (saved) return saved;
    return masterDisplayName(snapshot);
  }

  function footerDateDisplay(snapshot, overlayVariant) {
    const saved = overlayVariant?.footerSignatureDate;
    if (saved) return saved;
    const F = window.HtmlFormDateFormat;
    const iso = snapshot.ship?.dateOfArrival;
    return F ? F.format(iso, F.getActive()) : POC.formatDisplayDate(iso);
  }

  function footerDateIso(snapshot, overlayVariant) {
    const saved = overlayVariant?.footerSignatureDate;
    if (saved && window.HtmlFormDateFormat) {
      const parsed = window.HtmlFormDateFormat.parseToIso(saved);
      if (parsed) return parsed;
    }
    return snapshot.ship?.dateOfArrival || '';
  }

  function footerHtml(snapshot, overlayVariant, pageIndex) {
    const dateIso = footerDateIso(snapshot, overlayVariant);
    const date = escAttr(footerDateDisplay(snapshot, overlayVariant));
    const master = escAttr(footerMasterName(snapshot, overlayVariant));
    const isoAttr = window.HtmlFormDateFormat?.isoAttr(dateIso) || '';
    const dateId = pageIndex === 0 ? ' id="poc-footer-date"' : '';
    const masterId = pageIndex === 0 ? ' id="poc-footer-master"' : '';
    return `
        <div class="poc-form-footer">
          <p class="poc-foot-note">${LABELS.signature}</p>
          <div class="poc-form-footer__sig-row">
            <div class="poc-form-footer__pad" aria-hidden="true"></div>
            <div${dateId} class="fi poc-form-footer__date" data-cell-key="footer-date"${isoAttr}
              style="font-size:8pt;font-weight:700;text-align:left;padding:0 1mm;" aria-readonly="true">${date}</div>
            <div class="poc-form-footer__sig-rest">
              <div class="poc-sig-block">
                <span class="poc-sig-lbl">Master</span>
                <div${masterId} class="fi poc-form-footer__master" data-cell-key="footer-master"
                  style="width:50mm;text-align:center;font-size:8pt;border-bottom:1px solid #000;" aria-readonly="true">${master}</div>
              </div>
            </div>
          </div>
        </div>`;
  }

  function renderPage(pageRows, voyOffset, pageIndex, snapshot, includeOverlays, rowCount, overlayVariant) {
    const ship = snapshot.ship || {};
    const overlayHtml = includeOverlays
      ? '<div id="stamp-container" class="overlay-marker"></div><div id="sig-container" class="overlay-marker"></div>'
      : '';
    const gridId = pageIndex === 0 ? ' id="poc-grid"' : '';
    return `
      <div class="a4-page poc-form-01" data-page="${pageIndex}">
        ${overlayHtml}
        <h1 class="poc-title">Port of Call List</h1>
        <table class="poc-grid"${gridId}>
          <colgroup>
            <col class="col-voy" /><col class="col-port" /><col class="col-country" />
            <col class="col-arr-date" /><col class="col-arr-time" />
            <col class="col-dep-date" /><col class="col-dep-time" />
          </colgroup>
          <tr class="poc-editable-row">
            ${hdrMerged(LABELS.shipName, ship.name, 2, false, 'h-0-0')}
            ${hdrCell(LABELS.callSign, ship.callSign, false, 'h-0-1')}
            ${hdrMerged(LABELS.portOfArrival, ship.portOfCall, 2, false, 'h-0-2')}
            ${hdrMergedDate(LABELS.dateOfArrival, ship.dateOfArrival, 2, false, 'h-0-3')}
          </tr>
          <tr class="poc-editable-row">
            ${hdrMerged(LABELS.nationality, ship.nationality, 2, true, 'h-1-0')}
            ${hdrCell(LABELS.homeport, ship.homeport, true, 'h-1-1')}
            ${hdrMerged(LABELS.arrivedFrom, ship.lastPortOfCall, 2, true, 'h-1-2')}
            ${hdrMerged(LABELS.sailingTo, ship.nextPortOfCall, 2, true, 'h-1-3')}
          </tr>
          <tr class="th-band th-split-top poc-th-row">
            ${thCell('8.<br>Voy.<br>No.', 't-0', 'th-voy', 2)}
            ${thCell(LABELS.lastPort, 't-1', 'th-main', 2)}
            ${thCell(LABELS.country, 't-2', 'th-main', 2)}
            ${thCell(LABELS.arrDate, 't-3', 'th-main', 2)}
            ${thCell(LABELS.arrTime, 't-4', 'th-time-top')}
            ${thCell(LABELS.depDate, 't-5', 'th-main', 2)}
            ${thCell(LABELS.depTime, 't-6', 'th-time-top')}
          </tr>
          <tr class="th-band th-split-sub poc-th-row">
            ${thCell(LABELS.arrTimeSub, 't-4b', 'th-time-sub')}
            ${thCell(LABELS.depTimeSub, 't-6b', 'th-time-sub')}
          </tr>
          <tbody id="poc-tbody">${dataRowsHtml(pageRows, voyOffset, rowCount)}</tbody>
        </table>
        ${footerHtml(snapshot, overlayVariant, pageIndex)}
      </div>`;
  }

  function renderAll(snapshot, editorMode) {
    const rowsPerPage = resolveRowsPerPage(snapshot);
    const pages = Array.isArray(snapshot.pages) && snapshot.pages.length ? snapshot.pages : [[]];
    const overlayVariant =
      snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY] || {};
    if (window.HtmlFormDateFormat) {
      window.HtmlFormDateFormat.setActive(overlayVariant.dateDisplayFormat || 'dot');
    }
    const mount = document.getElementById('poc-pages');
    if (!mount) return;

    if (!editorMode) {
      mount.className = 'poc-pages';
      mount.innerHTML = pages
        .map((pageRows, i) =>
          renderPage(pageRows, i * rowsPerPage, i, snapshot, false, rowsPerPage, overlayVariant),
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
      pageIndex * rowsPerPage,
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

  function resetEditorPage() {
    const appData = window._appData;
    if (!appData || !POC.snapshotFromAppData) return;
    const fresh = POC.snapshotFromAppData(appData, false, OVERLAY_KEY);
    fresh.rowsPerPage = window.PortOfCallFormRows.DEFAULT_ROWS;
    fresh.pages = POC.buildPagesFromData(appData, OVERLAY_KEY, fresh.rowsPerPage);
    window._pocEditorSnapshot = fresh;
    window.PortOfCallFormPages?.goTo?.(0);
    renderAll(fresh, true);
    initRowEditor({}, fresh);
    initCellEditor({});
    if (window.HtmlFormDateFormat) {
      window.HtmlFormDateFormat.setActive('dot');
      const page = document.querySelector('.a4-page');
      if (page) window.HtmlFormDateFormat.applyToScope(page);
    }
    window.PortOfCallFormCells.resetAllCellStyles();
    window.PortOfCallFormCells.captureDirtyBaseline();
    window.PortOfCallFormRows?.syncToolbarButtons?.();
    window.PortOfCallFormPages?.syncRowToolbar?.();
  }

  function initCellEditor(overlayVariant) {
    const table = document.getElementById('poc-grid');
    if (!table) return;
    const snapshot = window._pocEditorSnapshot;
    const pageIndex = window.PortOfCallFormPages?.getCurrent?.() ?? 0;
    const rowsPerPage = resolveRowsPerPage(snapshot);
    const voyOffset = pageIndex * rowsPerPage;
    const saved = editor.loadPositions();
    const cellValues = overlayVariant?.cellValues || saved.cellValues || {};
    if (window.HtmlFormDateFormat) {
      window.HtmlFormDateFormat.setActive(overlayVariant?.dateDisplayFormat || saved.dateDisplayFormat || 'dot');
    }
    window.PortOfCallFormCells.init(table);
    if (window.HtmlFormFooterFields) {
      window.HtmlFormFooterFields.init(table.closest('.a4-page'));
    }
    window.PortOfCallFormCells.restoreCellValues(cellValues, table, voyOffset);
    window.PortOfCallFormCells.restoreCellStyles(overlayVariant?.cellStyles || saved.cellStyles || {});
    window.PortOfCallFormCells.captureDirtyBaseline();
    editor.connectCellEditor({
      collect: () => window.PortOfCallFormCells.collectCellStyles(),
      collectValues: (vo) => window.PortOfCallFormCells.collectCellValues(vo),
      resetPage: resetEditorPage,
    });
  }

  function initRowEditor(overlayVariant, snapshot) {
    const targetRows =
      overlayVariant?.rowsPerPage ?? snapshot?.rowsPerPage ?? window.PortOfCallFormRows.DEFAULT_ROWS;
    window.PortOfCallFormRows.init({
      rowSelector: 'tr.data-row',
      appendEmptyRow(rowIndex, voyOffset) {
        const tbody = document.getElementById('poc-tbody');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'data-row';
        tr.innerHTML = dataRowCellsHtml(null, rowIndex, voyOffset);
        tbody.appendChild(tr);
      },
      refreshRowNumbers: refreshVoyageNumbers,
      onChange() {
        void refreshEditorLayout(overlayVariant);
      },
    });
    window.PortOfCallFormRows.ensureRowCount(targetRows, true);
    editor.connectRowsEditor({ getCount: () => window.PortOfCallFormRows.getRowsPerPage() });
    editor.initSavedRowsBaseline();
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
      const rowsPerPage = resolveRowsPerPage(snapshot);
      window.PortOfCallFormCells.restoreAllCellValues(overlayVariant?.cellValues || {}, rowsPerPage);
      window.PortOfCallFormCells.restoreAllCellStyles(overlayVariant?.cellStyles || {});
      const pageEls = document.querySelectorAll('.a4-page');
      for (let i = 0; i < pageEls.length; i++) {
        await POC.renderOverlays(pageEls[i], OVERLAY_KEY, snapshot);
      }
      window.PortOfCallFormCells.reflowAllWrappedCells();
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

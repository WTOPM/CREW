(function () {
  const POC = window.CrewPortOfCallPdf;
  const OVERLAY_KEY = 'portOfCall';
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

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Label top-left + bold value centred — one cell (matches original PDF). */
  function hdrCell(label, value, short) {
    const cls = short ? 'hdr-cell hdr-cell--short' : 'hdr-cell';
    return `<td class="${cls}"><span class="hdr-lbl">${label}</span><span class="hdr-val">${esc(value)}</span></td>`;
  }

  function hdrMerged(label, value, colspan, short) {
    const cls = short ? 'hdr-cell hdr-cell--short' : 'hdr-cell';
    return `<td class="${cls}" colspan="${colspan}"><span class="hdr-lbl">${label}</span><span class="hdr-val">${esc(value)}</span></td>`;
  }

  function renderDataRows(rows, voyOffset) {
    let html = '';
    for (let i = 0; i < POC.ROWS_PER_PAGE; i++) {
      const entry = rows[i];
      html += '<tr class="data-row">';
      html += `<td>${entry ? esc(voyOffset + i + 1) : ''}</td>`;
      html += `<td class="col-port-data">${entry ? esc(POC.formatPortName(entry.portName)) : ''}</td>`;
      html += `<td class="col-country-data">${entry ? esc(entry.country) : ''}</td>`;
      html += `<td>${entry ? esc(POC.formatDisplayDate(entry.arrivalDate)) : ''}</td>`;
      html += `<td>${entry ? esc(entry.arrivalTime) : ''}</td>`;
      html += `<td>${entry ? esc(POC.formatDisplayDate(entry.departureDate)) : ''}</td>`;
      html += `<td>${entry ? esc(entry.departureTime) : ''}</td>`;
      html += '</tr>';
    }
    return html;
  }

  function renderPage(pageRows, voyOffset, pageIndex, snapshot) {
    const ship = snapshot.ship || {};
    return `
      <div class="a4-page poc-form-01" data-page="${pageIndex}">
        <h1 class="poc-title">Port of Call List</h1>
        <table class="poc-grid">
          <colgroup>
            <col class="col-voy" />
            <col class="col-port" />
            <col class="col-country" />
            <col class="col-arr-date" />
            <col class="col-arr-time" />
            <col class="col-dep-date" />
            <col class="col-dep-time" />
          </colgroup>
          <tr>
            ${hdrMerged(LABELS.shipName, ship.name, 2, false)}
            ${hdrCell(LABELS.callSign, ship.callSign, false)}
            ${hdrMerged(LABELS.portOfArrival, ship.portOfCall, 2, false)}
            ${hdrMerged(LABELS.dateOfArrival, POC.formatDisplayDate(ship.dateOfArrival), 2, false)}
          </tr>
          <tr>
            ${hdrMerged(LABELS.nationality, ship.nationality, 2, true)}
            ${hdrCell(LABELS.homeport, ship.homeport, true)}
            ${hdrMerged(LABELS.arrivedFrom, ship.lastPortOfCall, 2, true)}
            ${hdrMerged(LABELS.sailingTo, ship.nextPortOfCall, 2, true)}
          </tr>
          <tr class="th-band th-split-top">
            <td class="th-voy" rowspan="2">8.<br>Voy.<br>No.</td>
            <td class="th-main" rowspan="2">${LABELS.lastPort}</td>
            <td class="th-main" rowspan="2">${LABELS.country}</td>
            <td class="th-main" rowspan="2">${LABELS.arrDate}</td>
            <td class="th-time-top">${LABELS.arrTime}</td>
            <td class="th-main" rowspan="2">${LABELS.depDate}</td>
            <td class="th-time-top">${LABELS.depTime}</td>
          </tr>
          <tr class="th-band th-split-sub">
            <td class="th-time-sub">${LABELS.arrTimeSub}</td>
            <td class="th-time-sub">${LABELS.depTimeSub}</td>
          </tr>
          ${renderDataRows(pageRows, voyOffset)}
          <tr class="poc-signature-row">
            <td colspan="7">
              <span class="poc-signature-line"></span>
              ${LABELS.signature}
              <div class="poc-stamp"></div>
              <div class="poc-signature"></div>
            </td>
          </tr>
        </table>
      </div>`;
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const isPdfExport = params.get('pdfExport') === '1';
    const snapshot = window.CrewHtmlFormPdfSnapshot?.read() || null;
    if (!snapshot) {
      document.getElementById('poc-pages').innerHTML =
        '<p style="padding:2rem">No data — open from CREW Documents.</p>';
      return;
    }

    const pages = Array.isArray(snapshot.pages) && snapshot.pages.length ? snapshot.pages : [[]];
    const mount = document.getElementById('poc-pages');
    mount.innerHTML = pages
      .map((pageRows, i) => renderPage(pageRows, i * POC.ROWS_PER_PAGE, i, snapshot))
      .join('');

    const pageEls = mount.querySelectorAll('.a4-page');
    for (let i = 0; i < pageEls.length; i++) {
      await POC.renderOverlays(pageEls[i], OVERLAY_KEY, snapshot);
    }

    if (isPdfExport) {
      POC.finishPdfExport();
    }
  }

  init().catch((err) => {
    console.error(err);
    window.__pdfReady = true;
  });
})();

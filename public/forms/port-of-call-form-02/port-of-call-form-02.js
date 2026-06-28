(function () {
  const POC = window.CrewPortOfCallPdf;
  const OVERLAY_KEY = 'portsOfCall';

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDataRows(rows, ports) {
    let html = '';
    for (let i = 0; i < POC.ROWS_PER_PAGE; i++) {
      const entry = rows[i];
      const portName = entry ? POC.formatPortName(entry.portName) : '';
      const country = entry
        ? String(entry.country || '').trim().toUpperCase() || POC.portCountry(entry.portName, ports)
        : '';
      const code = entry ? POC.portCode(entry.portName, ports) : '';
      html += '<tr class="data">';
      html += `<td class="data-left">${esc(portName)}</td>`;
      html += `<td class="data-left">${esc(country)}</td>`;
      html += `<td class="data-center">${esc(code)}</td>`;
      html += `<td class="data-center">${entry ? esc(POC.formatDisplayDate(entry.arrivalDate)) : ''}</td>`;
      html += `<td class="data-center">${entry ? esc(POC.formatDisplayDate(entry.departureDate)) : ''}</td>`;
      html += `<td class="data-center">${entry ? esc(POC.normalizeSecLvl(entry.secLvl)) : ''}</td>`;
      html += '</tr>';
    }
    return html;
  }

  function renderPage(pageRows, pageIndex, snapshot) {
    const ship = snapshot.ship || {};
    const ports = snapshot.ports || [];
    const master = POC.findMaster(snapshot.crew);
    const captain = master ? POC.formatCaptainName(master) : '';
    const sigLabel = captain ? `Master / Captain: ${captain}` : 'Master / Captain';

    return `
      <div class="a4-page poc-form-02" data-page="${pageIndex}">
        <h1 class="poc-title">02 - Port of Call - Security</h1>
        <table class="poc-grid">
          <colgroup>
            <col class="col-port" /><col class="col-country" /><col class="col-code" />
            <col class="col-date" /><col class="col-date" /><col class="col-sec" />
          </colgroup>
          <tr class="outer-top">
            <td class="lbl">Name of ship</td>
            <td class="lbl">Nationality</td>
            <td class="lbl">IMO No.</td>
            <td class="lbl" colspan="2">Port of arrival</td>
            <td class="lbl">Date of arrival</td>
          </tr>
          <tr>
            <td class="val">${esc(ship.name)}</td>
            <td class="val">${esc(POC.formatPortName(ship.nationality))}</td>
            <td class="val">${esc(ship.imoNo)}</td>
            <td class="val" colspan="2">${esc(POC.formatPortWithCountry(ship.portOfCall, ports))}</td>
            <td class="val">${esc(POC.formatDisplayDate(ship.dateOfArrival))}</td>
          </tr>
          <tr>
            <td class="lbl">Arrived from</td>
            <td class="lbl" colspan="2">Next port</td>
            <td class="lbl" colspan="3"></td>
          </tr>
          <tr>
            <td class="val">${esc(POC.formatPortWithCountry(ship.lastPortOfCall, ports))}</td>
            <td class="val" colspan="2">${esc(POC.formatPortWithCountry(ship.nextPortOfCall, ports))}</td>
            <td class="val" colspan="3"></td>
          </tr>
          <tr class="thick-below">
            <td class="head">Port</td>
            <td class="head">Country</td>
            <td class="head">Code</td>
            <td class="head head-center">Arrival date</td>
            <td class="head head-center">Departure date</td>
            <td class="head head-center">SEC. LVL</td>
          </tr>
          ${renderDataRows(pageRows, ports)}
          <tr class="poc-signature-row">
            <td colspan="6">
              <span class="poc-signature-line"></span>
              ${esc(sigLabel)}
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
    mount.innerHTML = pages.map((pageRows, i) => renderPage(pageRows, i, snapshot)).join('');

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

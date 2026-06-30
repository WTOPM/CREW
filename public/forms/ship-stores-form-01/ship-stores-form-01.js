/**
 * Form 01 - Ship Stores Short — full HTML (IMO FAL Form 3) + PDF renderer.
 */
(function (global) {
  const ROW_COUNT = 27;
  const OVERLAY_KEY = 'shipStores';
  const FEEDBACK_PARAM = 'ssForm01Feedback';
  const editor = global.ShipStoresFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);
  const SS = global.CrewShipStoresPdf;

  const HDR_KEYS = {
    nameOfShip: 'h-nameOfShip',
    portOfArrivalDeparture: 'h-port',
    dateOfArrivalDeparture: 'h-date',
    nationalityOfShip: 'h-nationality',
    portArrivedFromOrDestination: 'h-portsRoute',
    numberOfPersonsOnBoard: 'h-persons',
    periodOfStay: 'h-period',
    placeOfStorage: 'h-storage',
    pageNo: 'h-pageNo',
  };

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

  function applyFooterFromApp(appData, mode) {
    if (!appData?.ship) return;
    const ship = appData.ship;
    const isArrival = mode === 'arrival';
    const crewList = (appData.crew || []).filter(
      (c) => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false),
    );
    const iso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const dateEl = document.getElementById('f-footer-date');
    if (dateEl) {
      if (global.HtmlFormDateFormat) {
        global.HtmlFormDateFormat.setElement(dateEl, iso);
      } else {
        dateEl.value = formatDisplayDate(iso);
      }
    }
    const masterEl = document.getElementById('f-master-name');
    if (masterEl) masterEl.value = formatMasterName(findMaster(crewList));
  }

  function buildArticleRows() {
    const tbody = document.getElementById('ssd-articles');
    if (!tbody || tbody.dataset['built'] === '1') return;
    let html = '';
    for (let i = 0; i < ROW_COUNT; i++) {
      html += `<tr class="ssd-tr-data" data-ss-row="${i}">
        <td colspan="2" class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-0" readonly tabindex="-1" /></div></td>
        <td class="ssd-cell ssd-cell--qty">
          <div class="ssd-qty-val">
            <div class="ssd-qty-half ssd-qty-half--num">
              <input class="ci ssd-qty-num" type="text" data-cell-key="d-${i}-1" readonly tabindex="-1" />
            </div>
            <div class="ssd-qty-half ssd-qty-half--unit">
              <input class="ci ssd-qty-unit" type="text" data-cell-key="d-${i}-2" readonly tabindex="-1" />
            </div>
          </div>
        </td>
        <td colspan="3" class="ssd-cell ssd-cell--official"></td>
      </tr>`;
    }
    tbody.innerHTML = html;
    tbody.dataset['built'] = '1';
  }

  function formatDisplayDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
  }

  function activeCrewCount(appData, list) {
    const isArrival = list === 'arrival';
    return (appData.crew || []).filter(
      (c) => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false),
    ).length;
  }

  function activePaxCount(appData, list) {
    const isArrival = list === 'arrival';
    return (appData.passengers || []).filter(
      (p) => !p.archived && (isArrival ? p.onArrivalList !== false : p.onDepartureList !== false),
    ).length;
  }

  function setSsAd(mode) {
    const arrBox = document.getElementById('ssd-cb-arr');
    const depBox = document.getElementById('ssd-cb-dep');
    if (!arrBox || !depBox) return;
    const isArrival = mode === 'arrival';
    arrBox.textContent = isArrival ? '\u2713' : '';
    depBox.textContent = isArrival ? '' : '\u2713';
    document.querySelectorAll('.ssd-ad-lbl').forEach((el) => {
      el.classList.toggle('ssd-ad-lbl--active', el.dataset.ad === mode);
    });

    const appData = global._appData;
    if (!appData?.ship) return;
    const ship = appData.ship;
    const dateIso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    if (dateIso) setDateField('h-date', dateIso);
    const persons = activeCrewCount(appData, mode) + activePaxCount(appData, mode);
    setCi('h-persons', String(persons));
    applyFooterFromApp(appData, mode);
  }

  global.setSsAd = setSsAd;

  function setCi(key, value) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function setDateField(key, value) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    if (!el) return;
    if (global.HtmlFormDateFormat) {
      const raw = value == null ? '' : String(value);
      const iso =
        global.HtmlFormDateFormat.parseToIso(raw) ||
        (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '');
      global.HtmlFormDateFormat.setElement(el, iso);
      return;
    }
    setCi(key, value);
  }

  function parseDateToIso(value) {
    if (global.HtmlFormDateFormat) return global.HtmlFormDateFormat.parseToIso(value);
    return parseDotDateToIso(value);
  }

  function getCi(key) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    return el ? String(el.value || '').trim() : '';
  }

  function setField(name, value) {
    if (name === 'arrival' || name === 'departure') {
      if (value) setSsAd(name);
      return;
    }
    const key = HDR_KEYS[name];
    if (key) {
      if (name === 'dateOfArrivalDeparture') setDateField(key, value);
      else setCi(key, value);
    }
  }

  function getField(name) {
    if (name === 'arrival') {
      return document.getElementById('ssd-cb-arr')?.textContent === '\u2713';
    }
    if (name === 'departure') {
      return document.getElementById('ssd-cb-dep')?.textContent === '\u2713';
    }
    const key = HDR_KEYS[name];
    if (key) return getCi(key);
    return '';
  }

  function applyForm01(form01) {
    if (!form01) return;
    if (form01.arrival && !form01.departure) setSsAd('arrival');
    else if (form01.departure) setSsAd('departure');
    else setSsAd('arrival');
    setField('pageNo', form01.pageNo);
    setField('nameOfShip', form01.nameOfShip);
    setField('portOfArrivalDeparture', form01.portOfArrivalDeparture);
    setField('dateOfArrivalDeparture', form01.dateOfArrivalDeparture);
    setField('nationalityOfShip', form01.nationalityOfShip);
    setField('portArrivedFromOrDestination', form01.portArrivedFromOrDestination);
    setField('numberOfPersonsOnBoard', form01.numberOfPersonsOnBoard);
    setField('periodOfStay', form01.periodOfStay);
    setField('placeOfStorage', form01.placeOfStorage);
    setDateField('footer-date', form01.footerDate || '');
    setCi('footer-master', form01.footerMaster || '');

    const articles = form01.articles || [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const row = articles[i] || {};
      setCi(`d-${i}-0`, row.nameOfArticle || '');
      setCi(`d-${i}-1`, row.quantity || '');
      setCi(`d-${i}-2`, row.unit || '');
    }
  }

  function collectForm01() {
    const articles = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      articles.push({
        nameOfArticle: getCi(`d-${i}-0`),
        quantity: getCi(`d-${i}-1`),
        unit: getCi(`d-${i}-2`),
      });
    }
    return {
      arrival: !!getField('arrival'),
      departure: !!getField('departure'),
      pageNo: getField('pageNo'),
      nameOfShip: getField('nameOfShip'),
      portOfArrivalDeparture: getField('portOfArrivalDeparture'),
      dateOfArrivalDeparture: getField('dateOfArrivalDeparture'),
      nationalityOfShip: getField('nationalityOfShip'),
      portArrivedFromOrDestination: getField('portArrivedFromOrDestination'),
      numberOfPersonsOnBoard: getField('numberOfPersonsOnBoard'),
      periodOfStay: getField('periodOfStay'),
      placeOfStorage: getField('placeOfStorage'),
      footerDate: getCi('footer-date'),
      footerMaster: getCi('footer-master'),
      articles,
    };
  }

  function parseDotDateToIso(value) {
    const v = String(value || '').trim();
    const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!m) return '';
    let y = parseInt(m[3], 10);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(iso)) ? '' : iso;
  }

  function collectIntoAppData(appData) {
    const form01 = collectForm01();
    if (!appData.ship) appData.ship = {};
    if (!appData.shipStoresForm) appData.shipStoresForm = { placeOfStorage: '', rows: [] };
    if (!appData.shipStoresForm.rows) appData.shipStoresForm.rows = [];

    if (form01.nameOfShip) appData.ship.name = form01.nameOfShip;
    if (form01.portOfArrivalDeparture) appData.ship.portOfCall = form01.portOfArrivalDeparture;
    if (form01.nationalityOfShip) appData.ship.nationality = form01.nationalityOfShip;
    const iso = parseDateToIso(form01.dateOfArrivalDeparture);
    if (iso) appData.ship.dateOfArrival = iso;

    appData.shipStoresForm.placeOfStorage = form01.placeOfStorage;
    appData.shipStoresForm.rows = form01.articles.map((a) => ({
      name: a.nameOfArticle,
      quantity: a.quantity,
      unit: a.unit,
    }));
    while (appData.shipStoresForm.rows.length < ROW_COUNT) {
      appData.shipStoresForm.rows.push({ name: '', quantity: '', unit: '' });
    }
    appData.shipStoresForm.rows = appData.shipStoresForm.rows.slice(0, ROW_COUNT);
  }

  function resetEditorPage() {
    const appData = global._appData;
    if (!appData || !global.CrewShipStoresPdf?.buildForm01FromAppData) return;
    const form01 = global.CrewShipStoresPdf.buildForm01FromAppData(appData, false, { ignoreOverlay: true });
    applyForm01(form01);
    global.ShipStoresFormCells?.resetCellStyles?.();
    global.ShipStoresFormCells?.captureDirtyBaseline?.();
  }

  function initCellEditor(overlayVariant) {
    const table = document.getElementById('ssd-grid');
    if (!table || !global.ShipStoresFormCells) return;
    const saved = editor.loadPositions();
    global.ShipStoresFormCells.init(table);
    const cellValues = overlayVariant?.cellValues || saved.cellValues || {};
    const cellStyles = overlayVariant?.cellStyles || saved.cellStyles || {};
    global.ShipStoresFormCells.restoreCellValues(cellValues);
    global.ShipStoresFormCells.restoreCellStyles(cellStyles);
    global.ShipStoresFormCells.captureDirtyBaseline();
    editor.connectCellEditor({
      collect: () => global.ShipStoresFormCells.collectCellStyles(),
      collectValues: () => global.ShipStoresFormCells.collectCellValues(),
      resetPage: resetEditorPage,
    });
  }

  async function loadSnapshot(withOverlay) {
    const fromSession = global.CrewHtmlFormPdfSnapshot?.read?.();
    if (fromSession?.form01) return fromSession;

    const appData = await editor.readPersistedAppData();
    if (!appData) return null;

    if (global.CrewShipStoresPdf?.buildForm01FromAppData) {
      return {
        variant: '01',
        overlayKey: OVERLAY_KEY,
        form01: global.CrewShipStoresPdf.buildForm01FromAppData(appData, withOverlay),
        documentOverlay: appData.documentOverlay,
        withOverlay: !!withOverlay,
      };
    }
    return null;
  }

  async function renderPage(snapshot) {
    buildArticleRows();
    applyForm01(snapshot.form01);
    if (snapshot.withOverlay && SS?.renderOverlays) {
      await SS.renderOverlays(document.getElementById('ss-page'), OVERLAY_KEY, snapshot);
    }
  }

  function finishPdfExport() {
    document.body.classList.add('pdf-export', 'is-pdf-export');
    global.ShipStoresFormCells?.reflowAllWrappedCells?.();
    global.ShipStoresFormCells?.flattenInputsForExport?.();
    global.__pdfReady = true;
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
    buildArticleRows();
    applyForm01(snapshot.form01);
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ss-page'));
    }
    const overlayVariant = snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY];
    initCellEditor(overlayVariant || {});
    editor.initOverlayToolbar();
    await editor.restoreOverlaySettings();
    editor.initEditorZoom();
  }

  async function initPdfExport() {
    const snapshot = await loadSnapshot(true);
    if (!snapshot) {
      finishPdfExport();
      return;
    }
    editor.resetEditorZoomForExport();
    buildArticleRows();
    applyForm01(snapshot.form01);
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ss-page'));
    }
    const overlayVariant = snapshot.documentOverlay?.[OVERLAY_KEY];
    if (overlayVariant?.cellValues) {
      global.ShipStoresFormCells?.restoreCellValues?.(overlayVariant.cellValues);
    }
    if (overlayVariant?.cellStyles) {
      global.ShipStoresFormCells?.restoreCellStyles?.(overlayVariant.cellStyles);
    }
    if (snapshot.withOverlay && SS?.renderOverlays) {
      await SS.renderOverlays(document.getElementById('ss-page'), OVERLAY_KEY, snapshot);
    }
    finishPdfExport();
  }

  global.ShipStoresForm01 = {
    ROW_COUNT,
    collectForm01,
    collectIntoAppData,
    applyForm01,
    resetEditorPage,
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get('pdfExport') === '1') {
    void initPdfExport();
  } else {
    void initEditor();
  }
})(typeof window !== 'undefined' ? window : globalThis);

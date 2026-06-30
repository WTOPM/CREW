/**
 * Form 02 - Ship Stores Long — full HTML editor + PDF renderer.
 */
(function (global) {
  const ROW_COUNT = 43;
  const OVERLAY_KEY = 'shipStores02';
  const FEEDBACK_PARAM = 'ssForm02Feedback';
  const editor = global.ShipStoresFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);
  const SS = global.CrewShipStoresPdf;

  const HDR_KEYS = {
    nameOfShip: 'h-nameOfShip',
    imoNumber: 'h-imo',
    callSign: 'h-callSign',
    portOfArrivalDeparture: 'h-port',
    dateOfArrivalDeparture: 'h-date',
    nationalityOfShip: 'h-nationality',
    lastNextPortOfCall: 'h-portsRoute',
    numberOfPersonsOnBoard: 'h-persons',
    periodOfStay: 'h-period',
    placeOfStorage: 'h-storage',
    pageNo: 'h-pageNo',
  };

  function formatDisplayDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    return String(value);
  }

  function findMaster(crew) {
    const exact = crew.find((c) => String(c.rank || '').trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((c) => String(c.rank || '').trim().toLowerCase().includes('master'));
  }

  function formatMasterName(member) {
    if (!member) return '';
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

  function buildArticleRows() {
    const tbody = document.getElementById('ssd-articles');
    if (!tbody || tbody.dataset['built'] === '1') return;
    let html = '';
    for (let i = 0; i < ROW_COUNT; i++) {
      html += `<tr class="ssd-tr-data" data-ss-row="${i}">
        <td colspan="2" class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-0" readonly tabindex="-1" /></div></td>
        <td class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-1" readonly tabindex="-1" /></div></td>
        <td class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-2" readonly tabindex="-1" /></div></td>
        <td colspan="2" class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-3" readonly tabindex="-1" /></div></td>
        <td class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-4" readonly tabindex="-1" /></div></td>
        <td class="ssd-cell"><div class="ssd-data-val"><input class="ci" type="text" data-cell-key="d-${i}-5" readonly tabindex="-1" /></div></td>
      </tr>`;
    }
    tbody.innerHTML = html;
    tbody.dataset['built'] = '1';
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

  function applyForm02(form02) {
    if (!form02) return;
    if (form02.arrival && !form02.departure) setSsAd('arrival');
    else if (form02.departure) setSsAd('departure');
    else setSsAd('arrival');

    setField('pageNo', form02.pageNo);
    setField('nameOfShip', form02.nameOfShip);
    setField('imoNumber', form02.imoNumber);
    setField('callSign', form02.callSign);
    setField('portOfArrivalDeparture', form02.portOfArrivalDeparture);
    setDateField('h-date', form02.dateOfArrivalDeparture);
    setField('nationalityOfShip', form02.nationalityOfShip);
    setField('lastNextPortOfCall', form02.lastNextPortOfCall);
    setField('numberOfPersonsOnBoard', form02.numberOfPersonsOnBoard);
    setField('periodOfStay', form02.periodOfStay);
    setField('placeOfStorage', form02.placeOfStorage);

    const articles = form02.articles || [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const row = articles[i] || {};
      setCi(`d-${i}-0`, row.nameOfArticle || '');
      setCi(`d-${i}-1`, row.quantity || '');
      setCi(`d-${i}-2`, row.colAfterQuantity ?? row.unit ?? '');
      setCi(`d-${i}-3`, row.officialUse || '');
      setCi(`d-${i}-4`, row.colRight1 || '');
      setCi(`d-${i}-5`, row.colRight2 || '');
    }

    setDateField('footer-date', form02.footerDate || '');
    setCi('footer-master', form02.footerMaster || '');
  }

  function collectForm02() {
    const articles = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      articles.push({
        nameOfArticle: getCi(`d-${i}-0`),
        quantity: getCi(`d-${i}-1`),
        unit: getCi(`d-${i}-2`),
        colAfterQuantity: getCi(`d-${i}-2`),
        officialUse: getCi(`d-${i}-3`),
        colRight1: getCi(`d-${i}-4`),
        colRight2: getCi(`d-${i}-5`),
      });
    }
    return {
      arrival: !!getField('arrival'),
      departure: !!getField('departure'),
      pageNo: getField('pageNo'),
      nameOfShip: getField('nameOfShip'),
      imoNumber: getField('imoNumber'),
      callSign: getField('callSign'),
      portOfArrivalDeparture: getField('portOfArrivalDeparture'),
      dateOfArrivalDeparture: getField('dateOfArrivalDeparture'),
      nationalityOfShip: getField('nationalityOfShip'),
      lastNextPortOfCall: getField('lastNextPortOfCall'),
      numberOfPersonsOnBoard: getField('numberOfPersonsOnBoard'),
      periodOfStay: getField('periodOfStay'),
      placeOfStorage: getField('placeOfStorage'),
      articles,
      footerDate: getCi('footer-date'),
      footerMaster: getCi('footer-master'),
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
    const form02 = collectForm02();
    if (!appData.ship) appData.ship = {};
    if (!appData.shipStoresForm02) appData.shipStoresForm02 = { placeOfStorage: '', rows: [] };
    if (!appData.shipStoresForm02.rows) appData.shipStoresForm02.rows = [];

    if (form02.nameOfShip) appData.ship.name = form02.nameOfShip;
    if (form02.imoNumber) appData.ship.imoNo = form02.imoNumber;
    if (form02.callSign) appData.ship.callSign = form02.callSign;
    if (form02.portOfArrivalDeparture) appData.ship.portOfCall = form02.portOfArrivalDeparture;
    if (form02.nationalityOfShip) appData.ship.nationality = form02.nationalityOfShip;
    const iso = parseDateToIso(form02.dateOfArrivalDeparture);
    if (iso) {
      if (form02.arrival) appData.ship.dateOfArrival = iso;
      else appData.ship.dateOfDeparture = iso;
    }
    if (appData.crewArr) appData.crewArr.isArrival = form02.arrival;

    appData.shipStoresForm02.placeOfStorage = form02.placeOfStorage;
    appData.shipStoresForm02.rows = form02.articles.map((a) => ({
      name: a.nameOfArticle,
      quantity: a.quantity,
      unit: a.unit,
    }));
    while (appData.shipStoresForm02.rows.length < ROW_COUNT) {
      appData.shipStoresForm02.rows.push({ name: '', quantity: '', unit: '' });
    }
    appData.shipStoresForm02.rows = appData.shipStoresForm02.rows.slice(0, ROW_COUNT);
  }

  function resetEditorPage() {
    const appData = global._appData;
    if (!appData || !SS?.buildForm02FromAppData) return;
    const form02 = SS.buildForm02FromAppData(appData, false, { ignoreOverlay: true });
    applyForm02(form02);
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
      collectValues: () => {
        const values = global.ShipStoresFormCells.collectCellValues();
        values._ssMode = getField('arrival') ? 'arrival' : 'departure';
        return values;
      },
      resetPage: resetEditorPage,
    });
  }

  async function loadSnapshot(withOverlay) {
    const fromSession = global.CrewHtmlFormPdfSnapshot?.read?.();
    if (fromSession?.form02) return fromSession;

    const appData = await editor.readPersistedAppData();
    if (!appData) return null;

    if (SS?.buildForm02FromAppData) {
      return {
        variant: '02',
        overlayKey: OVERLAY_KEY,
        form02: SS.buildForm02FromAppData(appData, withOverlay),
        documentOverlay: appData.documentOverlay,
        withOverlay: !!withOverlay,
      };
    }
    return null;
  }

  async function renderPage(snapshot) {
    buildArticleRows();
    applyForm02(snapshot.form02);
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
    applyForm02(snapshot.form02);
    const overlayVariant =
      snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY];
    initCellEditor(overlayVariant || {});
    editor.initOverlayToolbar();
    await editor.restoreOverlaySettings();
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ss-page'));
    }
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
    applyForm02(snapshot.form02);
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
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ss-page'));
    }
    finishPdfExport();
  }

  global.ShipStoresForm02 = {
    ROW_COUNT,
    collectForm02,
    collectIntoAppData,
    applyForm02,
    resetEditorPage,
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get('pdfExport') === '1') {
    void initPdfExport();
  } else {
    void initEditor();
  }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Form 02 - Crew Effect — HTML editor + PDF export.
 */
(function (global) {
  const ROW_COUNT = 18;
  const OVERLAY_KEY = 'crewEffect02';
  const FEEDBACK_PARAM = 'ceForm02Feedback';
  const editor = global.CrewEffectFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);
  const CE = global.CrewCrewEffectPdf;
  const Cells = global.CrewEffectFormCellsV2;

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
    if (global.CrewNameFormat?.formatCrewListName) {
      return global.CrewNameFormat.formatCrewListName(member, { upper: true });
    }
    const parts = [member.familyName, member.givenNames].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  function setCi(key, value) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function getCi(key) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    return el ? String(el.value || '').trim() : '';
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
    el.value = formatDisplayDate(value);
  }

  function activeCrewList(appData, mode) {
    const isArrival = mode === 'arrival';
    return (appData.crew || []).filter(
      (c) => !c.archived && (isArrival ? c.onArrivalList !== false : c.onDepartureList !== false),
    );
  }

  function applyFooterFromApp(appData, mode) {
    if (!appData?.ship) return;
    const ship = appData.ship;
    const isArrival = mode === 'arrival';
    const iso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    if (iso) {
      setDateField('h-date', iso);
      setDateField('footer-date', iso);
    }
    setCi('footer-master', formatMasterName(findMaster(activeCrewList(appData, mode))));
  }

  function setCeAd(mode) {
    const arrBox = document.getElementById('ced-cb-arr');
    const depBox = document.getElementById('ced-cb-dep');
    if (!arrBox || !depBox) return;
    const isArrival = mode === 'arrival';
    arrBox.textContent = isArrival ? '\u2713' : '';
    depBox.textContent = isArrival ? '' : '\u2713';
    document.querySelectorAll('.ced-ad-lbl').forEach((el) => {
      el.classList.toggle('ced-ad-lbl--active', el.dataset.ad === mode);
    });

    const appData = global._appData;
    if (!appData?.ship) return;
    const ship = appData.ship;
    const dateIso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    if (dateIso) setDateField('h-date', dateIso);
    applyFooterFromApp(appData, mode);
    void crewSigModule?.onMembersChanged?.();
  }

  global.setCeAd = setCeAd;

  function buildCrewRows() {
    const tbody = document.getElementById('ced-crew');
    if (!tbody || tbody.dataset['built'] === '1') return;
    let html = '';
    for (let i = 0; i < ROW_COUNT; i++) {
      html += `<tr class="ced-tr-data" data-ce-row="${i}">
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-0" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val"><input class="ci" type="text" data-cell-key="d-${i}-1" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val"><input class="ci" type="text" data-cell-key="d-${i}-2" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-3" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-4" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-5" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-6" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-7" readonly tabindex="-1" /></div></td>
        <td class="ced-cell ced-cell--sig"><div class="ced-data-val ced-sig-cell" data-ce-sig-row="${i}"><input class="ci" type="text" data-cell-key="d-${i}-8" readonly tabindex="-1" /></div></td>
      </tr>`;
    }
    tbody.innerHTML = html;
    tbody.dataset['built'] = '1';
  }

  function applyForm02(form02) {
    if (!form02) return;
    if (form02.arrival && !form02.departure) setCeAd('arrival');
    else if (form02.departure) setCeAd('departure');
    else setCeAd('arrival');
    setCi('h-pageNo', form02.pageNo);
    setCi('h-nameOfShip', form02.nameOfShip);
    setCi('h-port', form02.portOfArrivalDeparture);
    setDateField('h-date', form02.dateOfArrivalDeparture || '');
    setCi('h-nationality', form02.nationalityOfShip);
    setDateField('footer-date', form02.footerDate || '');
    setCi('footer-master', form02.footerMaster || '');
    const crew = form02.crew || [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const row = crew[i] || {};
      setCi(`d-${i}-0`, CE?.normalizeCrewEffectRowNo?.(row, i) ?? row.no ?? '');
      setCi(`d-${i}-1`, row.familyGivenNames || '');
      setCi(`d-${i}-2`, row.rankOrRating || '');
      setCi(`d-${i}-3`, row.cigarettes || '');
      setCi(`d-${i}-4`, row.tobaccoCigares || '');
      setCi(`d-${i}-5`, row.spirits || '');
      setCi(`d-${i}-6`, row.beer || '');
      setCi(`d-${i}-7`, row.other || '');
      setCi(`d-${i}-8`, row.signature || '');
    }
  }

  function collectForm02() {
    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      crew.push({
        no: getCi(`d-${i}-0`),
        familyGivenNames: getCi(`d-${i}-1`),
        rankOrRating: getCi(`d-${i}-2`),
        cigarettes: getCi(`d-${i}-3`),
        tobaccoCigares: getCi(`d-${i}-4`),
        spirits: getCi(`d-${i}-5`),
        beer: getCi(`d-${i}-6`),
        other: getCi(`d-${i}-7`),
        signature: getCi(`d-${i}-8`),
      });
    }
    return {
      arrival: document.getElementById('ced-cb-arr')?.textContent === '\u2713',
      departure: document.getElementById('ced-cb-dep')?.textContent === '\u2713',
      pageNo: getCi('h-pageNo'),
      nameOfShip: getCi('h-nameOfShip'),
      portOfArrivalDeparture: getCi('h-port'),
      dateOfArrivalDeparture: getCi('h-date'),
      nationalityOfShip: getCi('h-nationality'),
      crew,
      footerDate: getCi('footer-date'),
      footerMaster: getCi('footer-master'),
    };
  }

  function resetEditorPage() {
    const appData = global._appData;
    if (!appData || !CE?.buildForm02FromAppData) return;
    const form02 = CE.buildForm02FromAppData(appData, false, { ignoreOverlay: true });
    applyForm02(form02);
    Cells?.resetCellStyles?.();
    Cells?.captureDirtyBaseline?.();
  }

  function initCellEditor(overlayVariant) {
    const table = document.getElementById('ced-grid');
    if (!table || !Cells) return;
    const saved = editor.loadPositions();
    Cells.init(table);
    const cellValues = overlayVariant?.cellValues || saved.cellValues || {};
    const cellStyles = overlayVariant?.cellStyles || saved.cellStyles || {};
    Cells.restoreCellValues(cellValues);
    Cells.restoreCellStyles(cellStyles);
    Cells.captureDirtyBaseline();
    editor.connectCellEditor({
      collect: () => Cells.collectCellStyles(),
      collectValues: () => {
        const values = Cells.collectCellValues();
        const depOn = document.getElementById('ced-cb-dep')?.textContent === '\u2713';
        values._ceMode = depOn ? 'departure' : 'arrival';
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

    if (CE?.buildForm02FromAppData) {
      return {
        overlayKey: OVERLAY_KEY,
        form02: CE.buildForm02FromAppData(appData, withOverlay),
        documentOverlay: appData.documentOverlay,
        withOverlay: !!withOverlay,
      };
    }
    return null;
  }

  function finishPdfExport() {
    document.body.classList.add('pdf-export', 'is-pdf-export');
    const table = document.getElementById('ced-grid');
    if (table) Cells?.init?.(table);
    Cells?.flattenInputsForExport?.();
    global.CrewHtmlFormPdfSnapshot?.prepForPrint?.();
    global.__pdfReady = true;
  }

  function editorScale() {
    const txt = document.getElementById('zoom-label')?.textContent || '100%';
    return (parseFloat(txt) || 100) / 100;
  }

  let crewSigModule = null;

  function signatureListMode() {
    const depOn = document.getElementById('ced-cb-dep')?.textContent === '\u2713';
    return depOn ? 'departure' : 'arrival';
  }

  function initCrewSignatures(overlayVariant) {
    if (!global.CrewEffectCrewSignatures) return null;
    crewSigModule = CrewEffectCrewSignatures.create();
    crewSigModule.init({
      signatureCol: (row) => `d-${row}-8`,
      getMembers: () => CE?.crewSignatureMembers02?.(window._appData) || [],
      getScale: editorScale,
    });
    crewSigModule.restoreFromOverlay(overlayVariant || {});
    editor.connectCrewSignatures(crewSigModule);
    return crewSigModule;
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
    buildCrewRows();
    applyForm02(snapshot.form02);
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ce-page'));
    }
    const overlayVariant =
      snapshot.documentOverlay?.[OVERLAY_KEY] || window._appData?.documentOverlay?.[OVERLAY_KEY];
    initCellEditor(overlayVariant || {});
    initCrewSignatures(overlayVariant || {});
    editor.initOverlayToolbar();
    await editor.restoreOverlaySettings();
    if (crewSigModule) await crewSigModule.restore();
    editor.initEditorZoom();
    editor.captureEditorDirtyBaseline?.();
  }

  async function initPdfExport() {
    const snapshot = await loadSnapshot(true);
    if (!snapshot) {
      finishPdfExport();
      return;
    }
    editor.resetEditorZoomForExport();
    buildCrewRows();
    const table = document.getElementById('ced-grid');
    if (table) Cells?.init?.(table);
    applyForm02(snapshot.form02);
    const overlayVariant = snapshot.documentOverlay?.[OVERLAY_KEY];
    if (overlayVariant?.cellValues) {
      Cells?.restoreCellValues?.(overlayVariant.cellValues);
    }
    if (overlayVariant?.cellStyles) {
      Cells?.restoreCellStyles?.(overlayVariant.cellStyles);
    }
    if (snapshot.withOverlay && CE?.renderOverlays) {
      await CE.renderOverlays(document.getElementById('ce-page'), OVERLAY_KEY, snapshot);
    }
    const appData = await editor.readPersistedAppData();
    if (overlayVariant?.useCrewSignatures && global.CrewEffectCrewSignatures) {
      const mod = CrewEffectCrewSignatures.create();
      mod.init({ signatureCol: (row) => `d-${row}-8`, getMembers: () => [] });
      document.querySelectorAll('#ced-crew tr.ced-tr-data').forEach((tr) => {
        const row = Number(tr.dataset.ceRow);
        const input = tr.querySelector(`[data-cell-key="d-${row}-8"]`);
        const wrap = input?.closest('.ced-data-val');
        if (wrap) {
          wrap.classList.add('ced-sig-cell');
          wrap.dataset.ceSigRow = String(row);
        }
      });
      await mod.renderForExport(
        document.getElementById('ce-page'),
        overlayVariant,
        CE?.crewSignatureMembers02?.(appData) || [],
      );
    }
    finishPdfExport();
  }

  global.CrewEffectForm02 = {
    ROW_COUNT,
    collectForm02,
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

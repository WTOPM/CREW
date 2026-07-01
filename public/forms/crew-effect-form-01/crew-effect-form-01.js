/**
 * Form 01 - Crew Effect — HTML editor + PDF export.
 */
(function (global) {
  const ROW_COUNT = 24;
  const OVERLAY_KEY = 'crewEffect';
  const FEEDBACK_PARAM = 'ceForm01Feedback';
  const editor = global.CrewEffectFormEditor.createEditor(OVERLAY_KEY, FEEDBACK_PARAM);
  const CE = global.CrewCrewEffectPdf;

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

  function setCi(key, value) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function getCi(key) {
    const el = document.querySelector(`[data-cell-key="${key}"]`);
    return el ? String(el.value || '').trim() : '';
  }

  function buildCrewRows() {
    const tbody = document.getElementById('ced-crew');
    if (!tbody || tbody.dataset['built'] === '1') return;
    let html = '';
    for (let i = 0; i < ROW_COUNT; i++) {
      html += `<tr class="ced-tr-data" data-ce-row="${i}">
        <td class="ced-cell"><div class="ced-data-val"><input class="ci" type="text" data-cell-key="d-${i}-0" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val"><input class="ci" type="text" data-cell-key="d-${i}-1" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val"><input class="ci" type="text" data-cell-key="d-${i}-2" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-3" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-4" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-5" readonly tabindex="-1" /></div></td>
        <td class="ced-cell"><div class="ced-data-val ced-data-val--center"><input class="ci" type="text" data-cell-key="d-${i}-6" readonly tabindex="-1" /></div></td>
        <td class="ced-cell ced-cell--sig"><div class="ced-data-val ced-sig-cell" data-ce-sig-row="${i}"><input class="ci" type="text" data-cell-key="d-${i}-7" readonly tabindex="-1" /></div></td>
      </tr>`;
    }
    tbody.innerHTML = html;
    tbody.dataset['built'] = '1';
  }

  function applyForm01(form01) {
    if (!form01) return;
    setCi('h-pageNo', form01.pageNo);
    setCi('h-nameOfShip', form01.nameOfShip);
    setCi('h-nationality', form01.nationalityOfShip);
    setCi('footer-master', form01.footerMaster || '');
    const crew = form01.crew || [];
    for (let i = 0; i < ROW_COUNT; i++) {
      const row = crew[i] || {};
      setCi(`d-${i}-0`, row.no || '');
      setCi(`d-${i}-1`, row.familyGivenNames || '');
      setCi(`d-${i}-2`, row.rankOrRating || '');
      setCi(`d-${i}-3`, row.cigarettes || '');
      setCi(`d-${i}-4`, row.spirits || '');
      setCi(`d-${i}-5`, row.wines || '');
      setCi(`d-${i}-6`, row.others || '');
      setCi(`d-${i}-7`, row.signature || '');
    }
  }

  function collectForm01() {
    const crew = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      crew.push({
        no: getCi(`d-${i}-0`),
        familyGivenNames: getCi(`d-${i}-1`),
        rankOrRating: getCi(`d-${i}-2`),
        cigarettes: getCi(`d-${i}-3`),
        spirits: getCi(`d-${i}-4`),
        wines: getCi(`d-${i}-5`),
        others: getCi(`d-${i}-6`),
        signature: getCi(`d-${i}-7`),
      });
    }
    return {
      pageNo: getCi('h-pageNo'),
      nameOfShip: getCi('h-nameOfShip'),
      nationalityOfShip: getCi('h-nationality'),
      crew,
      footerMaster: getCi('footer-master'),
    };
  }

  function resetEditorPage() {
    const appData = global._appData;
    if (!appData || !CE?.buildForm01FromAppData) return;
    const form01 = CE.buildForm01FromAppData(appData, false, { ignoreOverlay: true });
    applyForm01(form01);
    global.CrewEffectFormCells?.resetCellStyles?.();
    global.CrewEffectFormCells?.captureDirtyBaseline?.();
  }

  function initCellEditor(overlayVariant) {
    const table = document.getElementById('ced-grid');
    if (!table || !global.CrewEffectFormCells) return;
    const saved = editor.loadPositions();
    global.CrewEffectFormCells.init(table);
    const cellValues = overlayVariant?.cellValues || saved.cellValues || {};
    const cellStyles = overlayVariant?.cellStyles || saved.cellStyles || {};
    global.CrewEffectFormCells.restoreCellValues(cellValues);
    global.CrewEffectFormCells.restoreCellStyles(cellStyles);
    global.CrewEffectFormCells.captureDirtyBaseline();
    editor.connectCellEditor({
      collect: () => global.CrewEffectFormCells.collectCellStyles(),
      collectValues: () => global.CrewEffectFormCells.collectCellValues(),
      resetPage: resetEditorPage,
    });
  }

  async function loadSnapshot(withOverlay) {
    const fromSession = global.CrewHtmlFormPdfSnapshot?.read?.();
    if (fromSession?.form01) return fromSession;

    const appData = await editor.readPersistedAppData();
    if (!appData) return null;

    if (CE?.buildForm01FromAppData) {
      return {
        overlayKey: OVERLAY_KEY,
        form01: CE.buildForm01FromAppData(appData, withOverlay),
        documentOverlay: appData.documentOverlay,
        withOverlay: !!withOverlay,
      };
    }
    return null;
  }

  function finishPdfExport() {
    document.body.classList.add('pdf-export', 'is-pdf-export');
    global.CrewEffectFormCells?.reflowAllWrappedCells?.();
    global.CrewEffectFormCells?.flattenInputsForExport?.();
    global.CrewHtmlFormPdfSnapshot?.prepForPrint?.();
    global.__pdfReady = true;
  }

  function editorScale() {
    const txt = document.getElementById('zoom-label')?.textContent || '100%';
    return (parseFloat(txt) || 100) / 100;
  }

  let crewSigModule = null;

  function initCrewSignatures(overlayVariant) {
    if (!global.CrewEffectCrewSignatures) return null;
    crewSigModule = CrewEffectCrewSignatures.create();
    crewSigModule.init({
      signatureCol: (row) => `d-${row}-7`,
      getMembers: () => CE?.crewSignatureMembers01?.(window._appData) || [],
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
    applyForm01(snapshot.form01);
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
  }

  async function initPdfExport() {
    const snapshot = await loadSnapshot(true);
    if (!snapshot) {
      finishPdfExport();
      return;
    }
    editor.resetEditorZoomForExport();
    buildCrewRows();
    applyForm01(snapshot.form01);
    if (global.HtmlFormFooterFields) {
      global.HtmlFormFooterFields.init(document.getElementById('ce-page'));
    }
    const overlayVariant = snapshot.documentOverlay?.[OVERLAY_KEY];
    if (overlayVariant?.cellValues) {
      global.CrewEffectFormCells?.restoreCellValues?.(overlayVariant.cellValues);
    }
    if (overlayVariant?.cellStyles) {
      global.CrewEffectFormCells?.restoreCellStyles?.(overlayVariant.cellStyles);
    }
    if (snapshot.withOverlay && CE?.renderOverlays) {
      await CE.renderOverlays(document.getElementById('ce-page'), OVERLAY_KEY, snapshot);
    }
    const appData = await editor.readPersistedAppData();
    if (overlayVariant?.useCrewSignatures && global.CrewEffectCrewSignatures) {
      const mod = CrewEffectCrewSignatures.create();
      mod.init({ signatureCol: (row) => `d-${row}-7`, getMembers: () => [] });
      document.querySelectorAll('#ced-crew tr.ced-tr-data').forEach((tr) => {
        const row = Number(tr.dataset.ceRow);
        const input = tr.querySelector(`[data-cell-key="d-${row}-7"]`);
        const wrap = input?.closest('.ced-data-val');
        if (wrap) {
          wrap.classList.add('ced-sig-cell');
          wrap.dataset.ceSigRow = String(row);
        }
      });
      await mod.renderForExport(
        document.getElementById('ce-page'),
        overlayVariant,
        CE?.crewSignatureMembers01?.(appData) || [],
      );
    }
    finishPdfExport();
  }

  global.CrewEffectForm01 = {
    ROW_COUNT,
    collectForm01,
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

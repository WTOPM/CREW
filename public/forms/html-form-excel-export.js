/**
 * HTML form editors (03/04/05) → structured Excel via the Angular app.
 * Builds a snapshot from the live DOM, loads a hidden iframe (no page navigation),
 * receives .xlsx bytes back, and opens/downloads in this window.
 */
(function (global) {
  const STORAGE_KEY = 'crew-html-form-excel-export';
  const EXPORT_DONE = 'crewHtmlFormExcelDone';
  const EXPORT_TIMEOUT_MS = 60000;

  let exportFrame = null;
  let exportListener = null;
  let exportTimeout = null;

  function slugPart(value) {
    return (
      String(value ?? '')
        .trim()
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || ''
    );
  }

  function defaultExcelFileName() {
    const ship = slugPart(document.getElementById('h-ship-name')?.value);
    const port = slugPart(document.getElementById('h-port')?.value);
    const dateRaw = document.getElementById('h-date')?.value || '';
    const date = slugPart(dateRaw.replace(/\./g, '-'));
    const arrBox = document.getElementById('cb-arr');
    const isArrival = (arrBox?.textContent || '').includes('✓');
    const dir = isArrival ? 'Arrival' : 'Departure';
    const parts = ['Crew_List', dir, ship, port, date].filter(Boolean);
    return `${parts.join('_') || 'Crew_List'}.xlsx`;
  }

  function appExportUrl(listType) {
    const path = location.pathname || '/';
    const formsIdx = path.indexOf('/forms/');
    const basePath = formsIdx >= 0 ? path.slice(0, formsIdx) : '';
    const root = `${location.origin}${basePath}/`;
    const q = new URLSearchParams({ htmlFormExcel: listType, embed: '1' });
    return `${root}?${q.toString()}`;
  }

  function cellText(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT') return el.value || '';
    return (el.textContent || '').trim();
  }

  function rowHasData(row, cellSelector) {
    return Array.from(row.querySelectorAll(cellSelector)).some((cell) => {
      if (cell.classList.contains('ci-rno')) return false;
      return cellText(cell).trim();
    });
  }

  function overlayImageDataUrl(containerId) {
    const el = document.getElementById(containerId);
    if (!el?.classList.contains('visible')) return null;
    const img = el.querySelector('img');
    const src = img?.getAttribute('src');
    return src && src.startsWith('data:') ? src : null;
  }

  function readOverlayState(loadPositions) {
    const saved = typeof loadPositions === 'function' ? loadPositions() : null;
    return {
      stamp: saved?.stamp || {},
      sig: saved?.sig || {},
      cellStyles: saved?.cellStyles || {},
      stampImage: overlayImageDataUrl('stamp-container'),
      sigImage: overlayImageDataUrl('sig-container'),
    };
  }

  function isArrivalMode() {
    const arrBox = document.getElementById('cb-arr');
    return (arrBox?.textContent || '').includes('✓');
  }

  function splitName(name) {
    const trimmed = (name || '').trim();
    return { familyName: trimmed, givenNames: '' };
  }

  function snapshotForm05(loadPositions) {
    const tbody = document.getElementById('tbody');
    const crew = [];
    if (tbody) {
      Array.from(tbody.children).forEach((tr) => {
        if (!rowHasData(tr, '.ci')) return;
        const inputs = tr.querySelectorAll('input.ci');
        const name = cellText(tr.querySelector('.ci-name'));
        crew.push({
          ...splitName(name),
          rank: cellText(inputs[0]),
          nationality: cellText(inputs[1]),
          dateOfBirth: cellText(inputs[2]),
          placeOfBirth: cellText(inputs[3]),
          seamansBook: cellText(inputs[4]),
          sbookExpiryDate: cellText(inputs[5]),
        });
      });
    }
    return {
      listType: 'type4V3Sbk',
      isArrival: isArrivalMode(),
      footerDate: cellText(document.getElementById('f-footer-date')),
      masterName: cellText(document.getElementById('f-master-name')),
      crew,
      overlay: readOverlayState(loadPositions),
      fileName: defaultExcelFileName(),
    };
  }

  function snapshotForm04(loadPositions) {
    const tbody = document.getElementById('tbody');
    const crew = [];
    if (tbody) {
      Array.from(tbody.children).forEach((tr) => {
        if (!rowHasData(tr, '.ci')) return;
        const inputs = tr.querySelectorAll('input.ci');
        const name = cellText(tr.querySelector('.ci-name'));
        const birth = cellText(inputs[2]);
        const birthParts = birth.split(/\s+/);
        crew.push({
          ...splitName(name),
          rank: cellText(inputs[0]),
          nationality: cellText(inputs[1]),
          dateOfBirth: birthParts[0] || birth,
          placeOfBirth: birthParts.slice(1).join(' '),
          passport: cellText(inputs[3]),
          passportExpiryDate: cellText(inputs[4]),
          passportPlaceOfIssue: cellText(inputs[5]),
          gender: cellText(inputs[6]),
        });
      });
    }
    return {
      listType: 'type3V2',
      isArrival: isArrivalMode(),
      footerDate: cellText(document.getElementById('f-footer-date')),
      masterName: cellText(document.getElementById('f-master-name')),
      crew,
      overlay: readOverlayState(loadPositions),
      fileName: defaultExcelFileName(),
    };
  }

  function snapshotForm03(loadPositions) {
    const tableBody = document.getElementById('table-body');
    const crew = [];
    if (tableBody) {
      Array.from(tableBody.children).forEach((row) => {
        if (!rowHasData(row, '.ci')) return;
        const inputs = row.querySelectorAll('input.ci');
        const name = cellText(row.querySelector('.ci-name'));
        crew.push({
          ...splitName(name),
          rank: cellText(inputs[0]),
          nationality: cellText(inputs[1]),
          dateOfBirth: cellText(inputs[2]),
          placeOfBirth: '',
          passport: cellText(inputs[3]),
          seamansBook: cellText(inputs[4]),
          joiningDate: cellText(inputs[5]),
          joiningPort: cellText(inputs[6]),
        });
      });
    }
    return {
      listType: 'type2Alger',
      isArrival: isArrivalMode(),
      footerDate: cellText(document.getElementById('f-footer-date')),
      masterName: cellText(document.getElementById('f-master-name')),
      crew,
      overlay: readOverlayState(loadPositions),
      fileName: defaultExcelFileName(),
    };
  }

  const SNAPSHOT_BUILDERS = {
    type4V3Sbk: snapshotForm05,
    type3V2: snapshotForm04,
    type2Alger: snapshotForm03,
  };

  function cleanupExport() {
    if (exportListener) {
      window.removeEventListener('message', exportListener);
      exportListener = null;
    }
    if (exportTimeout) {
      clearTimeout(exportTimeout);
      exportTimeout = null;
    }
  }

  function finishExport(btn, ok, errorMsg) {
    cleanupExport();
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || 'Excel';
    }
    if (exportFrame) {
      exportFrame.src = 'about:blank';
    }
    if (!ok) {
      alert(errorMsg || 'Excel export failed');
    }
  }

  async function openExcelInParent(fileName, bytesBase64) {
    const safeName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    if (global.electronAPI?.openTempFile) {
      const res = await global.electronAPI.openTempFile(safeName, bytesBase64);
      if (!res?.ok) {
        throw new Error(res?.error || 'Could not open Excel file');
      }
      return;
    }
    const binary = atob(bytesBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * @param {object} options
   * @param {'type4V3Sbk'|'type3V2'|'type2Alger'} options.listType
   * @param {() => void} [options.beforeExport] e.g. savePositions
   * @param {() => object} [options.loadPositions]
   */
  function exportForm(options) {
    const listType = options.listType;
    const builder = SNAPSHOT_BUILDERS[listType];
    if (!builder) {
      throw new Error(`Unknown form type: ${listType}`);
    }
    if (options.beforeExport) options.beforeExport();
    const snapshot = builder(options.loadPositions);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      throw new Error('Could not prepare Excel export (storage full?)');
    }

    cleanupExport();

    if (!exportFrame) {
      exportFrame = document.createElement('iframe');
      exportFrame.id = 'crew-html-form-excel-frame';
      exportFrame.title = 'Excel export';
      exportFrame.setAttribute('aria-hidden', 'true');
      exportFrame.style.cssText =
        'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(exportFrame);
    }

    const btn = document.getElementById('btn-export-excel');
    if (btn) {
      btn.dataset.label = btn.textContent || 'Excel';
      btn.disabled = true;
      btn.textContent = 'Excel…';
    }

    exportListener = (ev) => {
      if (ev.origin !== location.origin) return;
      if (!ev.data || ev.data.type !== EXPORT_DONE) return;
      void (async () => {
        try {
          if (ev.data.ok && ev.data.bytesBase64) {
            await openExcelInParent(ev.data.fileName || defaultExcelFileName(), ev.data.bytesBase64);
            finishExport(btn, true);
          } else {
            finishExport(btn, false, ev.data.error);
          }
        } catch (err) {
          finishExport(btn, false, err?.message || 'Excel export failed');
        }
      })();
    };
    window.addEventListener('message', exportListener);

    exportTimeout = setTimeout(() => {
      finishExport(btn, false, 'Excel export timed out');
    }, EXPORT_TIMEOUT_MS);

    exportFrame.src = appExportUrl(listType);
  }

  global.CrewHtmlFormExcel = {
    export: exportForm,
    defaultExcelFileName,
    STORAGE_KEY,
  };
})(typeof window !== 'undefined' ? window : globalThis);

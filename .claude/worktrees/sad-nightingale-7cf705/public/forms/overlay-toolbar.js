/**
 * Stamp / signature toggle buttons for HTML form editors (right side panel).
 */
(function () {
  const STAMP_ID = 'btn-overlay-stamp';
  const SIG_ID = 'btn-overlay-signature';

  const ICONS = {
    stamp:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3.5" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 13.5v2.5M15.5 13.5v2.5M6.5 16h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 7.5h6M9 10h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.65"/></svg>',
    signature:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 16.5c3.5-1.5 6.5-5.5 10.5-7.5 2.2-1.1 4.5-1 6.5 1.2-1.2 3.2-4.2 5.3-7.5 6.5-2.8 1-5.8 1.2-9.5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 5.5 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  function stampBtn() {
    return document.getElementById(STAMP_ID);
  }

  function sigBtn() {
    return document.getElementById(SIG_ID);
  }

  function renderToggles(mount) {
    mount.innerHTML = `
      <button type="button" id="${STAMP_ID}" class="overlay-toolbar__toggle" data-tip="Stamp" aria-label="Stamp" aria-pressed="false">${ICONS.stamp}</button>
      <button type="button" id="${SIG_ID}" class="overlay-toolbar__toggle" data-tip="Signature" aria-label="Signature" aria-pressed="false">${ICONS.signature}</button>`;
  }

  function init(options) {
    const mount = document.getElementById('overlay-toolbar-toggles');
    if (!mount || mount.dataset.initialized === '1') return;
    mount.dataset.initialized = '1';

    const onStampChange = options?.onStampChange;
    const onSigChange = options?.onSigChange;

    renderToggles(mount);

    stampBtn()?.addEventListener('click', () => {
      const next = stampBtn().getAttribute('aria-pressed') !== 'true';
      CrewOverlayToolbar.setStampOn(next);
      if (onStampChange) onStampChange(next);
    });

    sigBtn()?.addEventListener('click', () => {
      const next = sigBtn().getAttribute('aria-pressed') !== 'true';
      CrewOverlayToolbar.setSigOn(next);
      if (onSigChange) onSigChange(next);
    });
  }

  window.CrewOverlayToolbar = {
    init,
    isStampOn() {
      const btn = stampBtn();
      if (btn) return btn.getAttribute('aria-pressed') === 'true';
      return document.getElementById('stamp-container')?.classList.contains('visible') ?? false;
    },
    isSigOn() {
      const btn = sigBtn();
      if (btn) return btn.getAttribute('aria-pressed') === 'true';
      return document.getElementById('sig-container')?.classList.contains('visible') ?? false;
    },
    setStampOn(on) {
      stampBtn()?.setAttribute('aria-pressed', on ? 'true' : 'false');
    },
    setSigOn(on) {
      sigBtn()?.setAttribute('aria-pressed', on ? 'true' : 'false');
    },
  };
})();

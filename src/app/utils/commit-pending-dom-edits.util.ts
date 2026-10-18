/**
 * Blur the focused control so Angular (blur) handlers can commit local drafts
 * (e.g. Settings metres / draft fields) into AppData before Save or Quit flush.
 */
export async function commitPendingDomEdits(): Promise<void> {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body && typeof el.blur === 'function') {
    el.blur();
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

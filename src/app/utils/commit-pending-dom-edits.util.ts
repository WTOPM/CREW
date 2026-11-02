/**
 * Blur the focused control so Angular (blur) handlers can commit local drafts
 * (e.g. Settings metres / draft fields) into AppData before Save or Quit flush.
 * Extra hooks let panels flush signal-only drafts (A&D terminal modal, etc.).
 */

const pendingCommitHooks = new Set<() => void>();

/** Register a flush that runs before disk Quit/Save. Returns unregister. */
export function registerPendingEditCommit(hook: () => void): () => void {
  pendingCommitHooks.add(hook);
  return () => {
    pendingCommitHooks.delete(hook);
  };
}

export async function commitPendingDomEdits(): Promise<void> {
  for (const hook of pendingCommitHooks) {
    try {
      hook();
    } catch {
      /* ignore — quit/save path must continue */
    }
  }
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body && typeof el.blur === 'function') {
    el.blur();
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

import {
  AD_PALETTE_GROUPS,
  isAdPilotAction,
  isAdTugAction,
  type AdAction,
  type AdActionDisplaySort,
  type AdActionKind,
} from '../models/a-and-d.models';

export type { AdActionDisplaySort } from '../models/a-and-d.models';
export { normalizeAdActionDisplaySort } from '../models/a-and-d.models';

/** Document / palette order index (River in → … → Tug out). */
export function adActionDocumentOrder(kind: AdActionKind): number {
  let i = 0;
  for (const g of AD_PALETTE_GROUPS) {
    if (g.inKind === kind) return i;
    i += 1;
    if (g.outKind === kind) return i;
    i += 1;
  }
  return 99;
}

/** Primary event clock: pilot onboarding / tug start. */
export function adActionPrimaryDateTime(action: AdAction): string {
  if (isAdPilotAction(action)) return action.onboarding;
  if (isAdTugAction(action)) return action.start;
  return '';
}

/**
 * Sort key in ms when both date and time are set; otherwise null
 * (incomplete blocks stay at the end and do not jump).
 */
export function adActionSortMs(action: AdAction): number | null {
  const raw = adActionPrimaryDateTime(action).trim();
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(raw);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:00`);
  return Number.isFinite(ms) ? ms : null;
}

/** Display order only — never mutate the stored `term.actions` array. */
export function sortAdActionsForDisplay(
  actions: readonly AdAction[],
  mode: AdActionDisplaySort,
): AdAction[] {
  const list = actions.slice();
  if (mode === 'document') {
    return list.sort(
      (a, b) => adActionDocumentOrder(a.kind) - adActionDocumentOrder(b.kind),
    );
  }

  return list.sort((a, b) => {
    const ma = adActionSortMs(a);
    const mb = adActionSortMs(b);
    const aReady = ma != null;
    const bReady = mb != null;
    if (aReady && bReady && ma !== mb) return ma! - mb!;
    if (aReady && !bReady) return -1;
    if (!aReady && bReady) return 1;
    return adActionDocumentOrder(a.kind) - adActionDocumentOrder(b.kind);
  });
}

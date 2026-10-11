import type { DgUnifeederRow } from '../models/dg-unifeeder.models';

/** Flash point text for Remarks (°C spelling). */
export function formatRemarksFlashPoint(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.replace(/\s*°\s*C\s*$/i, ' C').replace(/\s*°C$/i, ' C');
}

export function remarksLqLabel(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v || v === 'NO' || v === 'N' || v === '—' || v === '--') return '';
  if (v === 'YES' || v === 'Y' || v === 'LQ') return 'LQ';
  return value.trim();
}

export function remarksMpLabel(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v || v === 'NO' || v === 'N') return '';
  if (v === 'YES' || v === 'Y' || v === 'MP') return 'MP';
  return value.trim();
}

export interface RemarksParts {
  flashPoint: string;
  lq: string;
  mp: string;
}

export function resolveRemarksParts(
  data: Pick<DgUnifeederRow, 'flashPoint' | 'lq' | 'marinePollutant'> | undefined,
): RemarksParts {
  if (!data) return { flashPoint: '', lq: '', mp: '' };
  return {
    flashPoint: formatRemarksFlashPoint(data.flashPoint),
    lq: remarksLqLabel(data.lq),
    mp: remarksMpLabel(data.marinePollutant),
  };
}

/**
 * Column L text — same Arial bold as the rest of the row.
 * Both flags: LQ at the left edge, MP near the right (width must fit col L ≈ 10ch).
 * Wider pads overflow the Remarks border in Excel.
 */
export function formatRemarksFlagsColumn(lq: string, mp: string, width = 8): string {
  if (!lq && !mp) return '';
  if (lq && !mp) return lq;
  if (!lq && mp) return mp;
  const w = Math.max(width, lq.length + mp.length + 1);
  return lq + ' '.repeat(w - lq.length - mp.length) + mp;
}

export type RemarksFlagsAlign = 'left' | 'center' | 'right';

/**
 * LQ alone / LQ+MP → left (padded string parks MP on the right).
 * MP alone → right (same right edge as padded MP).
 */
export function remarksFlagsAlign(lq: string, mp: string): RemarksFlagsAlign {
  if (lq && mp) return 'left';
  if (mp) return 'right';
  if (lq) return 'left';
  return 'center';
}

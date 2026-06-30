import type { CrewListForm05CssBox } from '../models/document-overlay.models';
import { isCrewListForm05CssBox } from '../models/document-overlay.models';
import type { CrewSignatureRowTweak } from '../models/document-overlay.models';
import type { PdfStampBox } from './overlay-stamp-box.util';
import { isValidStampBox } from './overlay-stamp-box.util';

const A4_W_PT = 595.28;
const A4_H_PT = 842;

/** CSS overlay box is usable on the HTML Crew Effect sheet (not corner garbage). */
export function isUsableCrewEffectHtmlCssBox(box: unknown): box is CrewListForm05CssBox {
  if (!isCrewListForm05CssBox(box)) return false;
  const w = parseFloat(box.width);
  const h = parseFloat(box.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return false;
  if (box.left.endsWith('px') && box.top.endsWith('px')) {
    const l = parseFloat(box.left);
    const t = parseFloat(box.top);
    if (!Number.isFinite(l) || !Number.isFinite(t)) return false;
    return l >= 24 && t >= 40;
  }
  if (box.left.endsWith('mm') && box.top.endsWith('mm')) {
    const t = parseFloat(box.top);
    return Number.isFinite(t) && t >= 120;
  }
  return true;
}

export function sanitizeCrewEffectHtmlCssBox(box: unknown): CrewListForm05CssBox | undefined {
  if (!isUsableCrewEffectHtmlCssBox(box)) return undefined;
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

export function pdfStampBoxToCss(box: PdfStampBox): CrewListForm05CssBox {
  return {
    left: `${((box.x / A4_W_PT) * 210).toFixed(2)}mm`,
    top: `${(((A4_H_PT - box.y - box.height) / A4_H_PT) * 297).toFixed(2)}mm`,
    width: `${((box.width / A4_W_PT) * 210).toFixed(2)}mm`,
    height: `${((box.height / A4_H_PT) * 297).toFixed(2)}mm`,
  };
}

/** Read stamp/master signature box for HTML forms 01/02 — CSS only, one-time PDF convert, drop bad legacy. */
export function readCrewEffectHtmlOverlayBox(
  raw: unknown,
  opts?: { stampIsCss?: boolean; isMasterSignature?: boolean },
): CrewListForm05CssBox | undefined {
  const css = sanitizeCrewEffectHtmlCssBox(raw);
  if (css) return css;
  if (opts?.isMasterSignature && opts?.stampIsCss) return undefined;
  if (isValidStampBox(raw)) {
    return sanitizeCrewEffectHtmlCssBox(pdfStampBoxToCss(raw));
  }
  return undefined;
}

/** Per-row crew signature placement inside table cells (HTML forms 01/02). */
export function normalizeCrewSignatureCellByRow(
  raw: Record<string, unknown> | undefined,
): Record<string, CrewSignatureRowTweak> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CrewSignatureRowTweak> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || !val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const tweak: CrewSignatureRowTweak = {};
    if (typeof v['cellLeft'] === 'string' && v['cellLeft']) tweak.cellLeft = v['cellLeft'];
    if (typeof v['cellTop'] === 'string' && v['cellTop']) tweak.cellTop = v['cellTop'];
    if (typeof v['cellWidth'] === 'string' && v['cellWidth']) tweak.cellWidth = v['cellWidth'];
    if (typeof v['cellHeight'] === 'string' && v['cellHeight']) tweak.cellHeight = v['cellHeight'];
    if (Object.keys(tweak).length) out[key] = tweak;
  }
  return out;
}

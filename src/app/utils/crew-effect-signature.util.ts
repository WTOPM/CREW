import type { DocumentOverlayId } from '../models/document-overlay.models';
import type {
  CrewSignatureRowTweak,
  CrewEffectStampOptions,
} from '../models/document-overlay.models';
import type { PdfStampBox } from './overlay-stamp-box.util';
import {
  CREW_EFFECT_ROW_COUNT,
  crewEffectRowPdfLibY,
} from '../services/crew-effect-field-positions';
import {
  CREW_EFFECT_02_ROW_COUNT,
  crewEffect02RowPdfLibY,
} from '../services/crew-effect-02-field-positions';
import {
  CREW_EFFECT_03_ROW_COUNT,
  crewEffect03RowPdfLibY,
} from '../services/crew-effect-03-field-positions';

export type CrewEffectOverlayId = 'crewEffect' | 'crewEffect02' | 'crewEffect03';

export interface CrewEffectSignatureFormConfig {
  rowCount: number;
  rowY: (rowIndex: number) => number;
  defaultBase: PdfStampBox;
}

const SIGNATURE_BOX_HEIGHT = 14;
const SIGNATURE_BOX_WIDTH = 50;

function baseForRow(rowY: (i: number) => number, x: number): PdfStampBox {
  const y0 = rowY(0);
  return {
    x,
    y: y0 - SIGNATURE_BOX_HEIGHT / 2,
    width: SIGNATURE_BOX_WIDTH,
    height: SIGNATURE_BOX_HEIGHT,
  };
}

/** pdf-lib box from measured cell center (pt, origin bottom-left). */
function baseFromCenter(cx: number, cy: number): PdfStampBox {
  return {
    x: cx - SIGNATURE_BOX_WIDTH / 2,
    y: cy - SIGNATURE_BOX_HEIGHT / 2,
    width: SIGNATURE_BOX_WIDTH,
    height: SIGNATURE_BOX_HEIGHT,
  };
}

export const CREW_EFFECT_SIGNATURE_FORM_CONFIG: Record<
  CrewEffectOverlayId,
  CrewEffectSignatureFormConfig
> = {
  crewEffect: {
    rowCount: CREW_EFFECT_ROW_COUNT,
    rowY: crewEffectRowPdfLibY,
    /** Row 1 Signature cell center — user-measured on form 01. */
    defaultBase: baseFromCenter(496, 647),
  },
  crewEffect02: {
    rowCount: CREW_EFFECT_02_ROW_COUNT,
    rowY: crewEffect02RowPdfLibY,
    defaultBase: baseForRow(crewEffect02RowPdfLibY, 478),
  },
  crewEffect03: {
    rowCount: CREW_EFFECT_03_ROW_COUNT,
    rowY: crewEffect03RowPdfLibY,
    defaultBase: baseForRow(crewEffect03RowPdfLibY, 455),
  },
};

export function crewEffectSignatureFormConfig(
  documentId: CrewEffectOverlayId,
): CrewEffectSignatureFormConfig {
  return CREW_EFFECT_SIGNATURE_FORM_CONFIG[documentId];
}

export function isCrewEffectOverlayId(id: DocumentOverlayId): id is CrewEffectOverlayId {
  return id === 'crewEffect' || id === 'crewEffect02' || id === 'crewEffect03';
}

/** Resolve placement box for a table row (0-based), relative to row-0 base + per-row tweak. */
export function resolveCrewSignatureBox(
  base: PdfStampBox,
  baseRowY: number,
  rowY: number,
  tweak?: CrewSignatureRowTweak,
): PdfStampBox {
  const yShift = rowY - baseRowY;
  return {
    x: base.x + (tweak?.offsetX ?? 0),
    y: base.y + yShift + (tweak?.offsetY ?? 0),
    width: tweak?.width ?? base.width,
    height: tweak?.height ?? base.height,
  };
}

export function crewEffectSignatureBase(
  options: CrewEffectStampOptions,
  documentId: CrewEffectOverlayId,
): PdfStampBox {
  return options.crewSignatureBase ?? CREW_EFFECT_SIGNATURE_FORM_CONFIG[documentId].defaultBase;
}

export function normalizeCrewSignatureByRow(
  raw: Record<string, unknown> | undefined,
): Record<string, CrewSignatureRowTweak> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CrewSignatureRowTweak> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || !val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const tweak: CrewSignatureRowTweak = {};
    if (typeof v['offsetX'] === 'number' && Number.isFinite(v['offsetX']))
      tweak.offsetX = v['offsetX'];
    if (typeof v['offsetY'] === 'number' && Number.isFinite(v['offsetY']))
      tweak.offsetY = v['offsetY'];
    if (typeof v['width'] === 'number' && (v['width'] as number) > 0)
      tweak.width = v['width'] as number;
    if (typeof v['height'] === 'number' && (v['height'] as number) > 0)
      tweak.height = v['height'] as number;
    if (Object.keys(tweak).length) out[key] = tweak;
  }
  return out;
}

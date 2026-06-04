/**
 * NIL List — pdf-lib coords (origin bottom-left). Baselines from NIL List.pdf (pdf.js top-Y).
 */

import { NIL_LIST_PAGE_HEIGHT_PT } from '../models/nil-list.models';

export const NIL_LIST_FONT_HEADER = 11;
export const NIL_LIST_FONT_PHRASE = 11;

export interface NilListTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return NIL_LIST_PAGE_HEIGHT_PT - baselineY;
}

export const NIL_LIST_FIELDS = {
  vessel: { x: 149, y: pdfLibY(188), fontSize: 12, maxWidth: 120 },
  port: { x: 357, y: pdfLibY(188), fontSize: 10, maxWidth: 120 },
  portOfRegistry: { x: 149, y: pdfLibY(202), fontSize: 11, maxWidth: 120 },
  date: { x: 344, y: pdfLibY(202), fontSize: 10, maxWidth: 80 },
  masterName: { x: 332, y: pdfLibY(586), fontSize: 11, maxWidth: 200 },
} as const satisfies Record<string, NilListTextPlacement>;

export const NIL_LIST_PHRASE_X = 102;
export const NIL_LIST_PHRASE_MAX_WIDTH = 450;

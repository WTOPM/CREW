import type { CoordBox } from './crew-list-coordinates';
import { BODY_BOTTOM_Y, CREW_LIST_SRC } from './crew-list-coordinates';

/** Table edges (source coords). */
export const PAX_V2_TABLE_X1 = CREW_LIST_SRC.minX;
export const PAX_V2_TABLE_X2 = 2169;

/** Place of birth body column — narrowed to widen column 6. */
export const PAX_V2_PLACE_OF_BIRTH_X1 = 1490;
export const PAX_V2_PLACE_OF_BIRTH_X2 = 1780;

/** Column 6 — passport / ID (left) and expiry date (right). */
export const PAX_V2_COL6_X1 = PAX_V2_PLACE_OF_BIRTH_X2;
export const PAX_V2_COL6_X2 = 2169;
/** Equal-width sub-columns under field 6. */
export const PAX_V2_COL6_SPLIT_X = Math.round((PAX_V2_COL6_X1 + PAX_V2_COL6_X2) / 2);

/** Main title above; sub-headers (Passport / Expiry) below this Y. */
export const PAX_V2_COL6_HEADER_DIVIDER_Y = 379;

/** Field 11 header ends here (date + place of birth). */
export const PAX_V2_BIRTH_HEADER_X2 = PAX_V2_PLACE_OF_BIRTH_X2;

export const PAX_V2_FIELD6_MAIN_LABEL = '6.   Nature and No. of identity document';

export const PAX_V2_COL6_SUBLABELS = {
  docTypeLine1: 'Passport /',
  docTypeLine2: 'ID CARD',
  expiry: 'Expiry Date',
} as const;

/** Sub-header “Passport /” baseline (source Y, top-left origin). */
export const PAX_V2_PASSPORT_LABEL_Y1 = 403;
/** Line gap for “ID CARD” below Passport / (pt in PDF space). */
export const PAX_V2_PASSPORT_LABEL_LINE_STEP_PT = 8;

/** Field 12 — date and master (source Y = table bottom + offset). */
export const PAX_V2_FOOTER_Y_OFFSET = 149;

export const PAX_V2_FOOTER = {
  /** Date — under “Date” in field 12. */
  signatureDate: { x: 415, y: BODY_BOTTOM_Y + PAX_V2_FOOTER_Y_OFFSET },
  /** Static label before master name. */
  masterLabel: { x: 1180, y: BODY_BOTTOM_Y + PAX_V2_FOOTER_Y_OFFSET, text: 'Master:' },
  /** Master name — near the right edge of the form. */
  masterName: {
    x: PAX_V2_TABLE_X2,
    y: BODY_BOTTOM_Y + PAX_V2_FOOTER_Y_OFFSET,
    maxWidth: 280,
    align: 'right' as const,
  },
} as const;

const PAX_V2_BOX_OVERRIDES: Record<string, Partial<Pick<CoordBox, 'x1' | 'x2'>>> = {
  '12': { x2: PAX_V2_COL6_X1 },
  '13': { x2: PAX_V2_BIRTH_HEADER_X2 },
  '14': { x1: PAX_V2_COL6_X1 },
  '20': { x2: PAX_V2_PLACE_OF_BIRTH_X2 },
  '21': { x1: PAX_V2_COL6_X1 },
};

export function paxV2LayoutBox(box: CoordBox): CoordBox {
  const patch = PAX_V2_BOX_OVERRIDES[box.id];
  return patch ? { ...box, ...patch } : box;
}

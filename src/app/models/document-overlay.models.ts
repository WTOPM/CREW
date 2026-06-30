import type { PdfStampBox } from '../utils/overlay-stamp-box.util';
import { isValidStampBox } from '../utils/overlay-stamp-box.util';

/** Per-row size/position tweak for Crew Effect crew signatures (relative to base box). */
export interface CrewSignatureRowTweak {
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

/** Crew Effect forms — stamp/signature plus per-crew row signatures and HTML cell overrides. */
export interface CrewEffectStampOptions extends DocumentStampOptions {
  /** Draw uploaded crew member signatures in table Signature cells (pdf-lib forms 02/03). */
  useCrewSignatures?: boolean;
  /** Base placement for row 1 (index 0); other rows follow row Y + optional tweak. */
  crewSignatureBase?: PdfStampBox;
  /** Row index (0-based string key) → offset/size tweak. */
  crewSignatureByRow?: Record<string, CrewSignatureRowTweak>;
  /** Form 01 HTML editor — per-cell font/alignment. */
  cellStyles?: Record<
    string,
    { fontFamily?: string; fontSize?: string; textAlign?: string; verticalAlign?: string }
  >;
  /** Form 01 HTML editor — user-edited cell text (h-*, d-{row}-{col}, footer-date, footer-master). */
  cellValues?: Record<string, string>;
}

/** Per-document PDF overlay toggles (stamp / signature) and placement. */
export interface DocumentStampOptions {
  /** Page 1 (form). */
  useStamp: boolean;
  useSignature: boolean;
  /** Page 2+ (attachment) — MDH and Germany 2-page forms. */
  useStampAttachment?: boolean;
  useSignatureAttachment?: boolean;
  /** Stamp/signature rotation: 0, 90, 180, 270 degrees. */
  overlayRotation?: number;
  /** Stamp anchor on page (pdf-lib pt, origin bottom-left). */
  stampBox?: PdfStampBox;
  /** Signature area (optional; otherwise derived from stamp). */
  signatureBox?: PdfStampBox;
  /** Page 2+ (attachment) — also used by Germany 2-page forms. */
  overlayRotationAttachment?: number;
  stampBoxAttachment?: PdfStampBox;
  signatureBoxAttachment?: PdfStampBox;
}

/** HTML form editors — date display in cells (dot / short month / full month). */
export type HtmlFormDateDisplayFormat = 'dot' | 'shortMonth' | 'fullMonth' | 'isoSlash';

/** HTML Ship Stores forms 01 & 02 — stamp/signature CSS placement + cell overrides. */
export interface ShipStoresHtmlFormStampOptions
  extends Omit<DocumentStampOptions, 'stampBox' | 'signatureBox'> {
  cellStyles?: Record<
    string,
    { fontFamily?: string; fontSize?: string; textAlign?: string; verticalAlign?: string }
  >;
  cellValues?: Record<string, string>;
  stampBox?: PdfStampBox | CrewListForm05CssBox;
  signatureBox?: PdfStampBox | CrewListForm05CssBox;
}

/** HTML Port of Call forms (01 list / 02 security) — stamp, cell styles, rows per page. */
export interface PortOfCallHtmlFormStampOptions extends DocumentStampOptions {
  cellStyles?: Record<
    string,
    { fontFamily?: string; fontSize?: string; textAlign?: string; verticalAlign?: string }
  >;
  /** User-edited cell text (keys: h-* header, d-{globalRow}-{col} data rows). */
  cellValues?: Record<string, string>;
  /** Data rows rendered on each PDF page (editor +/- row buttons). Default 11. */
  rowsPerPage?: number;
  /** Footer field 15 date (DD.MM.YYYY). */
  footerSignatureDate?: string;
  /** Footer master name override. */
  footerMasterName?: string;
  /** How dates are shown in this form editor / PDF (Port of Call only). */
  dateDisplayFormat?: HtmlFormDateDisplayFormat;
}

/** HTML passenger list forms — stamp/signature, cell styles, footer date. */
export interface PaxHtmlFormStampOptions extends DocumentStampOptions {
  cellStyles?: Record<
    string,
    { fontFamily?: string; fontSize?: string; textAlign?: string; verticalAlign?: string }
  >;
  footerSignatureDate?: string;
  footerMasterName?: string;
}

/** Whether stamp is enabled for the given page (page 1 vs attachment). */
export function documentUsesStamp(options: DocumentStampOptions, attachmentPage: boolean): boolean {
  return attachmentPage ? Boolean(options.useStampAttachment) : options.useStamp;
}

/** Whether signature is enabled for the given page. */
export function documentUsesSignature(
  options: DocumentStampOptions,
  attachmentPage: boolean,
): boolean {
  return attachmentPage ? Boolean(options.useSignatureAttachment) : options.useSignature;
}

/** Stamp prefs that may store HTML editor CSS boxes instead of pdf-lib pt boxes. */
export type HtmlAwareStampOptions = {
  useStamp: boolean;
  useSignature: boolean;
  useStampAttachment?: boolean;
  useSignatureAttachment?: boolean;
  overlayRotation?: number;
  overlayRotationAttachment?: number;
  stampBox?: PdfStampBox | CrewListForm05CssBox;
  signatureBox?: PdfStampBox | CrewListForm05CssBox;
  stampBoxAttachment?: PdfStampBox | CrewListForm05CssBox;
  signatureBoxAttachment?: PdfStampBox | CrewListForm05CssBox;
};

/** pdf-lib overlay paths — CSS HTML boxes are ignored (HTML forms render overlays separately). */
export function asPdfStampOptions(options: HtmlAwareStampOptions): DocumentStampOptions {
  const out: DocumentStampOptions = {
    useStamp: options.useStamp,
    useSignature: options.useSignature,
    useStampAttachment: options.useStampAttachment,
    useSignatureAttachment: options.useSignatureAttachment,
    ...(typeof options.overlayRotation === 'number' ? { overlayRotation: options.overlayRotation } : {}),
    ...(typeof options.overlayRotationAttachment === 'number'
      ? { overlayRotationAttachment: options.overlayRotationAttachment }
      : {}),
    ...(isValidStampBox(options.stampBox) ? { stampBox: { ...options.stampBox } } : {}),
    ...(isValidStampBox(options.stampBoxAttachment)
      ? { stampBoxAttachment: { ...options.stampBoxAttachment } }
      : {}),
    ...(isValidStampBox(options.signatureBox) ? { signatureBox: { ...options.signatureBox } } : {}),
    ...(isValidStampBox(options.signatureBoxAttachment)
      ? { signatureBoxAttachment: { ...options.signatureBoxAttachment } }
      : {}),
  };
  return out;
}

export function documentPageUsesOverlay(
  options: DocumentStampOptions,
  attachmentPage: boolean,
): boolean {
  return (
    documentUsesStamp(options, attachmentPage) || documentUsesSignature(options, attachmentPage)
  );
}

/** Active crew list variant (only one at a time). */
export type CrewListTypeId =
  | 'type1Passport'      // 01 - IMO CREW LIST - P
  | 'type1SeamansBook'   // 02 - IMO CREW LIST - SBK
  | 'type2Alger'         // 03 - IMO CREW LIST - P SBK J T   ← HTML form (forms/crew-list-form-03/)
  | 'type3V2'            // 04 - CREW LIST - P E PI G   ← HTML form (forms/crew-list-form-04/)
  | 'type4V3Sbk'         // 05 - CREW LIST - SBK E          ← HTML form (forms/crew-list-form-05/)
  | 'type5V3SbkP'        // 06 - CREW LIST - SBK PI E P J   ← HTML form (forms/crew-list-form-06/)
  | 'type6V3SbkP2';      // 07 - CREW LIST - SBK PI E P PI E   ← HTML form (forms/crew-list-form-07/)

/** Named constants for crew list form numbers (for readable code). */
export const CREW_FORM_01 = 'type1Passport'    as const satisfies CrewListTypeId;
export const CREW_FORM_02 = 'type1SeamansBook' as const satisfies CrewListTypeId;
export const CREW_FORM_03 = 'type2Alger'       as const satisfies CrewListTypeId;
export const CREW_FORM_04 = 'type3V2'          as const satisfies CrewListTypeId;
/** Form 05 - CREW LIST [SBK][E] — HTML editor (`public/forms/crew-list-form-05/`), arrival/departure */
export const CREW_FORM_05 = 'type4V3Sbk'       as const satisfies CrewListTypeId;
export const CREW_FORM_06 = 'type5V3SbkP'      as const satisfies CrewListTypeId;
export const CREW_FORM_07 = 'type6V3SbkP2'     as const satisfies CrewListTypeId;

/** Stamp/signature placement bucket (Type 1 passport & seaman's book share one layout). */
export type CrewListPlacementKey =
  | 'type1'
  | 'type2Alger'
  | 'type3V2'
  | 'type4V3Sbk'
  | 'type5V3SbkP'
  | 'type6V3SbkP2';

export const CREW_LIST_PLACEMENT_KEYS: readonly CrewListPlacementKey[] = [
  'type1',
  'type2Alger',
  'type3V2',
  'type4V3Sbk',
  'type5V3SbkP',
  'type6V3SbkP2',
];

export function crewListPlacementKey(listType: CrewListTypeId): CrewListPlacementKey {
  if (listType === 'type2Alger') return 'type2Alger';
  if (listType === 'type3V2') return 'type3V2';
  if (listType === 'type4V3Sbk') return 'type4V3Sbk';
  if (listType === 'type5V3SbkP') return 'type5V3SbkP';
  if (listType === 'type6V3SbkP2') return 'type6V3SbkP2';
  return 'type1';
}

/** Form 05 HTML editor overlay — CSS placement on `.main-content` (not pdf-lib pt). */
export interface CrewListForm05CssBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

/** Per crew-list document variant: stamp toggles + placement. */
export interface CrewListVariantSettings {
  useStamp: boolean;
  useSignature: boolean;
  overlayRotation?: number;
  /** pdf-lib box for PDF templates; Form 05 uses {@link CrewListForm05CssBox}. */
  stampBox?: PdfStampBox | CrewListForm05CssBox;
  signatureBox?: PdfStampBox | CrewListForm05CssBox;
  cellStyles?: Record<string, { fontFamily?: string; fontSize?: string; textAlign?: string }>;
  /** Form 05 — editable date under table (field 12), aligned with column c2. */
  footerSignatureDate?: string;
  /** Footer master name override. */
  footerMasterName?: string;
}

export function isCrewListForm05CssBox(box: unknown): box is CrewListForm05CssBox {
  if (!box || typeof box !== 'object') return false;
  const b = box as CrewListForm05CssBox;
  return (
    typeof b.left === 'string' &&
    typeof b.top === 'string' &&
    typeof b.width === 'string' &&
    typeof b.height === 'string'
  );
}

/** Stamp/signature placement bucket (legacy — Type 1 passport & seaman's book shared one layout). */
export interface CrewListVariantPlacement {
  overlayRotation?: number;
  stampBox?: PdfStampBox;
  signatureBox?: PdfStampBox;
}

/** Display order for crew list variants (settings, packages, toasts). */
export const CREW_LIST_TYPE_IDS: readonly CrewListTypeId[] = [
  'type1Passport',
  'type1SeamansBook',
  'type2Alger',
  'type3V2',
  'type4V3Sbk',
  'type5V3SbkP',
  'type6V3SbkP2',
];

/** Base name without order prefix (e.g. «IMO CREW LIST - P»). */
export const CREW_LIST_TYPE_NAMES: Record<CrewListTypeId, string> = {
  type1Passport: 'IMO CREW LIST - P',
  type1SeamansBook: 'IMO CREW LIST - SBK',
  type2Alger: 'IMO CREW LIST - P SBK J T',
  type3V2: 'CREW LIST - P E PI G',
  type4V3Sbk: 'CREW LIST - SBK E',
  type5V3SbkP: 'CREW LIST - SBK PI E P J',
  type6V3SbkP2: 'CREW LIST - SBK PI E P PI E',
};

export function crewListTypeOrderNo(type: CrewListTypeId): string {
  const index = CREW_LIST_TYPE_IDS.indexOf(type);
  return String(index + 1).padStart(2, '0');
}

/** Full label with order prefix (e.g. «01 - IMO CREW LIST - P»). */
export const CREW_LIST_TYPE_LABELS: Record<CrewListTypeId, string> = Object.fromEntries(
  CREW_LIST_TYPE_IDS.map((id) => [id, `${crewListTypeOrderNo(id)} - ${CREW_LIST_TYPE_NAMES[id]}`]),
) as Record<CrewListTypeId, string>;

export interface CrewListTypeOptionLabel {
  prefix: string;
  abbrs: readonly string[];
}

/** Settings UI: text prefix + colored abbreviation chips. */
export const CREW_LIST_TYPE_OPTION_LABELS: Record<CrewListTypeId, CrewListTypeOptionLabel> = {
  type1Passport: { prefix: 'IMO CREW LIST - ', abbrs: ['P'] },
  type1SeamansBook: { prefix: 'IMO CREW LIST - ', abbrs: ['SBK'] },
  type2Alger: { prefix: 'IMO CREW LIST - ', abbrs: ['P', 'SBK', 'J', 'T'] },
  type3V2: { prefix: 'CREW LIST - ', abbrs: ['P', 'E', 'PI', 'G'] },
  type4V3Sbk: { prefix: 'CREW LIST - ', abbrs: ['SBK', 'E'] },
  type5V3SbkP: { prefix: 'CREW LIST - ', abbrs: ['SBK', 'PI', 'E', 'P', 'J'] },
  type6V3SbkP2: { prefix: 'CREW LIST - ', abbrs: ['SBK', 'PI', 'E', 'P', 'PI', 'E'] },
};

export interface CrewListFieldAbbreviation {
  abbr: string;
  label: string;
  /** Gradient top (lighter face). */
  top: string;
  /** Gradient bottom (darker face). */
  bottom: string;
  /** Cube edge / shadow color. */
  edge: string;
}

/** Legend shown in Crew list settings — field shorthand used in layout chat. */
export const CREW_LIST_FIELD_ABBREVIATIONS: readonly CrewListFieldAbbreviation[] = [
  { abbr: 'P', top: '#3b82f6', bottom: '#2563eb', edge: '#1d4ed8', label: 'PASSPORT' },
  { abbr: 'SBK', top: '#fb923c', bottom: '#ea580c', edge: '#c2410c', label: "SEAMAN'S BOOK" },
  { abbr: 'PI', top: '#22d3ee', bottom: '#0891b2', edge: '#0e7490', label: 'PLACE OF ISSUE' },
  { abbr: 'G', top: '#f472b6', bottom: '#db2777', edge: '#be185d', label: 'GENDER' },
  { abbr: 'E', top: '#f87171', bottom: '#dc2626', edge: '#b91c1c', label: 'EXPIRY' },
  { abbr: 'J', top: '#4ade80', bottom: '#16a34a', edge: '#15803d', label: 'JOINED PORT AND DATE' },
  { abbr: 'T', top: '#a78bfa', bottom: '#7c3aed', edge: '#6d28d9', label: 'TEMPERATURE' },
];

export const CREW_LIST_FIELD_ABBREVIATIONS_BY_ABBR: Readonly<
  Record<string, CrewListFieldAbbreviation>
> = Object.fromEntries(CREW_LIST_FIELD_ABBREVIATIONS.map((item) => [item.abbr, item]));

/** Which variant is selected in Crew list settings (for editing). */
export interface CrewListDocumentPrefs {
  listType: CrewListTypeId;
  /** Independent stamp/signature settings per document variant. */
  byType: Partial<Record<CrewListTypeId, CrewListVariantSettings>>;
}

/** Fields accepted when updating crew list overlay (applies to active {@link CrewListDocumentPrefs.listType}). */
export type CrewListOverlayUpdate = Partial<
  Pick<CrewListDocumentPrefs, 'listType'> & CrewListVariantSettings
>;

export function defaultCrewListVariantSettings(): CrewListVariantSettings {
  return { useStamp: false, useSignature: false };
}

export function getCrewListVariantSettings(
  prefs: CrewListDocumentPrefs,
  listType: CrewListTypeId = prefs.listType,
): CrewListVariantSettings {
  return {
    ...defaultCrewListVariantSettings(),
    ...prefs.byType?.[listType],
  };
}

const CREW_LIST_VARIANT_FIELD_NAMES = [
  'useStamp',
  'useSignature',
  'overlayRotation',
  'stampBox',
  'signatureBox',
  'cellStyles',
  'footerSignatureDate',
  'footerMasterName',
] as const satisfies readonly (keyof CrewListVariantSettings)[];

function mergeCrewListVariantPlacement(
  ...sources: (Partial<CrewListVariantPlacement> | undefined)[]
): CrewListVariantPlacement | undefined {
  const out: CrewListVariantPlacement = {};
  for (const src of sources) {
    if (!src) continue;
    if (typeof src.overlayRotation === 'number') {
      out.overlayRotation = src.overlayRotation;
    }
    if (src.stampBox) out.stampBox = { ...src.stampBox };
    if (src.signatureBox) out.signatureBox = { ...src.signatureBox };
  }
  return out.overlayRotation != null || out.stampBox || out.signatureBox ? out : undefined;
}

/** Migrate legacy flat stampBox on crewList into per-template buckets. */
export function normalizeCrewListByPlacement(
  raw: Partial<Record<CrewListPlacementKey, Partial<CrewListVariantPlacement>>> | undefined,
  legacy?: CrewListVariantPlacement,
): Partial<Record<CrewListPlacementKey, CrewListVariantPlacement>> {
  const out: Partial<Record<CrewListPlacementKey, CrewListVariantPlacement>> = {};
  for (const key of CREW_LIST_PLACEMENT_KEYS) {
    const merged = mergeCrewListVariantPlacement(legacy, raw?.[key]);
    if (merged) out[key] = merged;
  }
  if (legacy && !out.type1) {
    out.type1 = { ...legacy };
  }
  return out;
}

/** Resolved stamp options for a crew list variant (preview + PDF). */
export function resolveCrewListStampOptions(
  prefs: CrewListDocumentPrefs,
  listType: CrewListTypeId = prefs.listType,
): DocumentStampOptions {
  const variant = getCrewListVariantSettings(prefs, listType);
  return {
    useStamp: variant.useStamp,
    useSignature: variant.useSignature,
    ...(variant.overlayRotation != null ? { overlayRotation: variant.overlayRotation } : {}),
    ...(isValidStampBox(variant.stampBox) ? { stampBox: { ...variant.stampBox } } : {}),
    ...(isValidStampBox(variant.signatureBox) ? { signatureBox: { ...variant.signatureBox } } : {}),
  };
}

export function crewListVariantPatch(
  partial: CrewListOverlayUpdate,
): Partial<CrewListVariantSettings> | null {
  const patch: Partial<CrewListVariantSettings> = {};
  for (const field of CREW_LIST_VARIANT_FIELD_NAMES) {
    if (field in partial) {
      (patch as Record<string, unknown>)[field] = partial[field];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** @deprecated Use {@link crewListVariantPatch}. */
export function crewListPlacementPatch(
  partial: CrewListOverlayUpdate,
): Partial<CrewListVariantPlacement> | null {
  const patch: Partial<CrewListVariantPlacement> = {};
  for (const field of ['overlayRotation', 'stampBox', 'signatureBox'] as const) {
    if (field in partial) {
      (patch as Record<string, unknown>)[field] = partial[field];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Normalize saved crew list prefs (migrates legacy shared toggles/placement). */
export function normalizeCrewListDocumentPrefs(
  raw:
    | (Partial<CrewListDocumentPrefs> & {
        useStamp?: boolean;
        useSignature?: boolean;
        overlayRotation?: number;
        stampBox?: PdfStampBox;
        signatureBox?: PdfStampBox;
        byPlacement?: Partial<Record<CrewListPlacementKey, Partial<CrewListVariantPlacement>>>;
        type1Passport?: boolean;
        type1SeamansBook?: boolean;
      })
    | undefined,
): CrewListDocumentPrefs {
  const listType = normalizeCrewListType(raw ?? {});
  const legacyPlacement = mergeCrewListVariantPlacement({
    overlayRotation: raw?.overlayRotation,
    stampBox: raw?.stampBox,
    signatureBox: raw?.signatureBox,
  });
  const byPlacement = normalizeCrewListByPlacement(raw?.byPlacement, legacyPlacement);
  const legacyToggles = {
    useStamp: raw?.useStamp ?? false,
    useSignature: raw?.useSignature ?? false,
  };

  const byType: Partial<Record<CrewListTypeId, CrewListVariantSettings>> = {};
  for (const id of CREW_LIST_TYPE_IDS) {
    const placement = byPlacement[crewListPlacementKey(id)];
    byType[id] = {
      ...defaultCrewListVariantSettings(),
      ...legacyToggles,
      ...placement,
      ...raw?.byType?.[id],
    };
  }

  return { listType, byType };
}

/** Keys match document menu Settings modals. */
export type DocumentOverlayId =
  | 'crewList'
  | 'pax'
  | 'paxV2'
  | 'portOfCall'
  | 'portsOfCall'
  | 'mdh'
  | 'crewVaccine'
  | 'shipStores'
  | 'shipStores02'
  | 'shipStores03'
  | 'crewEffect'
  | 'crewEffect02'
  | 'crewEffect03'
  | 'nilList'
  | 'shipMoney'
  | 'cashAdvance'
  | 'crewMoney'
  | 'narcoticList'
  | 'sso0108PortCalls';

export type ShipAssetKind = 'stamp' | 'signature';

export interface DocumentOverlayPrefs {
  crewList: CrewListDocumentPrefs;
  pax: PaxHtmlFormStampOptions;
  paxV2: PaxHtmlFormStampOptions;
  portOfCall: PortOfCallHtmlFormStampOptions;
  portsOfCall: PortOfCallHtmlFormStampOptions;
  mdh: DocumentStampOptions;
  crewVaccine: DocumentStampOptions;
  shipStores: ShipStoresHtmlFormStampOptions;
  shipStores02: ShipStoresHtmlFormStampOptions;
  shipStores03: DocumentStampOptions;
  crewEffect: CrewEffectStampOptions;
  crewEffect02: CrewEffectStampOptions;
  crewEffect03: CrewEffectStampOptions;
  nilList: DocumentStampOptions;
  shipMoney: DocumentStampOptions;
  cashAdvance: DocumentStampOptions;
  crewMoney: DocumentStampOptions;
  narcoticList: DocumentStampOptions;
  sso0108PortCalls: DocumentStampOptions;
}

export interface ShipAssetsMeta {
  hasStamp: boolean;
  hasSignature: boolean;
  stampFileName: string;
  signatureFileName: string;
}

const DEFAULT_STAMP_OPTS: DocumentStampOptions = {
  useStamp: false,
  useSignature: false,
  useStampAttachment: false,
  useSignatureAttachment: false,
};

export function createDefaultCrewListPrefs(): CrewListDocumentPrefs {
  return normalizeCrewListDocumentPrefs({ listType: 'type1Passport' });
}

/** Migrate saved data from old dual-checkbox crew list prefs. */
export function normalizeCrewListType(
  raw: Partial<CrewListDocumentPrefs> & {
    type1Passport?: boolean;
    type1SeamansBook?: boolean;
  },
): CrewListTypeId {
  if (
    raw.listType === 'type1Passport' ||
    raw.listType === 'type1SeamansBook' ||
    raw.listType === 'type2Alger' ||
    raw.listType === 'type3V2' ||
    raw.listType === 'type4V3Sbk' ||
    raw.listType === 'type5V3SbkP' ||
    raw.listType === 'type6V3SbkP2'
  ) {
    return raw.listType;
  }
  if (raw.type1SeamansBook && !raw.type1Passport) {
    return 'type1SeamansBook';
  }
  return 'type1Passport';
}

const DEFAULT_POC_HTML_OPTS: PortOfCallHtmlFormStampOptions = {
  ...DEFAULT_STAMP_OPTS,
  rowsPerPage: 11,
};

export function createDefaultDocumentOverlayPrefs(): DocumentOverlayPrefs {
  return {
    crewList: createDefaultCrewListPrefs(),
    pax: { ...DEFAULT_STAMP_OPTS },
    paxV2: { ...DEFAULT_STAMP_OPTS },
    portOfCall: { ...DEFAULT_POC_HTML_OPTS },
    portsOfCall: { ...DEFAULT_POC_HTML_OPTS },
    mdh: { ...DEFAULT_STAMP_OPTS },
    crewVaccine: { ...DEFAULT_STAMP_OPTS },
    shipStores: { ...DEFAULT_STAMP_OPTS },
    shipStores02: { ...DEFAULT_STAMP_OPTS },
    shipStores03: { ...DEFAULT_STAMP_OPTS },
    crewEffect: { ...DEFAULT_STAMP_OPTS },
    crewEffect02: { ...DEFAULT_STAMP_OPTS },
    crewEffect03: { ...DEFAULT_STAMP_OPTS },
    nilList: { ...DEFAULT_STAMP_OPTS },
    shipMoney: { ...DEFAULT_STAMP_OPTS },
    cashAdvance: { ...DEFAULT_STAMP_OPTS },
    crewMoney: { ...DEFAULT_STAMP_OPTS },
    narcoticList: { ...DEFAULT_STAMP_OPTS },
    sso0108PortCalls: { ...DEFAULT_STAMP_OPTS },
  };
}

export function createEmptyShipAssetsMeta(): ShipAssetsMeta {
  return {
    hasStamp: false,
    hasSignature: false,
    stampFileName: '',
    signatureFileName: '',
  };
}

export const DOCUMENT_OVERLAY_LABELS: Record<DocumentOverlayId, string> = {
  crewList: 'Crew list',
  pax: '01 - PAX - P ID',
  paxV2: '02 - PAX P ID E',
  portOfCall: '01 - Port of Call',
  portsOfCall: '02 - Port of Call - Security',
  mdh: 'MDH',
  crewVaccine: 'Crew Vaccine',
  shipStores: '01 - Ship Stores - Short',
  shipStores02: '02 - Ship Stores - Long',
  shipStores03: '03 - Ship Stores - Germany',
  crewEffect: '01 - Crew Effect',
  crewEffect02: '02 - Crew Effect',
  crewEffect03: '03 - Crew Effect - Germany',
  nilList: 'NIL List',
  shipMoney: 'Ship Money',
  cashAdvance: 'Cash Advance',
  crewMoney: 'Crew Money',
  narcoticList: 'Narcotic List',
  sso0108PortCalls: '03 - Port of Call - SSO-0108',
};

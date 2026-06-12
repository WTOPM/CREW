import type { PdfStampBox } from '../utils/overlay-stamp-box.util';

/** Per-document PDF overlay toggles (stamp / signature) and placement. */
export interface DocumentStampOptions {
  useStamp: boolean;
  useSignature: boolean;
  /** Stamp/signature rotation: 0, 90, 180, 270 degrees. */
  overlayRotation?: number;
  /** Stamp anchor on page (pdf-lib pt, origin bottom-left). */
  stampBox?: PdfStampBox;
  /** Signature area (optional; otherwise derived from stamp). */
  signatureBox?: PdfStampBox;
  /** MDH pages 2+ */
  overlayRotationAttachment?: number;
  stampBoxAttachment?: PdfStampBox;
  signatureBoxAttachment?: PdfStampBox;
}

/** Active crew list variant (only one at a time). */
export type CrewListTypeId =
  | 'type1Passport'
  | 'type1SeamansBook'
  | 'type2Alger'
  | 'type3V2'
  | 'type4V3Sbk'
  | 'type5V3SbkP'
  | 'type6V3SbkP2';

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

/** Per crew-list document variant: stamp toggles + placement. */
export interface CrewListVariantSettings {
  useStamp: boolean;
  useSignature: boolean;
  overlayRotation?: number;
  stampBox?: PdfStampBox;
  signatureBox?: PdfStampBox;
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
    ...(variant.stampBox ? { stampBox: { ...variant.stampBox } } : {}),
    ...(variant.signatureBox ? { signatureBox: { ...variant.signatureBox } } : {}),
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
  pax: DocumentStampOptions;
  paxV2: DocumentStampOptions;
  portOfCall: DocumentStampOptions;
  portsOfCall: DocumentStampOptions;
  mdh: DocumentStampOptions;
  crewVaccine: DocumentStampOptions;
  shipStores: DocumentStampOptions;
  shipStores02: DocumentStampOptions;
  shipStores03: DocumentStampOptions;
  crewEffect: DocumentStampOptions;
  crewEffect02: DocumentStampOptions;
  crewEffect03: DocumentStampOptions;
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

const DEFAULT_STAMP_OPTS: DocumentStampOptions = { useStamp: false, useSignature: false };

export function createDefaultCrewListPrefs(): CrewListDocumentPrefs {
  return normalizeCrewListDocumentPrefs({ listType: 'type1Passport' });
}

/** Migrate saved data from old dual-checkbox crew list prefs. */
export function normalizeCrewListType(raw: Partial<CrewListDocumentPrefs> & {
  type1Passport?: boolean;
  type1SeamansBook?: boolean;
}): CrewListTypeId {
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

export function createDefaultDocumentOverlayPrefs(): DocumentOverlayPrefs {
  return {
    crewList: createDefaultCrewListPrefs(),
    pax: { ...DEFAULT_STAMP_OPTS },
    paxV2: { ...DEFAULT_STAMP_OPTS },
    portOfCall: { ...DEFAULT_STAMP_OPTS },
    portsOfCall: { ...DEFAULT_STAMP_OPTS },
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

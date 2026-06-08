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
  | 'type5V3SbkP';

/** Stamp/signature placement bucket (Type 1 passport & seaman's book share one layout). */
export type CrewListPlacementKey =
  | 'type1'
  | 'type2Alger'
  | 'type3V2'
  | 'type4V3Sbk'
  | 'type5V3SbkP';

export const CREW_LIST_PLACEMENT_KEYS: readonly CrewListPlacementKey[] = [
  'type1',
  'type2Alger',
  'type3V2',
  'type4V3Sbk',
  'type5V3SbkP',
];

export function crewListPlacementKey(listType: CrewListTypeId): CrewListPlacementKey {
  if (listType === 'type2Alger') return 'type2Alger';
  if (listType === 'type3V2') return 'type3V2';
  if (listType === 'type4V3Sbk') return 'type4V3Sbk';
  if (listType === 'type5V3SbkP') return 'type5V3SbkP';
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

export const CREW_LIST_TYPE_LABELS: Record<CrewListTypeId, string> = {
  type1Passport: 'CREW LIST - PASSPORT',
  type1SeamansBook: "CREW LIST - SEAMAN'S BOOK",
  type2Alger: 'CREW LIST - ALGER',
  type3V2: 'CREW LIST - V2',
  type4V3Sbk: 'Crew List v3 - SBK',
  type5V3SbkP: 'Crew List v3 - SBK/P',
};

export const CREW_LIST_TYPE_IDS: readonly CrewListTypeId[] = [
  'type1Passport',
  'type1SeamansBook',
  'type2Alger',
  'type3V2',
  'type4V3Sbk',
  'type5V3SbkP',
];

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
  | 'portOfCall'
  | 'mdh'
  | 'crewVaccine'
  | 'shipStores'
  | 'crewEffect'
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
  portOfCall: DocumentStampOptions;
  mdh: DocumentStampOptions;
  crewVaccine: DocumentStampOptions;
  shipStores: DocumentStampOptions;
  crewEffect: DocumentStampOptions;
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
    raw.listType === 'type5V3SbkP'
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
    portOfCall: { ...DEFAULT_STAMP_OPTS },
    mdh: { ...DEFAULT_STAMP_OPTS },
    crewVaccine: { ...DEFAULT_STAMP_OPTS },
    shipStores: { ...DEFAULT_STAMP_OPTS },
    crewEffect: { ...DEFAULT_STAMP_OPTS },
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
  pax: 'Passenger list',
  portOfCall: 'Port of Call',
  mdh: 'MDH',
  crewVaccine: 'Crew Vaccine',
  shipStores: 'Ship Stores',
  crewEffect: 'Crew Effect',
  nilList: 'NIL List',
  shipMoney: 'Ship Money',
  cashAdvance: 'Cash Advance',
  crewMoney: 'Crew Money',
  narcoticList: 'Narcotic List',
  sso0108PortCalls: 'SSO-0108 Port Calls',
};

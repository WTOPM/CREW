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
export type CrewListTypeId = 'type1Passport' | 'type1SeamansBook' | 'type2Alger';

/** Stamp/signature placement bucket (Type 1 passport & seaman's book share one layout). */
export type CrewListPlacementKey = 'type1' | 'type2Alger';

export const CREW_LIST_PLACEMENT_KEYS: readonly CrewListPlacementKey[] = ['type1', 'type2Alger'];

export function crewListPlacementKey(listType: CrewListTypeId): CrewListPlacementKey {
  return listType === 'type2Alger' ? 'type2Alger' : 'type1';
}

/** Per-template stamp/signature coordinates (toggles stay on {@link CrewListDocumentPrefs}). */
export interface CrewListVariantPlacement {
  overlayRotation?: number;
  stampBox?: PdfStampBox;
  signatureBox?: PdfStampBox;
}

export const CREW_LIST_TYPE_LABELS: Record<CrewListTypeId, string> = {
  type1Passport: 'Type 1 — Passport',
  type1SeamansBook: "Type 1 — Seaman's book",
  type2Alger: 'Type 2 — Alger',
};

export const CREW_LIST_TYPE_IDS: readonly CrewListTypeId[] = [
  'type1Passport',
  'type1SeamansBook',
  'type2Alger',
];

/** Crew list menu: which identity list variant to print. */
export interface CrewListDocumentPrefs extends DocumentStampOptions {
  listType: CrewListTypeId;
  /** Separate stamp/signature placement per PDF template (Type 1 vs Alger). */
  byPlacement?: Partial<Record<CrewListPlacementKey, CrewListVariantPlacement>>;
}

const CREW_LIST_PLACEMENT_FIELD_NAMES = [
  'overlayRotation',
  'stampBox',
  'signatureBox',
] as const satisfies readonly (keyof CrewListVariantPlacement)[];

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

/** Resolved stamp options for the active crew list type (preview + PDF). */
export function resolveCrewListStampOptions(prefs: CrewListDocumentPrefs): DocumentStampOptions {
  const key = crewListPlacementKey(prefs.listType);
  const legacy = mergeCrewListVariantPlacement({
    overlayRotation: prefs.overlayRotation,
    stampBox: prefs.stampBox,
    signatureBox: prefs.signatureBox,
  });
  const placement = mergeCrewListVariantPlacement(legacy, prefs.byPlacement?.[key]) ?? {};
  return {
    useStamp: prefs.useStamp,
    useSignature: prefs.useSignature,
    ...(placement.overlayRotation != null ? { overlayRotation: placement.overlayRotation } : {}),
    ...(placement.stampBox ? { stampBox: { ...placement.stampBox } } : {}),
    ...(placement.signatureBox ? { signatureBox: { ...placement.signatureBox } } : {}),
  };
}

export function crewListPlacementPatch(
  partial: Partial<CrewListDocumentPrefs>,
): Partial<CrewListVariantPlacement> | null {
  const patch: Partial<CrewListVariantPlacement> = {};
  for (const field of CREW_LIST_PLACEMENT_FIELD_NAMES) {
    if (field in partial) {
      (patch as Record<string, unknown>)[field] = partial[field];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Keys match document menu Settings modals. */
export type DocumentOverlayId =
  | 'crewList'
  | 'pax'
  | 'portOfCall'
  | 'mdh'
  | 'shipStores'
  | 'crewEffect'
  | 'nilList'
  | 'shipMoney'
  | 'cashAdvance'
  | 'crewMoney'
  | 'narcoticList';

export type ShipAssetKind = 'stamp' | 'signature';

export interface DocumentOverlayPrefs {
  crewList: CrewListDocumentPrefs;
  pax: DocumentStampOptions;
  portOfCall: DocumentStampOptions;
  mdh: DocumentStampOptions;
  shipStores: DocumentStampOptions;
  crewEffect: DocumentStampOptions;
  nilList: DocumentStampOptions;
  shipMoney: DocumentStampOptions;
  cashAdvance: DocumentStampOptions;
  crewMoney: DocumentStampOptions;
  narcoticList: DocumentStampOptions;
}

export interface ShipAssetsMeta {
  hasStamp: boolean;
  hasSignature: boolean;
  stampFileName: string;
  signatureFileName: string;
}

const DEFAULT_STAMP_OPTS: DocumentStampOptions = { useStamp: false, useSignature: false };

export function createDefaultCrewListPrefs(): CrewListDocumentPrefs {
  return {
    ...DEFAULT_STAMP_OPTS,
    listType: 'type1Passport',
  };
}

/** Migrate saved data from old dual-checkbox crew list prefs. */
export function normalizeCrewListType(raw: Partial<CrewListDocumentPrefs> & {
  type1Passport?: boolean;
  type1SeamansBook?: boolean;
}): CrewListTypeId {
  if (
    raw.listType === 'type1Passport' ||
    raw.listType === 'type1SeamansBook' ||
    raw.listType === 'type2Alger'
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
    shipStores: { ...DEFAULT_STAMP_OPTS },
    crewEffect: { ...DEFAULT_STAMP_OPTS },
    nilList: { ...DEFAULT_STAMP_OPTS },
    shipMoney: { ...DEFAULT_STAMP_OPTS },
    cashAdvance: { ...DEFAULT_STAMP_OPTS },
    crewMoney: { ...DEFAULT_STAMP_OPTS },
    narcoticList: { ...DEFAULT_STAMP_OPTS },
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
  shipStores: 'Ship Stores',
  crewEffect: 'Crew Effect',
  nilList: 'NIL List',
  shipMoney: 'Ship Money',
  cashAdvance: 'Cash Advance',
  crewMoney: 'Crew Money',
  narcoticList: 'Narcotic List',
};

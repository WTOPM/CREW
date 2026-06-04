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
  | 'shipMoney';

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
};

import {
  CREW_LIST_TYPE_LABELS,
  type CrewListTypeId,
  DOCUMENT_OVERLAY_LABELS,
} from './document-overlay.models';

/** Built-in document ids selectable in Settings → Document packages. */
export type PackageDocumentId =
  | 'crewListArrivalPassport'
  | 'crewListDeparturePassport'
  | 'crewListArrivalSeaman'
  | 'crewListDepartureSeaman'
  | 'crewListArrivalAlger'
  | 'crewListArrivalV2'
  | 'crewListDepartureV2'
  | 'crewListArrivalV3Sbk'
  | 'crewListDepartureV3Sbk'
  | 'crewListArrivalV3SbkP'
  | 'crewListDepartureV3SbkP'
  | 'paxArrival'
  | 'paxDeparture'
  | 'portOfCall'
  | 'sso0108'
  | 'shipStores'
  | 'crewEffect'
  | 'nilList'
  | 'shipMoney'
  | 'cashAdvance'
  | 'crewMoney'
  | 'narcotic'
  | 'mdh'
  | 'crewVaccine';

export interface PackageCatalogEntry {
  id: PackageDocumentId | `custom:${string}`;
  label: string;
}

function crewListPackageLabel(
  type: CrewListTypeId,
  direction: 'Arrival' | 'Departure',
): string {
  return `${CREW_LIST_TYPE_LABELS[type]} — ${direction}`;
}

function directionLabel(base: string, direction: 'Arrival' | 'Departure'): string {
  return `${base} — ${direction}`;
}

/** Single source of truth for built-in package document labels. */
export const PACKAGE_CATALOG_ENTRIES: readonly PackageCatalogEntry[] = [
  {
    id: 'crewListArrivalPassport',
    label: crewListPackageLabel('type1Passport', 'Arrival'),
  },
  {
    id: 'crewListDeparturePassport',
    label: crewListPackageLabel('type1Passport', 'Departure'),
  },
  {
    id: 'crewListArrivalSeaman',
    label: crewListPackageLabel('type1SeamansBook', 'Arrival'),
  },
  {
    id: 'crewListDepartureSeaman',
    label: crewListPackageLabel('type1SeamansBook', 'Departure'),
  },
  {
    id: 'crewListArrivalAlger',
    label: crewListPackageLabel('type2Alger', 'Arrival'),
  },
  {
    id: 'crewListArrivalV2',
    label: crewListPackageLabel('type3V2', 'Arrival'),
  },
  {
    id: 'crewListDepartureV2',
    label: crewListPackageLabel('type3V2', 'Departure'),
  },
  {
    id: 'crewListArrivalV3Sbk',
    label: crewListPackageLabel('type4V3Sbk', 'Arrival'),
  },
  {
    id: 'crewListDepartureV3Sbk',
    label: crewListPackageLabel('type4V3Sbk', 'Departure'),
  },
  {
    id: 'crewListArrivalV3SbkP',
    label: crewListPackageLabel('type5V3SbkP', 'Arrival'),
  },
  {
    id: 'crewListDepartureV3SbkP',
    label: crewListPackageLabel('type5V3SbkP', 'Departure'),
  },
  {
    id: 'paxArrival',
    label: directionLabel(DOCUMENT_OVERLAY_LABELS.pax, 'Arrival'),
  },
  {
    id: 'paxDeparture',
    label: directionLabel(DOCUMENT_OVERLAY_LABELS.pax, 'Departure'),
  },
  { id: 'portOfCall', label: DOCUMENT_OVERLAY_LABELS.portOfCall },
  { id: 'sso0108', label: DOCUMENT_OVERLAY_LABELS.sso0108PortCalls },
  { id: 'shipStores', label: DOCUMENT_OVERLAY_LABELS.shipStores },
  { id: 'crewEffect', label: DOCUMENT_OVERLAY_LABELS.crewEffect },
  { id: 'nilList', label: DOCUMENT_OVERLAY_LABELS.nilList },
  { id: 'shipMoney', label: DOCUMENT_OVERLAY_LABELS.shipMoney },
  { id: 'cashAdvance', label: DOCUMENT_OVERLAY_LABELS.cashAdvance },
  { id: 'crewMoney', label: DOCUMENT_OVERLAY_LABELS.crewMoney },
  { id: 'narcotic', label: DOCUMENT_OVERLAY_LABELS.narcoticList },
  { id: 'mdh', label: DOCUMENT_OVERLAY_LABELS.mdh },
  { id: 'crewVaccine', label: DOCUMENT_OVERLAY_LABELS.crewVaccine },
];

const PACKAGE_LABELS = new Map<string, string>(
  PACKAGE_CATALOG_ENTRIES.map((entry) => [entry.id, entry.label]),
);

/** Built-ins plus user-uploaded PDFs (always read custom list at call time). */
export function buildPackageCatalog(
  customDocuments: readonly { id: string; name: string }[],
): PackageCatalogEntry[] {
  const builtIn = PACKAGE_CATALOG_ENTRIES.map((entry) => ({ ...entry }));
  const custom = customDocuments.map((doc) => ({
    id: `custom:${doc.id}` as const,
    label: doc.name,
  }));
  return [...builtIn, ...custom];
}

export function packageCatalogLabelForId(
  id: string,
  customDocuments: readonly { id: string; name: string }[],
): string {
  if (id.startsWith('custom:')) {
    const docId = id.slice('custom:'.length);
    return customDocuments.find((d) => d.id === docId)?.name ?? id;
  }
  return PACKAGE_LABELS.get(id) ?? id;
}

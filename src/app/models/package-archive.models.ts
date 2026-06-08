import type { PortPackage } from './crew.models';

/** One PDF frozen at snapshot time. */
export interface PackageArchivePdf {
  documentId: string;
  label: string;
  fileName: string;
  dataBase64: string;
  copies: number;
}

/** Saved snapshot of a port document package (separate from main crew-data). */
export interface PackageArchiveEntry {
  id: string;
  /** User label for this snapshot. */
  label: string;
  portName: string;
  arrivalDate: string;
  savedAt: string;
  package: PortPackage;
  /** Built PDF bytes at save time — Open / Print use these when loaded. */
  documents: PackageArchivePdf[];
}

export const PACKAGE_ARCHIVE_STORAGE_KEY = 'crew-package-archives';

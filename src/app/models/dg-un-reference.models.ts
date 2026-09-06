import type { UnNumberReferenceRow } from '../utils/dg-un-number.util';

/**
 * The IMDG UN number reference the app is currently using.
 *
 * The app ships with a baseline list compiled into the bundle. The IMDG Code is
 * reissued every two years, so the user can replace that baseline by importing
 * chapter 3.2 from the official PDF; the imported list is then persisted with
 * the rest of AppData and survives app updates.
 */
export interface DgUnReferenceLibrary {
  /** `bundled` = use the list shipped with the app; `custom` = use `entries`. */
  origin: 'bundled' | 'custom';
  /** Only meaningful when `origin` is `custom`. May be empty (user wiped the list). */
  entries: UnNumberReferenceRow[];
  /** PDF the entries came from. */
  fileName: string;
  /** Edition wording read from the PDF footer, e.g. `Amendment 42-24, 2024 edition`. */
  amendment: string;
  /** ISO timestamp of the import. */
  updatedAt: string;
}

export function createDefaultDgUnReference(): DgUnReferenceLibrary {
  return {
    origin: 'bundled',
    entries: [],
    fileName: '',
    amendment: '',
    updatedAt: '',
  };
}

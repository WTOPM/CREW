import type { CrewListTypeId } from './document-overlay.models';

export interface HtmlFormExcelCrewRow {
  familyName: string;
  givenNames: string;
  rank: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passport?: string;
  passportExpiryDate?: string;
  passportPlaceOfIssue?: string;
  gender?: string;
  seamansBook?: string;
  seamansBookPlaceOfIssue?: string;
  sbookExpiryDate?: string;
  joiningDate?: string;
  joiningPort?: string;
}

export interface HtmlFormExcelOverlaySnapshot {
  stamp: {
    visible?: boolean;
    left?: string;
    top?: string;
    width?: string;
    height?: string;
  };
  sig: {
    visible?: boolean;
    left?: string;
    top?: string;
    width?: string;
    height?: string;
  };
  cellStyles: Record<
    string,
    { fontFamily?: string; fontSize?: string; textAlign?: string; verticalAlign?: string }
  >;
  stampImage: string | null;
  sigImage: string | null;
}

export interface HtmlFormExcelSnapshot {
  listType: CrewListTypeId;
  isArrival: boolean;
  footerDate: string;
  masterName: string;
  crew: HtmlFormExcelCrewRow[];
  overlay: HtmlFormExcelOverlaySnapshot;
  fileName: string;
}

export const HTML_FORM_EXCEL_STORAGE_KEY = 'crew-html-form-excel-export';

export function parseHtmlFormExcelSnapshot(raw: string | null): HtmlFormExcelSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HtmlFormExcelSnapshot;
    if (!parsed?.listType || !Array.isArray(parsed.crew)) return null;
    return parsed;
  } catch {
    return null;
  }
}

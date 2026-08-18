import { Injectable } from '@angular/core';
import {
  isCmaPrestowPdf,
  parseCmaPrestowPositions,
  type CmaPrestowPositionRow,
} from '../utils/dg-cma-prestow-pdf.util';
import { extractDgPdfTextItems } from '../utils/dg-pdf-text.util';

export type CmaPrestowPdfFormat = 'cma-prestow' | 'unknown';

export interface CmaPrestowImportResult {
  format: CmaPrestowPdfFormat;
  positions: CmaPrestowPositionRow[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class DgCmaPrestowImportService {
  async importFromPdfBytes(bytes: Uint8Array): Promise<CmaPrestowImportResult> {
    const items = await extractDgPdfTextItems(bytes);
    if (!isCmaPrestowPdf(items)) {
      return { format: 'unknown', positions: [], warnings: [] };
    }

    const positions = parseCmaPrestowPositions(items);
    if (!positions.length) {
      return {
        format: 'unknown',
        positions: [],
        warnings: ['No container positions found in prestow PDF.'],
      };
    }

    return { format: 'cma-prestow', positions, warnings: [] };
  }
}

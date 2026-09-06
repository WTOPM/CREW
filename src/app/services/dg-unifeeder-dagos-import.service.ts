import { Injectable } from '@angular/core';
import {
  isUnifeederDagosPositionsPdf,
  parseUnifeederDagosPositions,
  type UnifeederDagosPositionRow,
} from '../utils/dg-unifeeder-dagos-pdf.util';
import { extractDgPdfTextItems } from '../utils/dg-pdf-text.util';

export type UnifeederDagosPdfFormat = 'unifeeder-dagos' | 'unknown';

export interface UnifeederDagosImportResult {
  format: UnifeederDagosPdfFormat;
  positions: UnifeederDagosPositionRow[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class DgUnifeederDagosImportService {
  async importFromPdfBytes(bytes: Uint8Array): Promise<UnifeederDagosImportResult> {
    const items = await extractDgPdfTextItems(bytes);
    if (!isUnifeederDagosPositionsPdf(items)) {
      return { format: 'unknown', positions: [], warnings: [] };
    }

    const positions = parseUnifeederDagosPositions(items);
    if (!positions.length) {
      return {
        format: 'unknown',
        positions: [],
        warnings: ['No container positions found in Dagos on Board PDF.'],
      };
    }

    return { format: 'unifeeder-dagos', positions, warnings: [] };
  }
}

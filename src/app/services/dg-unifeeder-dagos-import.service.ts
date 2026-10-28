import { Injectable } from '@angular/core';
import { extractDgPdfTextItems } from '../utils/dg-pdf-text.util';
import {
  isUnifeederDagosPositionsPdf,
  parseUnifeederDagosLines,
  parseUnifeederDagosPositions,
  type UnifeederDagosLineRow,
  type UnifeederDagosPositionRow,
} from '../utils/dg-unifeeder-dagos-pdf.util';

export type UnifeederDagosPdfFormat = 'unifeeder-dagos' | 'unknown';

export interface UnifeederDagosImportResult {
  format: UnifeederDagosPdfFormat;
  positions: UnifeederDagosPositionRow[];
  lines: UnifeederDagosLineRow[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class DgUnifeederDagosImportService {
  async importFromPdfBytes(bytes: Uint8Array): Promise<UnifeederDagosImportResult> {
    const items = await extractDgPdfTextItems(bytes);
    if (!isUnifeederDagosPositionsPdf(items)) {
      return { format: 'unknown', positions: [], lines: [], warnings: [] };
    }
    const lines = parseUnifeederDagosLines(items);
    const positions = parseUnifeederDagosPositions(items);
    if (!positions.length) {
      return {
        format: 'unifeeder-dagos',
        positions: [],
        lines: [],
        warnings: ['No container positions found in Dagos on Board PDF.'],
      };
    }

    return { format: 'unifeeder-dagos', positions, lines, warnings: [] };
  }
}

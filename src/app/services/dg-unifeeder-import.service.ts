import { Injectable } from '@angular/core';
import { resolveManifestPortName, type Port } from '../models/crew.models';
import { extractDgPdfTextItems } from '../utils/dg-pdf-text.util';
import {
  parseUnifeederDangerousCargoManifest,
  type UnifeederPdfParseResult,
} from '../utils/dg-unifeeder-pdf.util';

export type { UnifeederPdfParseResult as UnifeederImportResult } from '../utils/dg-unifeeder-pdf.util';

@Injectable({ providedIn: 'root' })
export class DgUnifeederImportService {
  async importFromPdfBytes(bytes: Uint8Array, ports: Port[] = []): Promise<UnifeederPdfParseResult> {
    const items = await extractDgPdfTextItems(bytes);
    const parsed = parseUnifeederDangerousCargoManifest(items);
    if (parsed.format !== 'unifeeder-dg') return parsed;

    const loadPort = resolveManifestPortName(parsed.header.portOfDeparture ?? '', ports);
    const dischargePort = resolveManifestPortName(parsed.header.portOfArrival ?? '', ports);
    return {
      ...parsed,
      header: {
        ...parsed.header,
        portOfDeparture: loadPort,
        portOfArrival: dischargePort,
      },
      rows: parsed.rows.map((row) => ({
        ...row,
        loadPort: row.loadPort || loadPort,
        dischargePort: row.dischargePort || dischargePort,
      })),
    };
  }
}

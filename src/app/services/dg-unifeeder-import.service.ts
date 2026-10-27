import { Injectable } from '@angular/core';
import type { Port } from '../models/crew.models';
import { resolveUnifeederRowPort } from '../models/dg-unifeeder.models';
import { extractDgPdfTextItems } from '../utils/dg-pdf-text.util';
import {
  parseUnifeederDangerousCargoManifest,
  type UnifeederPdfParseResult,
} from '../utils/dg-unifeeder-pdf.util';
import type { DgWeightTonnageOptions } from '../models/dg-weight-tonnage.models';

export type { UnifeederPdfParseResult as UnifeederImportResult } from '../utils/dg-unifeeder-pdf.util';

@Injectable({ providedIn: 'root' })
export class DgUnifeederImportService {
  async importFromPdfBytes(
    bytes: Uint8Array,
    ports: Port[] = [],
    options: DgWeightTonnageOptions = {},
  ): Promise<UnifeederPdfParseResult> {
    const items = await extractDgPdfTextItems(bytes);
    const parsed = parseUnifeederDangerousCargoManifest(items, options);
    if (parsed.format !== 'unifeeder-dg' && parsed.format !== 'dp-world-dg') return parsed;

    // Keep raw PDF city when not in the user's list (do not blank the header).
    const loadPort = resolveUnifeederRowPort(parsed.header.portOfDeparture ?? '', ports);
    const dischargePort = resolveUnifeederRowPort(parsed.header.portOfArrival ?? '', ports);
    return {
      ...parsed,
      header: {
        ...parsed.header,
        portOfDeparture: loadPort,
        portOfArrival: dischargePort,
      },
      rows: parsed.rows.map((row) => ({
        ...row,
        loadPort: resolveUnifeederRowPort(row.loadPort || loadPort, ports),
        dischargePort: resolveUnifeederRowPort(row.dischargePort || dischargePort, ports),
      })),
    };
  }
}

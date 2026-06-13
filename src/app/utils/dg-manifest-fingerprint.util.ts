import type { DgManifestImportResult } from '../services/dg-manifest-import.service';
import { formatDgWeightKgDisplay } from '../models/dg-manifest.models';

function normText(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normContainerNo(value: string | undefined | null): string {
  return normText(value).replace(/\s/g, '');
}

function normWeight(value: string | undefined | null): string {
  const formatted = formatDgWeightKgDisplay(value);
  if (formatted) return formatted;
  return normText(value);
}

/** Stable text snapshot of parsed manifest cargo — not the PDF file name. */
export function serializeDgManifestImportContent(
  result: Pick<DgManifestImportResult, 'header' | 'rows'>,
): string {
  const header = [
    normText(result.header.voyageNumber),
    normText(result.header.portOfDeparture),
    normText(result.header.portOfArrival),
    normText(result.header.departureDate),
  ].join('|');

  const rows = result.rows
    .map((row) =>
      [
        normContainerNo(row.containerNo),
        normText(row.type),
        normText(row.stowage),
        normText(row.unNo),
        normText(row.dgClass),
        normText(row.mpLq),
        normText(row.flashPoint),
        normWeight(row.weightKg),
        normText(row.properShippingName),
        normText(row.pol),
        normText(row.pod),
      ].join('\t'),
    )
    .sort()
    .join('\n');

  return `${header}\n---\n${rows}`;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash of parsed manifest rows + header fields (duplicate detection). */
export async function buildDgManifestContentHash(
  result: Pick<DgManifestImportResult, 'header' | 'rows'>,
): Promise<string> {
  return sha256Hex(serializeDgManifestImportContent(result));
}

/** Hash of raw PDF bytes — catches exact same file even if parsing drifts slightly. */
export async function buildDgPdfBytesHash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

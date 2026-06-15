import type { UnifeederPdfParseResult } from './dg-unifeeder-pdf.util';

export async function buildUnifeederContentHash(result: UnifeederPdfParseResult): Promise<string> {
  const payload = JSON.stringify({
    header: result.header,
    rows: result.rows.map((r) => ({
      containerNo: r.containerNo,
      unNo: r.unNo,
      dgClass: r.dgClass,
      weightKg: r.weightKg,
    })),
  });
  return sha256Hex(payload);
}

export async function buildUnifeederPdfBytesHash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

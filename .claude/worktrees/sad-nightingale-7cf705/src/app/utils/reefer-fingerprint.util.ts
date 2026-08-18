import type { ReeferImportResult } from '../services/reefer-import.service';

export async function buildReeferContentHash(result: ReeferImportResult): Promise<string> {
  const payload = JSON.stringify({
    header: result.header,
    rows: result.rows.map((r) => ({
      containerNo: r.containerNo,
      setPointTemp: r.setPointTemp,
      loadPort: r.loadPort,
      dischargePort: r.dischargePort,
    })),
  });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildReeferPdfBytesHash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

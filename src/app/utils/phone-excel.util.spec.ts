import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  importPhoneDirectoryFromExcelBytes,
  writePhoneDirectoryToExcelBytes,
} from './phone-excel.util';

async function samplePhoneBytes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.mergeCells('A1:F1');
  ws.mergeCells('I1:N1');
  ws.getCell('A1').value = "CREW MEMBER'S CABIN AND PHONE NUMBERS";
  ws.getCell('I1').value = "CREW MEMBER'S CABIN AND PHONE NUMBERS";
  ws.getCell('A2').value = 'Subscribe';
  ws.getCell('B2').value = 'CALL';
  ws.getCell('C2').value = 'Cabin';
  ws.getCell('D2').value = 'Name';
  ws.getCell('E2').value = 'Subscribe';
  ws.getCell('F2').value = 'CALL';
  ws.getCell('A3').value = 'BRIDGE';
  ws.getCell('B3').value = '21';
  ws.getCell('E3').value = 'MESSROOM';
  ws.getCell('F3').value = '71';
  ws.getCell('A6').value = 'Master';
  ws.getCell('B6').value = '31';
  ws.getCell('C6').value = '813';
  ws.getCell('D6').value = '';
  ws.getCell('A16').value = {
    richText: [{ text: 'OS ' }, { text: '00:00-04:00', font: { size: 7 } }],
  };
  ws.getCell('B16').value = '62';
  ws.getCell('C16').value = '510';
  ws.getCell('D16').value = 'MANCHA';
  // Pad to end row so importer reads fixed window.
  for (let r = 3; r <= 25; r++) {
    /* ensure row exists */
    void ws.getRow(r);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

describe('phone-excel.util', () => {
  it('imports cabin/phone rows including rich-text subscribe', async () => {
    const result = await importPhoneDirectoryFromExcelBytes(await samplePhoneBytes());
    expect(result.rows.length).toBe(23);
    expect(result.title.toUpperCase()).toContain('CABIN');
    const master = result.rows.find((r) => r.subscribe === 'Master');
    expect(master?.call).toBe('31');
    expect(master?.cabin).toBe('813');
    const mess = result.rows.find((r) => r.facilitySubscribe === 'MESSROOM');
    expect(mess?.facilityCall).toBe('71');
    const os = result.rows.find((r) => r.subscribe.startsWith('OS'));
    expect(os?.subscribe).toContain('00:00-04:00');
    expect(os?.name).toBe('MANCHA');
  });

  it('round-trips an edited name', async () => {
    const bytes = await samplePhoneBytes();
    const imported = await importPhoneDirectoryFromExcelBytes(bytes);
    const rows = imported.rows.map((r) =>
      r.subscribe === 'Master' ? { ...r, name: 'TEST MASTER' } : r,
    );
    const out = await writePhoneDirectoryToExcelBytes(bytes, rows);
    const again = await importPhoneDirectoryFromExcelBytes(out);
    const master = again.rows.find((r) => r.subscribe === 'Master');
    expect(master?.name).toBe('TEST MASTER');
  });
});

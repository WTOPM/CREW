/**
 * One-off: parse IMDG Chapter 3.2 PDF → rewrite UN list sheet in IMDG_list_optimized.xlsx.
 * Keeps ALL list rows (same UN + different PG / description), not collapsed.
 *
 * Usage:
 *   npx tsx scripts/fill-imdg-excel-un-list.ts
 */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { parseImdgChapter32 } from '../src/app/utils/dg-imdg-chapter32-pdf.util.ts';

const PDF = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\03-02-0_pdf.pdf`;
const XLSX = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\IMDG_list_optimized.xlsx`;
const BACKUP = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\IMDG_list_optimized.before-un-refresh.xlsx`;

async function extractPdfItems(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const out: { str: string; x: number; y: number; page: number }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const raw of content.items as { str?: string; transform?: number[] }[]) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(raw.transform?.[4] ?? 0),
        y: Math.round(vp.height - (raw.transform?.[5] ?? 0)),
        page: p,
      });
    }
    if (p % 20 === 0 || p === doc.numPages) {
      process.stdout.write(`\rPDF pages ${p}/${doc.numPages}`);
    }
  }
  process.stdout.write('\n');
  return out;
}

function dashOr(value: string): string {
  const v = value.replace(/\s+/g, ' ').trim();
  return v || '-';
}

function unAsExcelValue(unNo: string): number | string {
  const n = Number(unNo);
  return Number.isInteger(n) ? n : unNo;
}

async function main() {
  if (!fs.existsSync(PDF)) throw new Error(`PDF not found: ${PDF}`);
  if (!fs.existsSync(XLSX)) throw new Error(`Excel not found: ${XLSX}`);

  console.log('Extracting PDF text…');
  const items = await extractPdfItems(PDF);
  console.log('Text items:', items.length);

  console.log('Parsing Chapter 3.2…');
  const parsed = parseImdgChapter32(items);
  console.log('Amendment:', parsed.amendment || '(none)');
  console.log('Table pages:', parsed.tablePages.length, 'skipped leading:', parsed.skippedLeadingPages);
  console.log('Raw list rows:', parsed.rows.length);
  if (parsed.warnings.length) {
    console.log('Warnings:', parsed.warnings.slice(0, 10));
  }

  // Sort: UN numeric, then PG (I < II < III < empty), then description.
  const pgRank = (pg: string) => {
    const u = pg.toUpperCase();
    if (u === 'I') return 1;
    if (u === 'II') return 2;
    if (u === 'III') return 3;
    if (!u) return 9;
    return 5;
  };
  const rows = [...parsed.rows].sort((a, b) => {
    const un = a.unNo.localeCompare(b.unNo, undefined, { numeric: true });
    if (un) return un;
    const pg = pgRank(a.packingGroup) - pgRank(b.packingGroup);
    if (pg) return pg;
    return a.description.localeCompare(b.description);
  });

  const uniqueUn = new Set(rows.map((r) => r.unNo));
  const multi = new Map<string, number>();
  for (const r of rows) multi.set(r.unNo, (multi.get(r.unNo) ?? 0) + 1);
  const multiCount = [...multi.values()].filter((n) => n > 1).length;
  console.log('Unique UN:', uniqueUn.size, '| UN with multiple variants:', multiCount);

  // Spot-check known multi-PG entries
  for (const un of ['1133', '1263', '3288', '1950', '3082']) {
    const variants = rows.filter((r) => r.unNo === un || Number(r.unNo) === Number(un));
    console.log(
      `  UN ${un}: ${variants.length} row(s)`,
      variants.map((v) => `${v.packingGroup || '—'} | ${v.description.slice(0, 40)}`).join(' || '),
    );
  }

  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(XLSX, BACKUP);
    console.log('Backup written:', BACKUP);
  } else {
    console.log('Backup already exists, leaving it:', BACKUP);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('UN list');
  if (!ws) throw new Error('Sheet "UN list" not found');

  // Wipe sheet content / excess columns, keep only A–G.
  ws.spliceRows(1, ws.rowCount);
  // Clear leftover cells beyond column G on a large used range.
  for (let c = 8; c <= 220; c++) {
    ws.getColumn(c).values = [];
  }

  const headers = ['UN no', 'Description', 'Class', 'Packing Group', 'Sub Risk', 'Fire', 'Spillage'];
  ws.getRow(1).values = headers;
  ws.getRow(1).font = { bold: true };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    ws.getRow(i + 2).values = [
      unAsExcelValue(r.unNo),
      r.description.trim(),
      (r.dgClass || '').trim(),
      (r.packingGroup || '').trim(),
      dashOr(r.subRisk),
      dashOr(r.fire),
      dashOr(r.spillage),
    ];
  }

  const lastDataRow = rows.length + 1; // header + data → last is rows.length+1
  const dataLast = rows.length + 1;

  // Update Data-sheet array formulas that hard-code the old $2742 range.
  const data = wb.getWorksheet('Data');
  if (data) {
    const rangePg = `'UN list'!$D$2:$D$${dataLast}`;
    const rangeTable = `'UN list'!$A$2:$G$${dataLast}`;
    let updated = 0;
    data.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 4) return;
      for (const col of [13, 14, 15, 16, 17] as const) {
        const cell = row.getCell(col);
        const raw = cell.value;
        let text = '';
        if (typeof raw === 'string') text = raw;
        else if (raw && typeof raw === 'object' && 'formula' in (raw as object)) {
          text = String((raw as { formula?: string }).formula ?? '');
        } else if (raw && typeof raw === 'object' && 'sharedFormula' in (raw as object)) {
          continue;
        } else if (raw && typeof raw === 'object' && 'result' in (raw as object) && 'formula' in (raw as object)) {
          text = String((raw as { formula?: string }).formula ?? '');
        }
        // exceljs may store array formulas differently — also check .text-like via JSON
        if (!text && raw && typeof raw === 'object') {
          const j = JSON.stringify(raw);
          const m = /UN list'!\$D\$2:\$D\$\d+/.exec(j);
          if (!m) continue;
        }
        if (!text.includes('UN list')) {
          // try formula field variants
          const any = raw as { formula?: string; sharedFormula?: string };
          text = any?.formula || any?.sharedFormula || '';
        }
        if (!text.includes('UN list')) continue;
        const next = text
          .replace(/'UN list'!\$D\$2:\$D\$\d+/g, rangePg)
          .replace(/'UN list'!\$A\$2:\$G\$\d+/g, rangeTable);
        if (next !== text) {
          // Preserve array-formula behaviour if exceljs exposes it
          cell.value = { formula: next.replace(/^=/, '') };
          updated++;
        }
      }
    });
    console.log('Data sheet formula cells touched:', updated);
    console.log(`New UN list range: rows 2..${dataLast} (${rows.length} entries)`);
  }

  // Drop empty junk sheet if present.
  const junk = wb.getWorksheet('Sheet3');
  if (junk) wb.removeWorksheet(junk.id);

  await wb.xlsx.writeFile(XLSX);
  console.log('Wrote', XLSX);
  console.log('Done. lastDataRow=', lastDataRow, 'amendment=', parsed.amendment);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

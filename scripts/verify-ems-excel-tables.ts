/**
 * Compare EmS FIRE/SPILLAGE PDFs vs Excel Data-sheet FIRE/SPILLAGE tables.
 *
 * Usage:
 *   npx tsx scripts/verify-ems-excel-tables.ts [xlsx-path]
 */
import fs from 'fs';
import ExcelJS from 'exceljs';
import { parseEmsSchedulePdf } from '../src/app/utils/dg-ems-schedule-pdf.util.ts';

const FIRE_PDF = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\ems_fire_pdf.pdf`;
const SPILL_PDF = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\ems_spillage_pdf.pdf`;
const XLSX =
  process.argv[2] ||
  String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\IMDG_list_optimized.before-un-refresh.xlsx`;

async function extract(filePath: string) {
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
  }
  return out;
}

function normPage(p: string): string {
  return String(p ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^p\./, 'p.');
}

async function main() {
  console.log('Excel:', XLSX);
  const fireParsed = parseEmsSchedulePdf(await extract(FIRE_PDF));
  const spillParsed = parseEmsSchedulePdf(await extract(SPILL_PDF));
  console.log('PDF FIRE:', fireParsed.rows.length, 'index page', fireParsed.indexPage, fireParsed.warnings);
  console.log('PDF SPILL:', spillParsed.rows.length, 'index page', spillParsed.indexPage, spillParsed.warnings);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const data = wb.getWorksheet('Data');
  if (!data) throw new Error('No Data sheet');

  // FIRE table: cols X=24, Y=25 starting row 4
  // SPILLAGE: cols Z=26, AA=27
  const excelFire = new Map<string, string>();
  const excelSpill = new Map<string, string>();
  for (let r = 4; r <= 40; r++) {
    const fc = String(data.getRow(r).getCell(24).value ?? '').trim().toUpperCase();
    const fp = String(data.getRow(r).getCell(25).value ?? '').trim();
    if (/^F-[A-Z]$/.test(fc) && fp) excelFire.set(fc, fp);
    const sc = String(data.getRow(r).getCell(26).value ?? '').trim().toUpperCase();
    const sp = String(data.getRow(r).getCell(27).value ?? '').trim();
    if (/^S-[A-Z]$/.test(sc) && sp) excelSpill.set(sc, sp);
  }

  console.log('\n=== FIRE Excel vs PDF ===');
  let fireDiff = 0;
  const fireCodes = new Set([...excelFire.keys(), ...fireParsed.rows.map((r) => r.code)]);
  for (const code of [...fireCodes].sort()) {
    const ex = excelFire.get(code) ?? '(missing)';
    const pdf = fireParsed.rows.find((r) => r.code === code)?.pageRef ?? '(missing)';
    const ok = normPage(ex) === normPage(pdf);
    if (!ok) {
      fireDiff++;
      console.log(`  DIFF ${code}: Excel=${ex}  PDF=${pdf}`);
    } else {
      console.log(`  OK   ${code}: ${pdf}`);
    }
  }

  console.log('\n=== SPILLAGE Excel vs PDF ===');
  let spillDiff = 0;
  const spillCodes = new Set([...excelSpill.keys(), ...spillParsed.rows.map((r) => r.code)]);
  for (const code of [...spillCodes].sort()) {
    const ex = excelSpill.get(code) ?? '(missing)';
    const pdf = spillParsed.rows.find((r) => r.code === code)?.pageRef ?? '(missing)';
    const ok = normPage(ex) === normPage(pdf);
    if (!ok) {
      spillDiff++;
      console.log(`  DIFF ${code}: Excel=${ex}  PDF=${pdf}`);
    } else {
      console.log(`  OK   ${code}: ${pdf}`);
    }
  }

  console.log(`\nSummary: FIRE diffs=${fireDiff}/${fireCodes.size}, SPILL diffs=${spillDiff}/${spillCodes.size}`);
  if (fireDiff || spillDiff) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

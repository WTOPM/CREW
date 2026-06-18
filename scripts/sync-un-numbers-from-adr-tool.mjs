import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mdPath =
  process.env.ADR_TOOL_MD ??
  'C:/Users/wtopm/.cursor/projects/c-CREW/uploads/adr-tool.com-0.md';
const xlsxPath = path.join(root, 'scripts/un-numbers-source.xlsx');
const jsonPath = path.join(root, 'src/app/data/un-numbers-reference.json');
const reportPath = path.join(root, 'scripts/un-numbers-sync-report.json');

const CONCURRENCY = 8;
const RETRIES = 2;
const DELAY_MS = 120;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTableCell(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<th>${escaped}</th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  return clean(m[1].replace(/<[^>]+>/g, ' '));
}

function labelsToSubRisk(dgClass, labelsRaw) {
  const labels = clean(labelsRaw);
  if (!labels) return '-';

  const parts = labels
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/^[^\d]+/, '').trim() || p);

  const normalizedClass = clean(dgClass);
  const subs = parts.filter((p) => p !== normalizedClass);
  if (!subs.length) return '-';
  return subs.join('/');
}

function normalizePackingGroup(raw) {
  const pg = clean(raw).toUpperCase();
  if (pg === 'I' || pg === 'II' || pg === 'III') return pg;
  return '';
}

function entryFromHtml(html) {
  const unNo = parseTableCell(html, 'UN No.');
  const description = parseTableCell(html, 'NAME and description');
  const dgClass = parseTableCell(html, 'Class');
  if (!unNo || !description || !dgClass) return null;

  const packingGroup = normalizePackingGroup(parseTableCell(html, 'Packing group'));
  const subRisk = labelsToSubRisk(dgClass, parseTableCell(html, 'Labels'));

  return {
    unNo,
    description,
    dgClass,
    packingGroup,
    subRisk,
  };
}

async function fetchUnPage(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CREW-DG-Reference-Sync/1.0 (+local build script)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const entry = entryFromHtml(html);
    if (!entry) throw new Error('Table A not found or locked');
    return entry;
  } catch (err) {
    if (attempt < RETRIES) {
      await sleep(400 * (attempt + 1));
      return fetchUnPage(url, attempt + 1);
    }
    throw err;
  }
}

function loadUnUrls(md) {
  const links = [...md.matchAll(/https:\/\/adr-tool\.com\/(\d+)\/un-(\d{4})/g)];
  const byUn = new Map();
  for (const m of links) {
    if (!byUn.has(m[2])) byUn.set(m[2], m[0]);
  }
  return byUn;
}

async function mapPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

function sameEntry(a, b) {
  return (
    a.description === b.description &&
    a.dgClass === b.dgClass &&
    a.packingGroup === b.packingGroup &&
    a.subRisk === b.subRisk
  );
}

async function readExistingXlsx() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const map = new Map();

  for (let r = 2; r <= ws.rowCount; r++) {
    const un = clean(ws.getRow(r).getCell(1).value);
    if (!/^\d{4}$/.test(un)) continue;
    map.set(un, {
      description: clean(ws.getRow(r).getCell(2).value),
      dgClass: clean(ws.getRow(r).getCell(3).value),
      packingGroup: clean(ws.getRow(r).getCell(4).value),
      subRisk: clean(ws.getRow(r).getCell(5).value) || '-',
      fire: clean(ws.getRow(r).getCell(6).value),
      spillage: clean(ws.getRow(r).getCell(7).value),
    });
  }
  return map;
}

async function writeXlsx(map) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('UN Numbers');
  ws.addRow(['UN No.', 'Description', 'Class', 'PG', 'Sub-risk', 'Fire', 'Spillage']);

  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  for (const [un, e] of sorted) {
    ws.addRow([un, e.description, e.dgClass, e.packingGroup, e.subRisk, e.fire, e.spillage]);
  }

  await wb.xlsx.writeFile(xlsxPath);
}

function rebuildJson(map) {
  const payload = Object.fromEntries(
    [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })),
  );
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload)}\n`, 'utf8');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = Number(process.env.LIMIT ?? 0);

  const md = fs.readFileSync(mdPath, 'utf8');
  const urlByUn = loadUnUrls(md);
  let targets = [...urlByUn.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  if (limit > 0) targets = targets.slice(0, limit);

  const existing = await readExistingXlsx();
  console.log(`Existing rows: ${existing.size}`);
  console.log(`ADR-tool UN URLs: ${urlByUn.size}`);
  console.log(`Fetching: ${targets.length}`);

  const stats = { added: 0, updated: 0, unchanged: 0, failed: 0, failures: [] };
  const merged = new Map(existing);
  let done = 0;

  await mapPool(
    targets,
    async ([un, url]) => {
      await sleep(DELAY_MS);
      try {
        const adr = await fetchUnPage(url);
        if (adr.unNo !== un) {
          throw new Error(`UN mismatch ${adr.unNo} != ${un}`);
        }

        const prev = merged.get(un);
        const next = {
          description: adr.description,
          dgClass: adr.dgClass,
          packingGroup: adr.packingGroup,
          subRisk: adr.subRisk,
          fire: prev?.fire ?? '',
          spillage: prev?.spillage ?? '',
        };

        if (!prev) {
          stats.added++;
          merged.set(un, next);
        } else if (sameEntry(prev, next)) {
          stats.unchanged++;
        } else {
          stats.updated++;
          merged.set(un, next);
        }
      } catch (err) {
        stats.failed++;
        if (stats.failures.length < 50) {
          stats.failures.push({ un, url, error: String(err.message ?? err) });
        }
      }

      done++;
      if (done % 100 === 0 || done === targets.length) {
        console.log(`Progress ${done}/${targets.length}`);
      }
    },
    CONCURRENCY,
  );

  const missingInAdr = [...existing.keys()].filter((un) => !urlByUn.has(un));
  stats.keptNotOnAdrTool = missingInAdr.length;

  console.log('Stats:', stats);

  if (!dryRun) {
    await writeXlsx(merged);
    rebuildJson(merged);
    console.log(`Written ${merged.size} rows to xlsx + json`);
  } else {
    console.log('Dry run — no files written');
  }

  fs.writeFileSync(reportPath, `${JSON.stringify({ stats, failures: stats.failures }, null, 2)}\n`, 'utf8');
  console.log('Report:', reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

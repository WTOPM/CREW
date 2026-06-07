/**
 * Import ship + crew from DOCUMENT.xlsx (Input sheet) into crew-data.json.
 * Usage: node scripts/import-document-xlsx.mjs [path-to-xlsx]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const xlsxPath = process.argv[2] ?? path.join(root, 'DOCUMENT.xlsx');

const SEED_VERSION = 7;

function excelSerialToIso(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' && value.includes('.')) {
    const trimmed = value.trim();
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) {
      const [d, m, yRaw] = trimmed.split('.');
      let y = parseInt(yRaw, 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const n = parseFloat(trimmed);
    if (!isNaN(n) && n > 1000 && n < 100000) {
      const utcDays = Math.floor(n - 25569);
      const date = new Date(utcDays * 86400000);
      return isNaN(date.getTime()) ? trimmed : date.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400000);
    return isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  }
  const n = parseFloat(String(value));
  if (!isNaN(n) && n > 1000 && n < 100000) {
    const utcDays = Math.floor(n - 25569);
    const date = new Date(utcDays * 86400000);
    return isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  }
  return String(value);
}

function parseValidityRange(value) {
  const v = (value ?? '').trim();
  if (!v) return { issue: '', expiry: '' };
  const match = v.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (match) {
    return { issue: excelSerialToIso(match[1].trim()), expiry: excelSerialToIso(match[2].trim()) };
  }
  return { issue: '', expiry: excelSerialToIso(v) };
}

function parseCrewName(full) {
  const trimmed = full.trim();
  if (!trimmed) return { familyName: '', givenNames: '' };
  const comma = trimmed.indexOf(',');
  if (comma >= 0) {
    return { familyName: trimmed.slice(0, comma).trim(), givenNames: trimmed.slice(comma + 1).trim() };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { familyName: parts[0], givenNames: '' };
  return { familyName: parts[0], givenNames: parts.slice(1).join(' ') };
}

function parseDocument(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Input'];
  if (!ws) throw new Error('Sheet "Input" not found');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const cell = (r, c) => String(rows[r]?.[c] ?? '').trim();

  const ship = {
    name: cell(1, 2),
    callSign: cell(1, 6),
    nationality: cell(3, 2),
    homeport: cell(3, 6),
    imoNo: cell(5, 2),
    type: cell(5, 6),
    charterer: cell(17, 2),
    dateOfArrival: excelSerialToIso(cell(7, 2)),
    dateOfDeparture: excelSerialToIso(cell(9, 2)),
    portOfCall: cell(11, 2),
    lastPortOfCall: cell(13, 2),
    nextPortOfCall: cell(15, 2),
  };

  const parseMember = (r, archived) => {
    const { familyName, givenNames } = parseCrewName(cell(r, 10));
    const passport = parseValidityRange(cell(r, 19));
    const sbook = parseValidityRange(cell(r, 20));
    const cyprus = parseValidityRange(cell(r, 22));
    const visa = parseValidityRange(cell(r, 24));
    return {
      id: randomUUID(),
      familyName,
      givenNames,
      rank: cell(r, 11),
      nationality: cell(r, 12),
      gender: 'MALE',
      dateOfBirth: excelSerialToIso(cell(r, 14)),
      placeOfBirth: cell(r, 15),
      passport: cell(r, 17),
      seamansBook: cell(r, 18),
      passportIssueDate: passport.issue,
      passportExpiryDate: passport.expiry,
      sbookIssueDate: sbook.issue,
      sbookExpiryDate: sbook.expiry,
      cyprusSeamansBook: cell(r, 21),
      cyprusIssueDate: cyprus.issue,
      cyprusExpiryDate: cyprus.expiry,
      visa: cell(r, 23),
      visaIssueDate: visa.issue,
      visaExpiryDate: visa.expiry,
      joiningDate: excelSerialToIso(cell(r, 25)),
      joiningPort: cell(r, 26),
      archived,
      onArrivalList: !archived,
      onDepartureList: !archived,
    };
  };

  const formatMemberName = (m) =>
    m.familyName && m.givenNames ? `${m.familyName}, ${m.givenNames}` : m.familyName || m.givenNames;

  const crew = [];
  for (let r = 5; r <= 18; r++) {
    if (!cell(r, 10)) continue;
    crew.push(parseMember(r, false));
  }
  for (let r = 22; r < rows.length; r++) {
    const name = cell(r, 10);
    if (!name || name === 'Present Crew Details' || name === 'Previous Crew Details') continue;
    if (crew.some((m) => formatMemberName(m) === name)) continue;
    crew.push(parseMember(r, true));
  }

  return { ship, crew, present: crew.filter((m) => !m.archived).length, archive: crew.filter((m) => m.archived).length };
}

function parsePortOfCallHistory() {
  const pocPath = path.join(root, 'PORT OF CALL.xlsx');
  if (!fs.existsSync(pocPath)) return [];

  const wb = XLSX.readFile(pocPath);
  const ws = wb.Sheets['Port of Call List'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const cell = (r, c) => String(rows[r]?.[c] ?? '').trim();
  const entries = [];

  const portNameFromExcel = (raw) => {
    const key = raw.trim().toLowerCase();
    const map = {
      alger: 'Alger',
      marseille: 'Marseille',
      'la spezia': 'La Spezia',
      genoa: 'Genoa',
      salerno: 'Salerno',
      napoli: 'Napoli',
      'le havre': 'Le Havre',
      antwerp: 'Antwerp',
      bejaia: 'Bejaia',
    };
    if (map[key]) return map[key];
    return key.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  };

  for (let r = 9; r < rows.length; r++) {
    const portRaw = cell(r, 1);
    const country = cell(r, 2);
    if (!portRaw || !country || portRaw === 'Local Time') continue;

    entries.push({
      id: randomUUID(),
      portName: portNameFromExcel(portRaw),
      country: cell(r, 2).toUpperCase(),
      arrivalDate: excelSerialToIso(cell(r, 3)),
      arrivalTime: cell(r, 4),
      departureDate: excelSerialToIso(cell(r, 5)),
      departureTime: cell(r, 6),
    });
  }

  return entries;
}

const { ship, crew, present, archive } = parseDocument(xlsxPath);
const portCallFromXlsx = parsePortOfCallHistory();

const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const outPath = path.join(dataDir, 'crew-data.json');

let existing = {};
if (fs.existsSync(outPath)) {
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  } catch {
    /* ignore */
  }
}

const payload = {
  ship,
  crew,
  crewArr: existing.crewArr ?? { isArrival: true, pageNo: 1, identityDocumentType: 'Passport' },
  ports: existing.ports,
  ranks: existing.ranks,
  nationalities: existing.nationalities,
  portCallHistory:
    existing.portCallHistory?.length >= 10
      ? existing.portCallHistory
      : portCallFromXlsx.length >= 10
        ? portCallFromXlsx
        : [],
  portOfCall: existing.portOfCall ?? { pdfRowCount: 10 },
  seedVersion: SEED_VERSION,
};

const json = JSON.stringify(payload, null, 2);
fs.writeFileSync(outPath, json, 'utf-8');

console.log(`Imported from ${xlsxPath}`);
console.log(`  Ship: ${ship.name}`);
console.log(`  Arrival list: ${present} | Archive: ${archive} | Total: ${crew.length}`);
console.log(`  Written: ${outPath}`);
console.log(`  Port of call rows: ${payload.portCallHistory.length}`);

import ExcelJS from 'exceljs';
import {
  AD_FIRST_TERMINAL_COL,
  AD_MAX_TERMINALS,
  AD_PILOT_EXCEL_ROWS,
  AD_TUG_EXCEL_ROWS,
  adWaitMinsNumber,
  createAdAction,
  createAdTerminal,
  createEmptyAdDraft,
  createEmptyAdRemarks,
  type AdAction,
  type AdPilotAction,
  type AdReportDraft,
  type AdTerminal,
  type AdTugAction,
  type AdYn,
  isAdPilotAction,
  isAdTugAction,
} from '../models/a-and-d.models';

const SHEET_NAME = 'A&D report NEW';
const TEMPLATE_URL = '/templates/a-and-d.xlsx';

function cellRaw(ws: ExcelJS.Worksheet, row: number, col: number): unknown {
  const v = ws.getCell(row, col).value;
  if (v && typeof v === 'object' && 'result' in (v as object)) {
    return (v as ExcelJS.CellFormulaValue).result ?? null;
  }
  if (v && typeof v === 'object' && 'richText' in (v as object)) {
    return ((v as ExcelJS.CellRichTextValue).richText ?? []).map((p) => p.text).join('');
  }
  if (v && typeof v === 'object' && 'text' in (v as object)) {
    return (v as ExcelJS.CellHyperlinkValue).text;
  }
  return v ?? null;
}

function cellText(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const v = cellRaw(ws, row, col);
  if (v == null || v === '') return '';
  if (v instanceof Date) return '';
  return String(v).trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Excel cell → wall-clock `YYYY-MM-DDTHH:mm` (empty if missing).
 * Uses UTC getters so the numbers match what Excel shows (no TZ ±1h shift).
 */
export function cellToAdLocalDateTime(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const v = cellRaw(ws, row, col);
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}T${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial → UTC ms; UTC getters = wall clock written into the file.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const utc = new Date(ms);
    if (Number.isNaN(utc.getTime())) return '';
    return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}T${pad2(utc.getUTCHours())}:${pad2(utc.getUTCMinutes())}`;
  }
  if (typeof v === 'string' && v.trim()) {
    const s = v.trim();
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/.exec(s);
    if (m) {
      return `${m[3]}-${pad2(+m[2]!)}-${pad2(+m[1]!)}T${pad2(+m[4]!)}:${pad2(+m[5]!)}`;
    }
  }
  return '';
}

function parseYn(raw: string): AdYn {
  return /^y(es)?$/i.test(raw.trim()) ? 'Yes' : 'No';
}

/**
 * Parse `YYYY-MM-DDTHH:mm` as a timezone-naive Date for ExcelJS.
 * Date.UTC keeps the typed wall clock in the xlsx serial (no local TZ shift).
 */
export function parseAdLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function yn(v: AdYn | boolean): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return v;
}

function setText(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number): void {
  const cell = ws.getCell(row, col);
  cell.value = value;
}

function setDate(ws: ExcelJS.Worksheet, row: number, col: number, isoLocal: string): void {
  const d = parseAdLocalDateTime(isoLocal);
  if (!d) return;
  const cell = ws.getCell(row, col);
  cell.value = d;
  if (!cell.numFmt) cell.numFmt = 'm/d/yy "h":mm';
}

function writePilot(ws: ExcelJS.Worksheet, col: number, action: AdPilotAction): void {
  const rows = AD_PILOT_EXCEL_ROWS[action.kind];
  setText(ws, rows.used, col, 'Yes');
  if (rows.pec != null) setText(ws, rows.pec, col, action.pec === 'Yes' ? 'Yes' : 'No');
  if (action.onboarding) setDate(ws, rows.on, col, action.onboarding);
  if (action.disembarkment) setDate(ws, rows.off, col, action.disembarkment);
  setText(ws, rows.wait, col, adWaitMinsNumber(action.waitMins));
  setText(ws, rows.vain, col, action.vain === 'Yes' ? 'Yes' : 'No');
}

function writeTug(ws: ExcelJS.Worksheet, col: number, action: AdTugAction): void {
  const rows = AD_TUG_EXCEL_ROWS[action.kind];
  setText(ws, rows.qty, col, action.quantity > 0 ? action.quantity : 1);
  if (action.start) setDate(ws, rows.start, col, action.start);
  if (action.end) setDate(ws, rows.end, col, action.end);
  setText(ws, rows.reason, col, action.reason.trim() || 'Safety');
  setText(ws, rows.wait, col, adWaitMinsNumber(action.waitMins));
  setText(ws, rows.vain, col, action.vain === 'Yes' ? 'Yes' : 'No');
}

/**
 * Load the blank A&D template and write draft values into terminal columns.
 * Does not alter sheet structure / formatting beyond cell values.
 */
export async function buildAdReportXlsxBytes(draft: AdReportDraft): Promise<Uint8Array> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Could not load A&D template (${res.status})`);
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws =
    wb.getWorksheet(SHEET_NAME) ??
    wb.worksheets.find((s) => /a\s*&\s*d/i.test(s.name)) ??
    wb.worksheets[0];
  if (!ws) throw new Error('A&D sheet missing in template');

  setText(ws, 2, 4, draft.vessel.trim());
  setText(ws, 3, 4, draft.master.trim());
  setText(ws, 4, 4, draft.portCallId.trim());
  setText(ws, 5, 4, draft.portCode.trim().toUpperCase());

  // Skip blank-code slots so they don't become an empty first column on re-open.
  const terminals = draft.terminals
    .filter((t) => t.code.trim())
    .slice(0, AD_MAX_TERMINALS);
  terminals.forEach((term, i) => {
    const col = AD_FIRST_TERMINAL_COL + i;
    setText(ws, 6, col, term.code.trim().toUpperCase());
    setText(ws, 7, col, yn(term.layBy));

    for (const action of term.actions) {
      if (isAdPilotAction(action)) writePilot(ws, col, action);
      else if (isAdTugAction(action)) writeTug(ws, col, action);
    }

    const r = term.remarks;
    setText(ws, 60, col, adWaitMinsNumber(r.boatmenWaitMins));
    setText(ws, 63, col, r.shoreGangway);
    setText(ws, 64, col, r.shoreGangwayShift);
    if (r.hatchCoverQty.trim()) {
      const n = Number(r.hatchCoverQty.trim().replace(',', '.'));
      setText(ws, 65, col, Number.isFinite(n) ? n : r.hatchCoverQty.trim());
    }
    if (r.draftArrival.trim()) {
      const n = Number(r.draftArrival.trim().replace(',', '.'));
      setText(ws, 66, col, Number.isFinite(n) ? n : r.draftArrival.trim());
    }
    if (r.draftDeparture.trim()) {
      const n = Number(r.draftDeparture.trim().replace(',', '.'));
      setText(ws, 67, col, Number.isFinite(n) ? n : r.draftDeparture.trim());
    }
    if (r.miscRemarks.trim()) setText(ws, 70, col, r.miscRemarks.trim());
  });

  const out = await wb.xlsx.writeBuffer();
  return new Uint8Array(out);
}

function readPilot(
  ws: ExcelJS.Worksheet,
  col: number,
  kind: AdPilotAction['kind'],
): AdPilotAction | null {
  const rows = AD_PILOT_EXCEL_ROWS[kind];
  const used = cellText(ws, rows.used, col);
  const on = cellToAdLocalDateTime(ws, rows.on, col);
  const off = cellToAdLocalDateTime(ws, rows.off, col);
  if (!/^y(es)?$/i.test(used) && !on && !off) return null;
  const action = createAdAction(kind);
  if (!isAdPilotAction(action)) return null;
  action.onboarding = on;
  action.disembarkment = off;
  if (rows.pec != null) action.pec = parseYn(cellText(ws, rows.pec, col));
  action.waitMins = String(adWaitMinsNumber(cellText(ws, rows.wait, col)));
  action.vain = parseYn(cellText(ws, rows.vain, col));
  return action;
}

function readTug(
  ws: ExcelJS.Worksheet,
  col: number,
  kind: AdTugAction['kind'],
): AdTugAction | null {
  const rows = AD_TUG_EXCEL_ROWS[kind];
  const qtyRaw = cellText(ws, rows.qty, col);
  const start = cellToAdLocalDateTime(ws, rows.start, col);
  const end = cellToAdLocalDateTime(ws, rows.end, col);
  const reason = cellText(ws, rows.reason, col);
  if (!qtyRaw && !start && !end && !reason) return null;
  const action = createAdAction(kind);
  if (!isAdTugAction(action)) return null;
  const qty = Number(qtyRaw.replace(',', '.'));
  action.quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
  action.start = start;
  action.end = end;
  action.reason = reason || 'Safety';
  action.waitMins = String(adWaitMinsNumber(cellText(ws, rows.wait, col)));
  action.vain = parseYn(cellText(ws, rows.vain, col));
  return action;
}

/** Parse a filled A&D workbook back into an editable draft. */
export async function parseAdReportFromXlsxBytes(bytes: Uint8Array): Promise<AdReportDraft> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws =
    wb.getWorksheet(SHEET_NAME) ??
    wb.worksheets.find((s) => /a\s*&\s*d/i.test(s.name)) ??
    wb.worksheets[0];
  if (!ws) throw new Error('A&D sheet missing in file');

  const draft = createEmptyAdDraft({
    vessel: cellText(ws, 2, 4),
    master: cellText(ws, 3, 4),
    portCallId: cellText(ws, 4, 4),
    portCode: cellText(ws, 5, 4).toUpperCase(),
    terminals: [],
  });

  const pilotKinds = Object.keys(AD_PILOT_EXCEL_ROWS) as AdPilotAction['kind'][];
  const tugKinds = Object.keys(AD_TUG_EXCEL_ROWS) as AdTugAction['kind'][];

  for (let i = 0; i < AD_MAX_TERMINALS; i++) {
    const col = AD_FIRST_TERMINAL_COL + i;
    const code = cellText(ws, 6, col).toUpperCase();
    if (!code) break;

    const term: AdTerminal = createAdTerminal(code);
    term.layBy = parseYn(cellText(ws, 7, col)) === 'Yes';

    const actions: AdAction[] = [];
    for (const kind of pilotKinds) {
      const a = readPilot(ws, col, kind);
      if (a) actions.push(a);
    }
    for (const kind of tugKinds) {
      const a = readTug(ws, col, kind);
      if (a) actions.push(a);
    }
    term.actions = actions;

    const remarks = createEmptyAdRemarks();
    const gs = cellText(ws, 63, col);
    const gss = cellText(ws, 64, col);
    if (gs) remarks.shoreGangway = parseYn(gs);
    if (gss) remarks.shoreGangwayShift = parseYn(gss);
    remarks.boatmenWaitMins = String(adWaitMinsNumber(cellText(ws, 60, col)));
    remarks.hatchCoverQty = cellText(ws, 65, col);
    remarks.draftArrival = cellText(ws, 66, col);
    remarks.draftDeparture = cellText(ws, 67, col);
    remarks.miscRemarks = cellText(ws, 70, col);
    term.remarks = remarks;

    draft.terminals.push(term);
  }

  if (!draft.terminals.length) draft.terminals = [createAdTerminal()];
  return draft;
}

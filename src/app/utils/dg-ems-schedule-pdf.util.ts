import type { MfagScheduleRef } from '../data/dg-mfag-reference';
import type { DgPdfTextItem } from './dg-pdf-text.util';

/** EmS schedule PDF extracts are small; keep a hard cap like chapter 3.2. */
export const EMS_SCHEDULE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const EMS_SCHEDULE_MAX_FILE_MB = 10;

export type EmsScheduleKind = 'fire' | 'spillage';

export interface EmsScheduleParseResult {
  kind: EmsScheduleKind;
  rows: MfagScheduleRef[];
  /** Index page that listed codes → book pages. */
  indexPage: number;
  totalPages: number;
  warnings: string[];
}

export class EmsScheduleParseError extends Error {}

const FIRE_TITLE = /Emergency schedules for FIRE/i;
const SPILLAGE_TITLE = /Emergency schedules for SPILLAGE/i;
/** Exact token, or code glued to leader dots: `S–C ……` / `F–A … 23`. */
const CODE_RE = /^([FS])[\u2013\u2014\-]([A-Z])(?:\b|(?=[\s.…·]))/i;

function normalizeEmsCode(raw: string): string {
  const m = CODE_RE.exec(String(raw ?? '').trim());
  if (!m) return '';
  return `${m[1]!.toUpperCase()}-${m[2]!.toUpperCase()}`;
}

function formatPageRef(start: number, end: number): string {
  if (end > start) return `p.${start}-${end}`;
  return `p.${start}`;
}

/**
 * Build page ranges from index start pages.
 * Multi-page schedules (F-F, S-S, S-U) span until the next schedule’s start − 1.
 */
export function pageRefsFromIndexStarts(
  starts: ReadonlyArray<{ code: string; startPage: number }>,
): MfagScheduleRef[] {
  const sorted = [...starts].sort((a, b) => a.startPage - b.startPage || a.code.localeCompare(b.code));
  return sorted.map((row, i) => {
    const next = sorted[i + 1];
    const end = next ? Math.max(row.startPage, next.startPage - 1) : row.startPage;
    return { code: row.code, pageRef: formatPageRef(row.startPage, end) };
  });
}

/** Parse one EmS FIRE or SPILLAGE schedule PDF (index page → code / book page). */
export function parseEmsSchedulePdf(items: readonly DgPdfTextItem[]): EmsScheduleParseResult {
  if (!items.length) {
    throw new EmsScheduleParseError('PDF has no extractable text.');
  }

  const byPage = new Map<number, DgPdfTextItem[]>();
  for (const item of items) {
    const bucket = byPage.get(item.page);
    if (bucket) bucket.push(item);
    else byPage.set(item.page, [item]);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const warnings: string[] = [];

  let kind: EmsScheduleKind | null = null;
  let indexPage = 0;
  let starts: { code: string; startPage: number }[] = [];

  for (const page of pages) {
    const pageItems = byPage.get(page) ?? [];
    const titleFire = pageItems.some((it) => FIRE_TITLE.test(it.str));
    const titleSpill = pageItems.some((it) => SPILLAGE_TITLE.test(it.str));
    if (!titleFire && !titleSpill) continue;

    const pageStarts = extractIndexStarts(pageItems);
    if (pageStarts.length < 3) continue;

    const pageKind: EmsScheduleKind = titleFire ? 'fire' : 'spillage';
    if (kind && kind !== pageKind) {
      warnings.push(`Mixed FIRE/SPILLAGE titles — using ${pageKind} index on page ${page}.`);
    }
    kind = pageKind;
    indexPage = page;
    starts = pageStarts;
    break;
  }

  if (!kind || !starts.length) {
    throw new EmsScheduleParseError(
      'No EmS schedule index found. Drop the EmS Guide FIRE or SPILLAGE schedules PDF (page “Emergency schedules for FIRE/SPILLAGE”).',
    );
  }

  const expectedPrefix = kind === 'fire' ? 'F-' : 'S-';
  starts = starts.filter((s) => s.code.startsWith(expectedPrefix));
  if (!starts.length) {
    throw new EmsScheduleParseError(`Index on page ${indexPage} has no ${expectedPrefix}* codes.`);
  }

  const rows = pageRefsFromIndexStarts(starts);
  const expectedCount = kind === 'fire' ? 10 : 26;
  if (rows.length < expectedCount) {
    warnings.push(`Expected about ${expectedCount} ${kind} codes, found ${rows.length}.`);
  }

  return { kind, rows, indexPage, totalPages: pages.length, warnings };
}

function extractIndexStarts(
  pageItems: readonly DgPdfTextItem[],
): { code: string; startPage: number }[] {
  const lines = new Map<number, DgPdfTextItem[]>();
  for (const it of pageItems) {
    const key = Math.round(it.y / 2) * 2;
    const bucket = lines.get(key);
    if (bucket) bucket.push(it);
    else lines.set(key, [it]);
  }

  const out: { code: string; startPage: number }[] = [];
  const seen = new Set<string>();

  for (const y of [...lines.keys()].sort((a, b) => a - b)) {
    const row = (lines.get(y) ?? []).slice().sort((a, b) => a.x - b.x);
    let code = '';
    let startPage = 0;
    for (const it of row) {
      const c = normalizeEmsCode(it.str);
      if (c) {
        code = c;
        continue;
      }
      // Page number is usually the rightmost short integer on the row.
      if (/^\d{1,3}$/.test(it.str)) {
        const n = Number(it.str);
        if (n >= 1 && n <= 200) startPage = n;
      }
      // Sometimes "..... 23" is one token
      const m = it.str.match(/(\d{1,3})\s*$/);
      if (m && !CODE_RE.test(it.str)) {
        const n = Number(m[1]);
        if (n >= 1 && n <= 200) startPage = n;
      }
    }
    if (!code || !startPage || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, startPage });
  }

  return out;
}

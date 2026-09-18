import { normalizeCrewCabin, type CrewMember } from '../models/crew.models';
import type { PhoneDirectoryRow } from '../models/phone.models';

function rankKey(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Strip watch window like "00:00-04:00" from Subscribe (OS rows). */
function stripWatchSuffix(raw: string): string {
  return String(raw ?? '')
    .replace(/\d{1,2}:\d{2}\s*[-–—/]\s*\d{1,2}:\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keys to try for a Subscribe / rank label (without watch hours, then full text). */
function rankLookupKeys(raw: string): string[] {
  const keys: string[] = [];
  const full = rankKey(raw);
  const base = rankKey(stripWatchSuffix(raw));
  if (base) keys.push(base);
  if (full && full !== base) keys.push(full);
  return keys;
}

function surnameOf(member: Pick<CrewMember, 'familyName'>): string {
  return String(member.familyName ?? '')
    .trim()
    .toUpperCase();
}

function activeCrewForPhone(crew: readonly CrewMember[]): CrewMember[] {
  return crew.filter((c) => !c.archived && (c.onArrivalList || c.onDepartureList));
}

/**
 * Fill PHONE Name cells with crew surnames.
 * Matches by cabin when the crew member has Cabin set.
 * If `cabinOnly` is true: only those matched rows get a surname; all other Name cells are cleared.
 * If `cabinOnly` is false: also tries unique rank ↔ Subscribe
 * (Subscribe may include OS watch times like "OS 00:00-04:00"); unmatched rows keep their Name.
 */
export function syncPhoneSurnamesFromCrew(
  rows: readonly PhoneDirectoryRow[],
  crew: readonly CrewMember[],
  options?: { cabinOnly?: boolean },
): { rows: PhoneDirectoryRow[]; changedExcelRows: number[] } {
  const cabinOnly = options?.cabinOnly !== false;
  const active = activeCrewForPhone(crew);
  const byCabin = new Map<string, CrewMember>();
  const byRank = new Map<string, CrewMember | null>();

  for (const m of active) {
    const cabin = normalizeCrewCabin(m.cabin);
    if (cabin && !byCabin.has(cabin)) byCabin.set(cabin, m);

    if (!cabinOnly) {
      for (const rk of rankLookupKeys(m.rank)) {
        if (byRank.has(rk)) byRank.set(rk, null); // ambiguous
        else byRank.set(rk, m);
      }
    }
  }

  const changedExcelRows: number[] = [];
  const next = rows.map((row) => {
    let member: CrewMember | undefined;

    const cabin = normalizeCrewCabin(row.cabin);
    if (cabin) member = byCabin.get(cabin);

    if (!member && !cabinOnly) {
      for (const rk of rankLookupKeys(row.subscribe)) {
        const hit = byRank.get(rk);
        if (hit) {
          member = hit;
          break;
        }
      }
    }

    if (!member) {
      if (!cabinOnly || !row.name.trim()) return { ...row };
      changedExcelRows.push(row.excelRow);
      return { ...row, name: '' };
    }

    const surname = surnameOf(member);
    if (!surname) {
      if (!cabinOnly || !row.name.trim()) return { ...row };
      changedExcelRows.push(row.excelRow);
      return { ...row, name: '' };
    }
    if (row.name.trim().toUpperCase() === surname) return { ...row };

    changedExcelRows.push(row.excelRow);
    return { ...row, name: surname };
  });

  return { rows: next, changedExcelRows };
}

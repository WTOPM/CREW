/** One monitoring day with time slots (HHmm) for reefer log export. */
export interface ReeferMonitoringDay {
  isoDate: string;
  label: string;
  times: readonly string[];
}

const DEFAULT_TIMES = ['0830', '1655'] as const;

function parseIsoDate(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonitoringDateLabel(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Build daily monitoring columns from departure through arrival (min 5 days). */
export function buildReeferMonitoringDays(
  departureIso: string,
  arrivalIso: string,
): ReeferMonitoringDay[] {
  const start = parseIsoDate(departureIso) ?? new Date();
  let end = parseIsoDate(arrivalIso);
  if (!end || end < start) {
    end = addDays(start, 4);
  }
  const minEnd = addDays(start, 4);
  if (end < minEnd) end = minEnd;

  const days: ReeferMonitoringDay[] = [];
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  for (let cursor = new Date(start), idx = 0; cursor <= end; cursor = addDays(cursor, 1), idx++) {
    const isoDate = toIsoDate(cursor);
    days.push({
      isoDate,
      label: formatMonitoringDateLabel(isoDate),
      times: idx === dayCount - 1 ? ['0800', '1655'] : [...DEFAULT_TIMES],
    });
  }
  return days;
}

export function reeferLoadTempForExport(setPoint: string): string {
  const v = setPoint.trim();
  if (!v) return '';
  const m = v.match(/^(-?\d+(?:\.\d+)?)/);
  return m ? m[1] : v;
}

export function reeferMonitoringYear(departureIso: string): string {
  const d = parseIsoDate(departureIso);
  return d ? String(d.getFullYear()) : String(new Date().getFullYear());
}

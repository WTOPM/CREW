export const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface CalendarCell {
  key: string;
  day: number;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoFromParts(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const iso = `${year}-${m}-${d}`;
  return Number.isNaN(Date.parse(iso)) ? '' : iso;
}

export function partsFromIso(
  iso: string,
): { year: number; monthIndex: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return { year: y, monthIndex: m - 1, day: d };
}

export function buildMonthGrid(
  year: number,
  monthIndex: number,
  selectedIso: string,
): CalendarCell[] {
  const today = todayIsoLocal();
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    const prevDate = new Date(year, monthIndex, -startOffset + i + 1);
    const py = prevDate.getFullYear();
    const pm = prevDate.getMonth();
    const pd = prevDate.getDate();
    const iso = isoFromParts(py, pm, pd);
    cells.push({
      key: `p-${iso}`,
      day: pd,
      iso,
      inMonth: false,
      isToday: iso === today,
      isSelected: iso === selectedIso,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoFromParts(year, monthIndex, day);
    cells.push({
      key: `c-${iso}`,
      day,
      iso,
      inMonth: true,
      isToday: iso === today,
      isSelected: iso === selectedIso,
    });
  }

  let tail = 1;
  while (cells.length % 7 !== 0) {
    const nextDate = new Date(year, monthIndex + 1, tail);
    const ny = nextDate.getFullYear();
    const nm = nextDate.getMonth();
    const nd = nextDate.getDate();
    const iso = isoFromParts(ny, nm, nd);
    cells.push({
      key: `n-${iso}`,
      day: nd,
      iso,
      inMonth: false,
      isToday: iso === today,
      isSelected: iso === selectedIso,
    });
    tail++;
  }

  return cells;
}

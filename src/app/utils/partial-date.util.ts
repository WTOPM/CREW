import { formatDisplayDate } from './date.util';

export function currentMonthYear(): { mm: string; yyyy: string; isoPrefix: string } {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return { mm, yyyy, isoPrefix: `${yyyy}-${mm}-` };
}

export function defaultIsoDateInCurrentMonth(day = '01'): string {
  const { isoPrefix } = currentMonthYear();
  return `${isoPrefix}${day}`;
}

export function preparePartialDateOnFocus(iso: string): { text: string; iso: string } {
  const { mm, yyyy, isoPrefix } = currentMonthYear();
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const newIso = `${isoPrefix}01`;
    return { text: `01.${mm}.${yyyy}`, iso: newIso };
  }
  return { text: formatDisplayDate(iso), iso };
}

export function isoFromPartialDayInput(raw: string, fallbackIso = ''): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallbackIso;

  const fullMatch = trimmed.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (fullMatch) {
    const iso = `${fullMatch[3]}-${fullMatch[2]}-${fullMatch[1].padStart(2, '0')}`;
    return isValidIso(iso) ? iso : fallbackIso;
  }

  const parts = trimmed.split('.');
  const dayDigits = (parts[0] ?? '').replace(/\D/g, '').slice(0, 2);
  let day = '01';
  if (dayDigits.length === 1) day = `0${dayDigits}`;
  else if (dayDigits.length >= 2) day = dayDigits.slice(0, 2);

  const dayNum = Math.min(31, Math.max(1, parseInt(day, 10) || 1));
  day = String(dayNum).padStart(2, '0');

  const { mm, yyyy, isoPrefix } = currentMonthYear();
  if (parts.length >= 3 && /^\d{4}$/.test(parts[2])) {
    const m = parts[1].replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    const y = parts[2];
    const iso = `${y}-${m}-${day}`;
    return isValidIso(iso) ? iso : fallbackIso;
  }

  const iso = `${isoPrefix}${day}`;
  return isValidIso(iso) ? iso : fallbackIso;
}

function isValidIso(iso: string): boolean {
  return !isNaN(Date.parse(iso));
}

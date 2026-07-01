/** Short date for IMO form: dd.MM.yy */
export function formatBirthDateShort(value: string | undefined | null): string {
  const full = formatBirthDate(value);
  if (!full) return '';
  const parts = full.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2].slice(2)}`;
  }
  return full;
}

/** Excel serial (days since 1899-12-30) → ISO date string yyyy-MM-dd */
export function excelSerialToIso(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' && value.includes('.')) {
    const trimmed = value.trim();
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) {
      return parseDotDate(trimmed);
    }
    const n = parseFloat(trimmed);
    if (isNaN(n)) return trimmed;
    return serialToIso(n);
  }
  if (typeof value === 'number') return serialToIso(value);
  const n = parseFloat(String(value));
  if (!isNaN(n) && n > 1000 && n < 100000) return serialToIso(n);
  return String(value);
}

function serialToIso(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  if (isNaN(date.getTime())) return String(serial);
  return date.toISOString().slice(0, 10);
}

function parseDotDate(value: string): string {
  const [d, m, yRaw] = value.split('.');
  let y = parseInt(yRaw, 10);
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isNaN(Date.parse(iso)) ? value : iso;
}

/** Parse legacy range "dd.MM.yyyy-dd.MM.yyyy" → ISO issue/expiry dates. */
export function parseValidityRange(value: string | undefined | null): {
  issue: string;
  expiry: string;
} {
  const v = value?.trim() ?? '';
  if (!v) return { issue: '', expiry: '' };

  const match = v.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (match) {
    return {
      issue: excelSerialToIso(match[1].trim()),
      expiry: excelSerialToIso(match[2].trim()),
    };
  }

  const single = excelSerialToIso(v);
  return { issue: '', expiry: single };
}

/** Display as dd.MM.yyyy */
export function formatDisplayDate(value: string | undefined | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  return value;
}

/** Add calendar years to an ISO date (yyyy-MM-dd). */
export function addYearsToIsoDate(iso: string, years: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + years);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function isoFromDayMonthYear(dd: number, mm: number, yyyy: number): string | null {
  const iso = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  if (date.getFullYear() !== yyyy || date.getMonth() + 1 !== mm || date.getDate() !== dd) return null;
  return iso;
}

/** Parse common pasted date strings → ISO yyyy-MM-dd, or null. */
export function parsePastedDateToIso(raw: string): string | null {
  const v = raw.trim().replace(/\u00a0/g, ' ').replace(/\s+/g, '');
  if (!v) return null;

  let m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return isoFromDayMonthYear(+m[1], +m[2], +m[3]);

  m = v.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) return isoFromDayMonthYear(+m[3], +m[2], +m[1]);

  m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})$/);
  if (m) {
    let y = +m[3];
    y += y < 50 ? 2000 : 1900;
    return isoFromDayMonthYear(+m[1], +m[2], y);
  }

  return null;
}

/** For PDF: show DOB — may be ISO or legacy excel serial stored as string number */
export function formatBirthDate(value: string | undefined | null): string {
  if (!value) return '';
  const n = parseFloat(value);
  if (!isNaN(n) && n > 1000 && n < 100000 && !value.includes('-')) {
    return formatDisplayDate(excelSerialToIso(n));
  }
  return formatDisplayDate(value);
}

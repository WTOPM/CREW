/** Parse flash point text to °C (e.g. "-10 °C", "37", "+5.5°C"). */
export function parseFlashPointCelsius(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === '—' || raw === '-') return null;
  const m = raw.match(/^([+-]?)(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const num = Number.parseFloat(m[2]!.replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return m[1] === '-' ? -num : num;
}

/** Canonical inventory display: `30,0 C` / `-30,0 C` (comma, one decimal, space + C). */
export function formatUnifeederFlashPoint(celsius: number): string {
  const sign = celsius < 0 ? '-' : '';
  const abs = Math.abs(celsius);
  const oneDecimal = abs.toFixed(1).replace('.', ',');
  return `${sign}${oneDecimal} C`;
}

/**
 * Suggest canonical flash-point text when the typed value is a temperature
 * but not yet in inventory form (`30` / `30.0` → `30,0 C`).
 * Returns null when already formatted or not a number.
 */
export function suggestUnifeederFlashPointFormat(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const celsius = parseFlashPointCelsius(trimmed);
  if (celsius === null) return null;
  const formatted = formatUnifeederFlashPoint(celsius);
  const normalizedInput = trimmed.replace(/°/g, '').replace(/\s+/g, ' ').trim();
  if (normalizedInput === formatted) return null;
  return formatted;
}

export function dgFlashPointTone(value: string): 'negative' | 'positive' | 'neutral' {
  const celsius = parseFlashPointCelsius(value);
  if (celsius === null) return 'neutral';
  if (celsius < 0) return 'negative';
  if (celsius > 0) return 'positive';
  return 'neutral';
}

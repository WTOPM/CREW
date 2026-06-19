/** Parse flash point text to °C (e.g. "-10 °C", "37", "+5.5°C"). */
export function parseFlashPointCelsius(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === '—' || raw === '-') return null;
  const m = raw.match(/^([+-]?)(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const num = Number.parseFloat(m[2].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return m[1] === '-' ? -num : num;
}

export function dgFlashPointTone(value: string): 'negative' | 'positive' | 'neutral' {
  const celsius = parseFlashPointCelsius(value);
  if (celsius === null) return 'neutral';
  if (celsius < 0) return 'negative';
  if (celsius > 0) return 'positive';
  return 'neutral';
}

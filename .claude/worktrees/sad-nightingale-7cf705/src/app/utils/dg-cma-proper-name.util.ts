import type { DgPdfTextItem } from './dg-pdf-text.util';

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
}

function isFieldMarker(str: string): boolean {
  return /^\(\d+\)$/.test(str.trim());
}

function isExcludedNameFragment(str: string): boolean {
  const s = str.trim();
  if (!s || isFieldMarker(s)) return true;
  if (/^[\d,.]+$/.test(s.replace(/,/g, ''))) return true;
  if (/^-?\d+(?:\.\d+)?\s*°\s*C$/i.test(s)) return true;
  if (/^Approval Number:/i.test(s)) return true;
  if (/^\d{8,}$/.test(s)) return true;
  if (/^\+?\d[\d\s-]{7,}$/.test(s)) return true;
  if (/Marine Pollutant|Limited Quantity|Excepted Quantity/i.test(s)) return true;
  if (/^x$/i.test(s)) return true;
  return false;
}

function markerCol(nameCol: readonly [number, number]): readonly [number, number] {
  return [nameCol[0] - 22, nameCol[0] + 8] as const;
}

function findFieldMarkerY(
  items: readonly DgPdfTextItem[],
  page: number,
  yMin: number,
  yMax: number,
  fieldNo: number,
  nameCol: readonly [number, number],
): number | null {
  const col = markerCol(nameCol);
  const label = `(${fieldNo})`;
  for (const it of items) {
    if (it.page !== page) continue;
    if (it.y < yMin || it.y > yMax) continue;
    if (!inCol(it.x, col)) continue;
    if (it.str.trim() !== label) continue;
    return it.y;
  }
  return null;
}

function pickNameLinesBetween(
  items: readonly DgPdfTextItem[],
  page: number,
  nameCol: readonly [number, number],
  startY: number,
  endY: number,
): string[] {
  const byY = new Map<number, string[]>();

  for (const it of items) {
    if (it.page !== page) continue;
    if (it.y < startY || it.y >= endY) continue;
    if (!inCol(it.x, nameCol)) continue;
    const s = it.str.trim();
    if (isExcludedNameFragment(s)) continue;
    const parts = byY.get(it.y) ?? [];
    parts.push(s);
    byY.set(it.y, parts);
  }

  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, parts]) => parts.join(' ').trim())
    .filter(Boolean);
}

/** CMA manifests often place the first (2) text line 1–3 pt above the (2) marker. */
function resolveField2ExclusiveEndY(
  items: readonly DgPdfTextItem[],
  page: number,
  nameCol: readonly [number, number],
  startY: number,
  field2Y: number,
): number {
  const nameLineYs: number[] = [];

  for (const it of items) {
    if (it.page !== page) continue;
    if (it.y <= startY || it.y >= field2Y) continue;
    if (!inCol(it.x, nameCol)) continue;
    if (isExcludedNameFragment(it.str)) continue;
    if (!nameLineYs.includes(it.y)) nameLineYs.push(it.y);
  }

  nameLineYs.sort((a, b) => a - b);
  if (!nameLineYs.length) return field2Y;

  const lastY = nameLineYs[nameLineYs.length - 1]!;
  if (field2Y - lastY > 3) return field2Y;

  const prevY = nameLineYs.length >= 2 ? nameLineYs[nameLineYs.length - 2]! : startY;
  if (lastY - prevY >= 8) return lastY;

  return field2Y;
}

/**
 * CMA IMDG manifest / cargo list — field (1) only: all name lines up to (2), excluding
 * the technical name in field (2). Example:
 * ENVIRONMENTALLY HAZARDOUS SUBSTANCE, LIQUID, N.O.S.
 */
export function pickCmaManifestProperShippingName(
  items: readonly DgPdfTextItem[],
  anchorY: number,
  page: number,
  nameCol: readonly [number, number],
): string {
  const yMin = anchorY - 8;
  const yMax = anchorY + 45;

  const field1Y = findFieldMarkerY(items, page, yMin, yMax, 1, nameCol);
  const field2Y = findFieldMarkerY(items, page, anchorY - 2, yMax, 2, nameCol);

  const startY = field1Y ?? anchorY - 1;
  const endY =
    field2Y != null
      ? resolveField2ExclusiveEndY(items, page, nameCol, startY, field2Y)
      : startY + 28;

  const lines = pickNameLinesBetween(items, page, nameCol, startY, endY);
  if (lines.length) {
    return lines.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Fallback when field markers are missing.
  for (const delta of [-1, 0, 1, 2, 9]) {
    for (const it of items) {
      if (it.page !== page) continue;
      if (Math.abs(it.y - (anchorY + delta)) > 2) continue;
      if (!inCol(it.x, nameCol)) continue;
      const s = it.str.trim();
      if (!isExcludedNameFragment(s)) return s;
    }
  }

  return '';
}

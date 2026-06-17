import type { DgPdfTextItem } from './dg-pdf-text.util';

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
}

function nearY(item: DgPdfTextItem, y: number, tol = 2): boolean {
  return Math.abs(item.y - y) <= tol;
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

function pickNameFragmentAtY(
  items: readonly DgPdfTextItem[],
  y: number,
  page: number,
  nameCol: readonly [number, number],
): string {
  for (const it of items) {
    if (it.page !== page) continue;
    if (!nearY(it, y, 2) || !inCol(it.x, nameCol)) continue;
    const s = it.str.trim();
    if (isExcludedNameFragment(s)) continue;
    return s;
  }
  return '';
}

/**
 * CMA IMDG manifest / cargo list — proper shipping name spans field (1) line,
 * optional "N.O.S." continuation, and field (2) technical name.
 */
export function pickCmaManifestProperShippingName(
  items: readonly DgPdfTextItem[],
  anchorY: number,
  page: number,
  nameCol: readonly [number, number],
): string {
  const blockItems = items.filter(
    (it) => it.page === page && it.y >= anchorY - 4 && it.y <= anchorY + 40,
  );

  const line1 =
    pickNameFragmentAtY(blockItems, anchorY - 1, page, nameCol) ||
    pickNameFragmentAtY(blockItems, anchorY, page, nameCol) ||
    pickNameFragmentAtY(blockItems, anchorY + 1, page, nameCol);

  const nosLine = blockItems.find(
    (it) =>
      inCol(it.x, nameCol) &&
      it.y > anchorY &&
      it.y <= anchorY + 15 &&
      /^N\.O\.S\.?\.?$/i.test(it.str.trim()),
  );

  const field2Marker = blockItems.find(
    (it) => isFieldMarker(it.str) && it.str === '(2)' && it.y >= anchorY + 8 && it.y <= anchorY + 28,
  );
  const technicalName = field2Marker
    ? pickNameFragmentAtY(blockItems, field2Marker.y, page, nameCol)
    : '';

  let psn = line1.trim();
  if (nosLine) {
    psn = psn.replace(/,\s*$/, '');
    psn = psn ? `${psn}, N.O.S.` : 'N.O.S.';
  }

  const tech = technicalName.trim();
  if (tech && !/^N\.O\.S\.?\.?$/i.test(tech)) {
    if (!psn.toLowerCase().includes(tech.toLowerCase())) {
      psn = psn ? `${psn} (${tech})` : tech;
    }
  }

  return psn.replace(/\s+/g, ' ').trim();
}

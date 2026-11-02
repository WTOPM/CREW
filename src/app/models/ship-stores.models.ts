export const SHIP_STORES_ROW_COUNT = 27;
/** Form 02 (123.pdf) — 43 article rows. */
export const SHIP_STORES_02_ROW_COUNT = 43;
/** Form 03 (Germany) — 19 article rows. */
export const SHIP_STORES_03_ROW_COUNT = 19;

export interface ShipStoresRow {
  name: string;
  quantity: string;
  unit: string;
  /**
   * Optional qty calculator multipliers (e.g. `10 × 200` cigarettes, `10 × 24 × 0.33` beer).
   * When set (≥2 factors), `quantity` is the product shown/printed.
   */
  qtyFactors?: string[];
}

export interface ShipStoresFormSettings {
  /** Field 8 — Place of storage. */
  placeOfStorage: string;
  rows: ShipStoresRow[];
}

/** Max multipliers in the per-row qty calculator. */
export const SHIP_STORES_QTY_FACTOR_MAX = 4;

export function createEmptyShipStoresRow(): ShipStoresRow {
  return { name: '', quantity: '', unit: '', qtyFactors: [] };
}

export function createDefaultShipStoresForm(
  rowCount: number = SHIP_STORES_ROW_COUNT,
): ShipStoresFormSettings {
  return {
    placeOfStorage: '',
    rows: Array.from({ length: rowCount }, () => createEmptyShipStoresRow()),
  };
}

export function createDefaultShipStoresForm02(): ShipStoresFormSettings {
  return createDefaultShipStoresForm(SHIP_STORES_02_ROW_COUNT);
}

export function createDefaultShipStoresForm03(): ShipStoresFormSettings {
  return createDefaultShipStoresForm(SHIP_STORES_03_ROW_COUNT);
}

/** Quantity column: NIL only when article name is set and quantity is empty or zero. */
export function formatShipStoresQuantityText(articleName: string, quantity: string): string {
  if (!articleName.trim()) return '';
  const v = quantity.trim();
  if (!v) return '';
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isNaN(n) && n === 0) return 'NIL';
  return v;
}

/** Unit column: when article name and unit are set (including when qty is NIL). */
export function formatShipStoresUnitText(
  articleName: string,
  _quantity: string,
  unit: string,
): string {
  if (!articleName.trim()) return '';
  const u = unit.trim();
  if (!u || u === 'NIL') return '';
  return u;
}

export function normalizeShipStoresForm(
  raw: Partial<ShipStoresFormSettings> | undefined,
  rowCount: number = SHIP_STORES_ROW_COUNT,
): ShipStoresFormSettings {
  const defaults = createDefaultShipStoresForm(rowCount);
  const rows = [...(raw?.rows ?? [])];
  while (rows.length < rowCount) {
    rows.push(createEmptyShipStoresRow());
  }
  return {
    placeOfStorage: (raw?.placeOfStorage ?? defaults.placeOfStorage).trim(),
    rows: rows.slice(0, rowCount).map((r) => ({
      name: (r?.name ?? '').trim(),
      quantity: (r?.quantity ?? '').trim(),
      unit: normalizeShipStoresRowUnit(r?.unit),
      qtyFactors: normalizeShipStoresQtyFactors(
        (r as Partial<ShipStoresRow> | null | undefined)?.qtyFactors,
      ),
    })),
  };
}

/** Keep numeric factor strings only (additive; missing → []). */
export function normalizeShipStoresQtyFactors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? '').trim().replace(',', '.');
    if (!s || parseShipStoresQtyFactor(s) == null) continue;
    out.push(s);
    if (out.length >= SHIP_STORES_QTY_FACTOR_MAX) break;
  }
  return out;
}

export function parseShipStoresQtyFactor(raw: string): number | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Pretty product for the Qty cell (strip float junk / trailing zeros). */
export function formatShipStoresQtyProduct(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  let s = rounded.toFixed(6).replace(/\.?0+$/, '');
  return s;
}

/**
 * Product of ≥2 valid non-empty factors → quantity string.
 * Returns null when the expression is incomplete / invalid (do not overwrite Qty).
 */
export function evaluateShipStoresQtyFactors(factors: readonly string[]): string | null {
  const cleaned = normalizeShipStoresQtyFactors(factors);
  if (cleaned.length < 2) return null;
  const nums = cleaned.map(parseShipStoresQtyFactor);
  if (nums.some((n) => n == null)) return null;
  let product = 1;
  for (const n of nums) product *= n!;
  return formatShipStoresQtyProduct(product);
}

export function shipStoresRowHasQtyCalc(row: ShipStoresRow): boolean {
  return (row.qtyFactors?.length ?? 0) >= 2;
}

export function normalizeShipStoresForm02(
  raw: Partial<ShipStoresFormSettings> | undefined,
): ShipStoresFormSettings {
  return normalizeShipStoresForm(raw, SHIP_STORES_02_ROW_COUNT);
}

export function normalizeShipStoresForm03(
  raw: Partial<ShipStoresFormSettings> | undefined,
): ShipStoresFormSettings {
  return normalizeShipStoresForm(raw, SHIP_STORES_03_ROW_COUNT);
}

function normalizeShipStoresRowUnit(raw: unknown): string {
  const u = String(raw ?? '').trim();
  return u === 'NIL' ? '' : u;
}

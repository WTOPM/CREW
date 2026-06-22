export const SHIP_STORES_ROW_COUNT = 27;
/** Form 02 (123.pdf) — 43 article rows. */
export const SHIP_STORES_02_ROW_COUNT = 43;
/** Form 03 (Germany) — 19 article rows. */
export const SHIP_STORES_03_ROW_COUNT = 19;

export interface ShipStoresRow {
  name: string;
  quantity: string;
  unit: string;
}

export interface ShipStoresFormSettings {
  /** Field 8 — Place of storage. */
  placeOfStorage: string;
  rows: ShipStoresRow[];
}

export function createEmptyShipStoresRow(): ShipStoresRow {
  return { name: '', quantity: '', unit: '' };
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
    })),
  };
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

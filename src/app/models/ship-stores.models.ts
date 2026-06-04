export const SHIP_STORES_ROW_COUNT = 27;

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

export function createDefaultShipStoresForm(): ShipStoresFormSettings {
  return {
    placeOfStorage: '',
    rows: Array.from({ length: SHIP_STORES_ROW_COUNT }, () => createEmptyShipStoresRow()),
  };
}

/** Quantity column: NIL only when article name is set and quantity is empty or zero. */
export function formatShipStoresQuantityText(articleName: string, quantity: string): string {
  if (!articleName.trim()) return '';
  const v = quantity.trim();
  if (!v) return 'NIL';
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isNaN(n) && n === 0) return 'NIL';
  return v;
}

/** Unit column: when article name and unit are set (including when qty is NIL). */
export function formatShipStoresUnitText(articleName: string, _quantity: string, unit: string): string {
  if (!articleName.trim()) return '';
  const u = unit.trim();
  if (!u || u === 'NIL') return '';
  return u;
}

export function normalizeShipStoresForm(
  raw: Partial<ShipStoresFormSettings> | undefined,
): ShipStoresFormSettings {
  const defaults = createDefaultShipStoresForm();
  const rows = [...(raw?.rows ?? [])];
  while (rows.length < SHIP_STORES_ROW_COUNT) {
    rows.push(createEmptyShipStoresRow());
  }
  return {
    placeOfStorage: (raw?.placeOfStorage ?? defaults.placeOfStorage).trim(),
    rows: rows.slice(0, SHIP_STORES_ROW_COUNT).map((r) => ({
      name: (r?.name ?? '').trim(),
      quantity: (r?.quantity ?? '').trim(),
      unit: normalizeShipStoresRowUnit(r?.unit),
    })),
  };
}

function normalizeShipStoresRowUnit(raw: unknown): string {
  const u = String(raw ?? '').trim();
  return u === 'NIL' ? '' : u;
}

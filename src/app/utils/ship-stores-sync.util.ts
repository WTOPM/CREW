import {
  shipStoresFormField,
  type AppData,
  type ShipStoresDocId,
} from '../models/crew.models';
import {
  createEmptyShipStoresRow,
  normalizeShipStoresForm,
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
  type ShipStoresFormSettings,
  type ShipStoresRow,
} from '../models/ship-stores.models';

export interface ShipStoresCopyStats {
  from: ShipStoresDocId;
  to: ShipStoresDocId;
  /** Non-empty article rows written into the target. */
  transferred: number;
  /** Non-empty article rows beyond the target capacity. */
  didNotFit: number;
}

export interface ShipStoresCopyBuild {
  form: ShipStoresFormSettings;
  cellValues: Record<string, string>;
  stats: ShipStoresCopyStats;
}

export function shipStoresRowCountFor(docId: ShipStoresDocId): number {
  if (docId === 'shipStores03') return SHIP_STORES_03_ROW_COUNT;
  if (docId === 'shipStores02') return SHIP_STORES_02_ROW_COUNT;
  return SHIP_STORES_ROW_COUNT;
}

/** Body columns in the HTML grid (Form 02 has extra overlay-only cols). */
export function shipStoresBodyColCount(docId: ShipStoresDocId): number {
  return docId === 'shipStores02' ? 6 : 3;
}

export function shipStoresRowHasContent(row: ShipStoresRow): boolean {
  return !!(row.name.trim() || row.quantity.trim() || row.unit.trim());
}

function overlayCellValues(
  data: AppData,
  docId: ShipStoresDocId,
): Record<string, string> {
  const overlay = data.documentOverlay?.[docId] as
    | { cellValues?: Record<string, string> }
    | undefined;
  return overlay?.cellValues ?? {};
}

/**
 * Articles + place of storage as shown on the form (HTML overlay cells win over
 * persisted `shipStoresForm*` rows).
 */
export function readEffectiveShipStoresForm(
  data: AppData,
  docId: ShipStoresDocId,
): ShipStoresFormSettings {
  const rowCount = shipStoresRowCountFor(docId);
  const field = shipStoresFormField(docId);
  const form = normalizeShipStoresForm(data[field], rowCount);
  const cv = overlayCellValues(data, docId);
  const rows = form.rows.map((r, i) => {
    const name = cv[`d-${i}-0`] !== undefined ? String(cv[`d-${i}-0`]) : r.name;
    const quantity = cv[`d-${i}-1`] !== undefined ? String(cv[`d-${i}-1`]) : r.quantity;
    const unitRaw = cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : r.unit;
    const unit = unitRaw.trim() === 'NIL' ? '' : unitRaw;
    return {
      name: name.trim(),
      quantity: quantity.trim(),
      unit: unit.trim(),
    };
  });
  const placeOfStorage =
    cv['h-storage'] !== undefined
      ? String(cv['h-storage']).trim()
      : form.placeOfStorage;
  return { placeOfStorage, rows };
}

/**
 * Build target form + overlay cellValues after copying source → target capacity.
 * Only name / quantity / unit are copied. Extra Form 02 columns are cleared on
 * the target so stale overlay cells cannot override the synced rows.
 */
export function buildShipStoresCopy(
  source: ShipStoresFormSettings,
  from: ShipStoresDocId,
  to: ShipStoresDocId,
  existingTargetCellValues: Record<string, string> | undefined,
): ShipStoresCopyBuild {
  const targetRowCount = shipStoresRowCountFor(to);
  const targetCols = shipStoresBodyColCount(to);
  const fit = source.rows.slice(0, targetRowCount);
  const overflow = source.rows.slice(targetRowCount);
  const transferred = fit.filter(shipStoresRowHasContent).length;
  const didNotFit = overflow.filter(shipStoresRowHasContent).length;

  const padded = [...fit];
  while (padded.length < targetRowCount) {
    padded.push(createEmptyShipStoresRow());
  }

  const form = normalizeShipStoresForm(
    {
      placeOfStorage: source.placeOfStorage,
      rows: padded,
    },
    targetRowCount,
  );

  const cellValues = { ...(existingTargetCellValues ?? {}) };
  for (let i = 0; i < targetRowCount; i++) {
    for (let c = 0; c < targetCols; c++) {
      delete cellValues[`d-${i}-${c}`];
    }
  }
  delete cellValues['h-storage'];

  return {
    form,
    cellValues,
    stats: { from, to, transferred, didNotFit },
  };
}

export function formatShipStoresCopyToast(stats: ShipStoresCopyStats): string {
  const fromLabel = shortShipStoresLabel(stats.from);
  const toLabel = shortShipStoresLabel(stats.to);
  const base = `Ship Stores: ${stats.transferred} article${stats.transferred === 1 ? '' : 's'} ${fromLabel} → ${toLabel}`;
  if (stats.didNotFit <= 0) return base;
  return `${base}; ${stats.didNotFit} did not fit`;
}

function shortShipStoresLabel(id: ShipStoresDocId): string {
  if (id === 'shipStores03') return '03 Germany';
  if (id === 'shipStores02') return '02 Long';
  return '01 Short';
}

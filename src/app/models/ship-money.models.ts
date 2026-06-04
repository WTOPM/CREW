export const SHIP_MONEY_PAGE_HEIGHT_PT = 842;

export const SHIP_MONEY_FIRST_ROW_BASELINE_Y = 268;
export const SHIP_MONEY_ROW_STEP = 27;

export interface ShipMoneyEntry {
  id: string;
  amount: string;
  currency: string;
}

export interface ShipMoneyFormSettings {
  entries: ShipMoneyEntry[];
}

export function createShipMoneyEntry(amount = '', currency = ''): ShipMoneyEntry {
  return {
    id: crypto.randomUUID(),
    amount: amount.trim(),
    currency: currency.trim(),
  };
}

export function createDefaultShipMoneyForm(): ShipMoneyFormSettings {
  return {
    entries: [
      createShipMoneyEntry('2800', 'USD'),
      createShipMoneyEntry('6300', 'EURO'),
    ],
  };
}

export function shipMoneyRowBaselineY(compactIndex: number): number {
  return SHIP_MONEY_FIRST_ROW_BASELINE_Y + compactIndex * SHIP_MONEY_ROW_STEP;
}

export function normalizeShipMoneyForm(
  raw: Partial<ShipMoneyFormSettings> | undefined,
): ShipMoneyFormSettings {
  const defaults = createDefaultShipMoneyForm();
  const list = Array.isArray(raw?.entries) ? raw.entries : [];
  if (!list.length) {
    return defaults;
  }
  const entries = list
    .map((e) => ({
      id: (e?.id ?? '').trim() || crypto.randomUUID(),
      amount: (e?.amount ?? '').trim(),
      currency: (e?.currency ?? '').trim(),
    }))
    .filter((e) => e.amount.length > 0 || e.currency.length > 0);
  return { entries: entries.length ? entries : defaults.entries };
}

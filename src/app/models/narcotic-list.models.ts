export const NARCOTIC_LIST_PAGE_HEIGHT_PT = 842;

export const NARCOTIC_LIST_FIRST_ROW_BASELINE_Y = 211;
export const NARCOTIC_LIST_ROW_STEP = 30;

/** Two-line cells: top line above row baseline, bottom line below (from Narcotic List.pdf). */
export const NARCOTIC_LIST_CELL_TOP_OFFSET = -8;
export const NARCOTIC_LIST_CELL_BOTTOM_OFFSET = 7;

export const NARCOTIC_LIST_DEFAULT_UNITS_PER = 'per box';

export interface NarcoticMedicineEntry {
  id: string;
  name: string;
  dosage: string;
  quantity: string;
  /** Units top line, e.g. "20 tabs." */
  unitsPack: string;
  /** Units bottom line, usually "per box". */
  unitsPer: string;
  totalQuantity: string;
  expirationDate: string;
  controlNo: string;
  placeOfStorage: string;
}

export interface NarcoticListFormSettings {
  entries: NarcoticMedicineEntry[];
}

export function narcoticListRowBaselineY(rowIndex: number): number {
  return NARCOTIC_LIST_FIRST_ROW_BASELINE_Y + rowIndex * NARCOTIC_LIST_ROW_STEP;
}

export function narcoticListCellTopBaselineY(rowIndex: number): number {
  return narcoticListRowBaselineY(rowIndex) + NARCOTIC_LIST_CELL_TOP_OFFSET;
}

export function narcoticListCellBottomBaselineY(rowIndex: number): number {
  return narcoticListRowBaselineY(rowIndex) + NARCOTIC_LIST_CELL_BOTTOM_OFFSET;
}

/** @deprecated Use narcoticListCellTopBaselineY */
export const narcoticListNameTopBaselineY = narcoticListCellTopBaselineY;
/** @deprecated Use narcoticListCellBottomBaselineY */
export const narcoticListDosageBaselineY = narcoticListCellBottomBaselineY;

export function createNarcoticMedicineEntry(
  partial?: Partial<Omit<NarcoticMedicineEntry, 'id'> & { id?: string; units?: string }>,
): NarcoticMedicineEntry {
  const { unitsPack, unitsPer } = migrateLegacyUnits(partial ?? {});
  const existingId = (partial?.id ?? '').trim();
  return {
    id: existingId || crypto.randomUUID(),
    name: (partial?.name ?? '').trim(),
    dosage: (partial?.dosage ?? '').trim(),
    quantity: (partial?.quantity ?? '').trim(),
    unitsPack,
    unitsPer,
    totalQuantity: (partial?.totalQuantity ?? '').trim(),
    expirationDate: (partial?.expirationDate ?? '').trim(),
    controlNo: (partial?.controlNo ?? '').trim(),
    placeOfStorage: (partial?.placeOfStorage ?? "Master's Safe").trim(),
  };
}

const DEFAULT_NARCOTIC_ENTRIES: readonly Omit<NarcoticMedicineEntry, 'id'>[] = [
  {
    name: 'Codeine phosphate',
    dosage: '30mg tablets',
    quantity: '3',
    unitsPack: '20 tabs.',
    unitsPer: 'per box',
    totalQuantity: '60 tabs.',
    expirationDate: '10/2026',
    controlNo: 'Nr.3.b.1',
    placeOfStorage: "Master's Safe",
  },
  {
    name: 'Tramadol',
    dosage: '100mg/2ml injection',
    quantity: '2',
    unitsPack: '20 amps.',
    unitsPer: 'per box',
    totalQuantity: '40 amps.',
    expirationDate: '01/2029',
    controlNo: 'Nr.3.b.2',
    placeOfStorage: "Master's Safe",
  },
  {
    name: 'Diazepam injection',
    dosage: '5mg/1ml, 2ml',
    quantity: '1',
    unitsPack: '5 amps.',
    unitsPer: 'per box',
    totalQuantity: '5 amps.',
    expirationDate: '08/2026',
    controlNo: 'Nr.4.a.1',
    placeOfStorage: "Master's Safe",
  },
  {
    name: 'Diazepam rectal dispenser',
    dosage: '10mg/2.5ml',
    quantity: '2',
    unitsPack: '5 amps.',
    unitsPer: 'per box',
    totalQuantity: '10 amps.',
    expirationDate: '04/2027',
    controlNo: 'Nr.4.d.0',
    placeOfStorage: "Master's Safe",
  },
];

export function createDefaultNarcoticListForm(): NarcoticListFormSettings {
  return {
    entries: DEFAULT_NARCOTIC_ENTRIES.map((e) => createNarcoticMedicineEntry(e)),
  };
}

function migrateLegacyName(entry: Partial<NarcoticMedicineEntry & { units?: string }>): {
  name: string;
  dosage: string;
} {
  const name = (entry.name ?? '').trim();
  const dosage = (entry.dosage ?? '').trim();
  if (dosage || !name) {
    return { name, dosage };
  }
  return { name, dosage: '' };
}

function migrateLegacyUnits(entry: Partial<NarcoticMedicineEntry & { units?: string }>): {
  unitsPack: string;
  unitsPer: string;
} {
  const pack = (entry.unitsPack ?? '').trim();
  const per = (entry.unitsPer ?? '').trim();
  if (pack || per) {
    return { unitsPack: pack, unitsPer: per || NARCOTIC_LIST_DEFAULT_UNITS_PER };
  }
  const legacy = (entry.units ?? '').trim();
  if (!legacy) {
    return { unitsPack: '', unitsPer: NARCOTIC_LIST_DEFAULT_UNITS_PER };
  }
  const lower = legacy.toLowerCase();
  const perBox = lower.indexOf('per box');
  if (perBox >= 0) {
    return {
      unitsPack: legacy.slice(0, perBox).trim(),
      unitsPer: 'per box',
    };
  }
  const perWord = lower.lastIndexOf(' per ');
  if (perWord >= 0) {
    return {
      unitsPack: legacy.slice(0, perWord).trim(),
      unitsPer: legacy.slice(perWord + 1).trim(),
    };
  }
  return { unitsPack: legacy, unitsPer: NARCOTIC_LIST_DEFAULT_UNITS_PER };
}

export function normalizeNarcoticListForm(
  raw: Partial<NarcoticListFormSettings> | undefined,
): NarcoticListFormSettings {
  const defaults = createDefaultNarcoticListForm();
  const list = Array.isArray(raw?.entries) ? raw.entries : [];
  if (!list.length) {
    return defaults;
  }
  const entries = list.map((e) => {
    const { name, dosage } = migrateLegacyName(e ?? {});
    const { unitsPack, unitsPer } = migrateLegacyUnits(e ?? {});
    return createNarcoticMedicineEntry({
      id: e?.id,
      name,
      dosage,
      unitsPack,
      unitsPer,
      quantity: e?.quantity,
      totalQuantity: e?.totalQuantity,
      expirationDate: e?.expirationDate,
      controlNo: e?.controlNo,
      placeOfStorage: e?.placeOfStorage,
    });
  });
  return { entries: entries.length ? entries : defaults.entries };
}

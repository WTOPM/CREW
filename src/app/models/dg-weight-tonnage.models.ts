/** Import/display weight mode for DG tables. */
export interface DgWeightTonnageOptions {
  /** true = gross tonnage, false = net tonnage */
  useGrossWeight?: boolean;
  /** @deprecated Use useGrossWeight */
  grossTotalKg?: boolean;
}

export function resolveDgWeightTonnageOptions(options: DgWeightTonnageOptions = {}): {
  useGrossWeight: boolean;
} {
  if ('useGrossWeight' in options) {
    return { useGrossWeight: options.useGrossWeight !== false };
  }
  return { useGrossWeight: options.grossTotalKg !== false };
}

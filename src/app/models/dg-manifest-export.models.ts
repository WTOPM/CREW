import type { DgOnboardContainer } from './dg-manifest.models';
import type { DgUnifeederRow } from './dg-unifeeder.models';

/** Containers and filters as shown in the DG inventory when exporting. */
export interface DgManifestExportContext {
  containers: readonly DgOnboardContainer[];
  includeDischarged: boolean;
  mergeLines: boolean;
  grossTotalKg: boolean;
}

/** Rows and options as shown in the DP WORLD inventory when exporting. */
export interface DgUnifeederExportContext {
  rows: readonly DgUnifeederRow[];
  mergeLines: boolean;
  grossTotalKg: boolean;
}

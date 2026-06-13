import type { DgOnboardContainer } from './dg-manifest.models';

/** Containers and filters as shown in the DG inventory when exporting. */
export interface DgManifestExportContext {
  containers: readonly DgOnboardContainer[];
  includeDischarged: boolean;
  mergeLines: boolean;
}

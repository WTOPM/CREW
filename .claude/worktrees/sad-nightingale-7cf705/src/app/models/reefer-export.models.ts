import type { ReeferOnboardUnit } from './reefer.models';

/** Units and layout as shown in the Reefer inventory when exporting. */
export interface ReeferExportContext {
  units: readonly ReeferOnboardUnit[];
}

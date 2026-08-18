/** MFAG (Medical First Aid Guide) EMS schedule → page reference tables. */

export interface MfagScheduleRef {
  code: string;
  pageRef: string;
}

export const MFAG_FIRE_SCHEDULE_REFS: readonly MfagScheduleRef[] = [
  { code: 'F-A', pageRef: 'p.23' },
  { code: 'F-B', pageRef: 'p.24' },
  { code: 'F-C', pageRef: 'p.25' },
  { code: 'F-D', pageRef: 'p.26' },
  { code: 'F-E', pageRef: 'p.27' },
  { code: 'F-F', pageRef: 'p.28-29' },
  { code: 'F-G', pageRef: 'p.30' },
  { code: 'F-H', pageRef: 'p.31' },
  { code: 'F-I', pageRef: 'p.32' },
  { code: 'F-J', pageRef: 'p.33' },
];

export const MFAG_SPILLAGE_SCHEDULE_REFS: readonly MfagScheduleRef[] = [
  { code: 'S-A', pageRef: 'p.47' },
  { code: 'S-B', pageRef: 'p.48' },
  { code: 'S-C', pageRef: 'p.49' },
  { code: 'S-D', pageRef: 'p.50' },
  { code: 'S-E', pageRef: 'p.51' },
  { code: 'S-F', pageRef: 'p.52' },
  { code: 'S-G', pageRef: 'p.53' },
  { code: 'S-H', pageRef: 'p.54' },
  { code: 'S-I', pageRef: 'p.55' },
  { code: 'S-J', pageRef: 'p.56' },
  { code: 'S-K', pageRef: 'p.57' },
  { code: 'S-L', pageRef: 'p.58' },
  { code: 'S-M', pageRef: 'p.59' },
  { code: 'S-N', pageRef: 'p.60' },
  { code: 'S-O', pageRef: 'p.61' },
  { code: 'S-P', pageRef: 'p.62' },
  { code: 'S-Q', pageRef: 'p.63' },
  { code: 'S-R', pageRef: 'p.64' },
  { code: 'S-S', pageRef: 'p.65-66' },
  { code: 'S-T', pageRef: 'p.67' },
  { code: 'S-U', pageRef: 'p.68-69' },
  { code: 'S-V', pageRef: 'p.70' },
  { code: 'S-W', pageRef: 'p.71' },
  { code: 'S-X', pageRef: 'p.72' },
  { code: 'S-Y', pageRef: 'p.73' },
  { code: 'S-Z', pageRef: 'p.74' },
];

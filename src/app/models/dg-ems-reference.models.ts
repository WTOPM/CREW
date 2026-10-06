import type { MfagScheduleRef } from '../data/dg-mfag-reference';

/**
 * EmS Guide fire / spillage schedule → book page tables.
 * Bundled baseline ships with the app; user can replace either side by dropping
 * the official EmS FIRE / SPILLAGE PDF extracts (index page).
 */
export interface DgEmsReferenceLibrary {
  origin: 'bundled' | 'custom';
  fire: MfagScheduleRef[];
  spillage: MfagScheduleRef[];
  fireFileName: string;
  spillageFileName: string;
  updatedAt: string;
}

export function createDefaultDgEmsReference(): DgEmsReferenceLibrary {
  return {
    origin: 'bundled',
    fire: [],
    spillage: [],
    fireFileName: '',
    spillageFileName: '',
    updatedAt: '',
  };
}

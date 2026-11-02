import { describe, expect, it } from 'vitest';
import { createAdAction, isAdPilotAction, isAdTugAction } from '../models/a-and-d.models';
import {
  adActionSortMs,
  normalizeAdActionDisplaySort,
  sortAdActionsForDisplay,
} from './ad-action-display-sort.util';

describe('ad-action-display-sort', () => {
  it('normalizeAdActionDisplaySort defaults to document', () => {
    expect(normalizeAdActionDisplaySort(undefined)).toBe('document');
    expect(normalizeAdActionDisplaySort('timeline')).toBe('timeline');
    expect(normalizeAdActionDisplaySort('nope')).toBe('document');
  });

  it('adActionSortMs needs both date and time', () => {
    const a = createAdAction('harbour_in');
    if (!isAdPilotAction(a)) throw new Error('expected pilot');
    a.onboarding = '2026-10-14T';
    expect(adActionSortMs(a)).toBeNull();
    a.onboarding = '2026-10-14T13:48';
    expect(adActionSortMs(a)).toBe(Date.parse('2026-10-14T13:48:00'));
  });

  it('timeline sorts dated blocks chronologically and keeps incomplete at end', () => {
    const harbour = createAdAction('harbour_in');
    const tug = createAdAction('tug_mooring');
    const river = createAdAction('river_in');
    if (!isAdPilotAction(harbour) || !isAdTugAction(tug) || !isAdPilotAction(river)) {
      throw new Error('bad actions');
    }
    harbour.onboarding = '2026-10-14T14:00';
    tug.start = '2026-10-14T13:30';
    river.onboarding = ''; // incomplete → end

    const sorted = sortAdActionsForDisplay([harbour, tug, river], 'timeline');
    expect(sorted.map((a) => a.kind)).toEqual([
      'tug_mooring',
      'harbour_in',
      'river_in',
    ]);
  });

  it('document mode keeps palette order', () => {
    const tug = createAdAction('tug_mooring');
    const river = createAdAction('river_out');
    const sorted = sortAdActionsForDisplay([tug, river], 'document');
    expect(sorted.map((a) => a.kind)).toEqual(['river_out', 'tug_mooring']);
  });
});

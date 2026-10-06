import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from '../data/empty-app-data';
import { createEmptyCrewMember } from '../models/crew.models';
import { findMasterName } from './crew-list-form-excel.util';

describe('findMasterName', () => {
  it('uses the printed list captain, not a different master from the full roster', () => {
    const data = createEmptyAppData();
    data.crew = [
      { ...createEmptyCrewMember(), id: 'old', familyName: 'OLD', givenNames: 'Captain', rank: 'Master', onArrivalList: true },
      { ...createEmptyCrewMember(), id: 'new', familyName: 'NEW', givenNames: 'Captain', rank: 'Master', onDepartureList: true },
    ];
    const departureList = data.crew.filter((c) => c.onDepartureList);
    expect(findMasterName(data, departureList)).toBe('NEW CAPTAIN');
  });

  it('picks the topmost Master when the list has two', () => {
    const data = createEmptyAppData();
    const list = [
      { ...createEmptyCrewMember(), familyName: 'FIRST', givenNames: 'A', rank: 'Master' },
      { ...createEmptyCrewMember(), familyName: 'SECOND', givenNames: 'B', rank: 'Master' },
    ];
    expect(findMasterName(data, list)).toBe('FIRST A');
  });
});

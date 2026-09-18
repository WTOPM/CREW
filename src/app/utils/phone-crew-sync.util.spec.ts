import { describe, expect, it } from 'vitest';
import { createEmptyCrewMember } from '../models/crew.models';
import { createEmptyPhoneRow } from '../models/phone.models';
import { syncPhoneSurnamesFromCrew } from './phone-crew-sync.util';

describe('syncPhoneSurnamesFromCrew', () => {
  it('fills surname by cabin number and marks changed rows', () => {
    const crew = [
      {
        ...createEmptyCrewMember(),
        familyName: 'Zhykhariev',
        rank: 'Master',
        cabin: '813',
        onArrivalList: true,
      },
    ];
    const rows = [
      { ...createEmptyPhoneRow(6), subscribe: 'Master', call: '31', cabin: '813', name: '' },
    ];
    const out = syncPhoneSurnamesFromCrew(rows, crew);
    expect(out.rows[0]?.name).toBe('ZHYKHARIEV');
    expect(out.changedExcelRows).toEqual([6]);
  });

  it('cabin-only mode does not fill by rank and clears unmatched names', () => {
    const crew = [
      {
        ...createEmptyCrewMember(),
        familyName: 'Rosell',
        rank: 'COOK',
        cabin: '',
        onArrivalList: true,
      },
    ];
    const rows = [
      { ...createEmptyPhoneRow(20), subscribe: 'COOK', call: '61', cabin: '512', name: 'OLD' },
    ];
    const out = syncPhoneSurnamesFromCrew(rows, crew, { cabinOnly: true });
    expect(out.rows[0]?.name).toBe('');
    expect(out.changedExcelRows).toEqual([20]);
  });

  it('cabin-only fills matched cabins and clears the rest', () => {
    const crew = [
      {
        ...createEmptyCrewMember(),
        familyName: 'Zhykhariev',
        rank: 'Master',
        cabin: '813',
        onArrivalList: true,
      },
      {
        ...createEmptyCrewMember(),
        familyName: 'Rosell',
        rank: 'COOK',
        cabin: '',
        onArrivalList: true,
      },
    ];
    const rows = [
      { ...createEmptyPhoneRow(6), subscribe: 'Master', call: '31', cabin: '813', name: '' },
      { ...createEmptyPhoneRow(20), subscribe: 'COOK', call: '61', cabin: '512', name: 'KEEP?' },
    ];
    const out = syncPhoneSurnamesFromCrew(rows, crew, { cabinOnly: true });
    expect(out.rows[0]?.name).toBe('ZHYKHARIEV');
    expect(out.rows[1]?.name).toBe('');
    expect(out.changedExcelRows).toEqual([6, 20]);
  });

  it('matches OS subscribe with watch hours when cabin matches', () => {
    const crew = [
      {
        ...createEmptyCrewMember(),
        familyName: 'Mancha',
        rank: 'OS',
        cabin: '510',
        onArrivalList: true,
      },
    ];
    const rows = [
      {
        ...createEmptyPhoneRow(16),
        subscribe: 'OS 00:00-04:00',
        call: '62',
        cabin: '510',
        name: '',
      },
    ];
    const out = syncPhoneSurnamesFromCrew(rows, crew, { cabinOnly: true });
    expect(out.rows[0]?.name).toBe('MANCHA');
    expect(out.changedExcelRows).toEqual([16]);
  });

  it('rank fallback works when cabinOnly is false', () => {
    const crew = [
      {
        ...createEmptyCrewMember(),
        familyName: 'Pagaran',
        rank: 'OS',
        cabin: '',
        onArrivalList: true,
      },
    ];
    const rows = [
      {
        ...createEmptyPhoneRow(17),
        subscribe: 'OS 04:00-08:00',
        call: '63',
        cabin: '',
        name: '',
      },
    ];
    const out = syncPhoneSurnamesFromCrew(rows, crew, { cabinOnly: false });
    expect(out.rows[0]?.name).toBe('PAGARAN');
  });
});

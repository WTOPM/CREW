import { describe, expect, it } from 'vitest';
import {
  createEmptyPassenger,
  migratePassengerMember,
  normalizePassengerVoyageStays,
} from './passenger.models';

describe('passenger voyage stays', () => {
  it('normalizes an empty list when nothing is stored', () => {
    expect(normalizePassengerVoyageStays(undefined)).toEqual([]);
    expect(normalizePassengerVoyageStays([])).toEqual([]);
  });

  it('migrates legacy embarkation fields into the first stay', () => {
    const stays = normalizePassengerVoyageStays(undefined, {
      embarkationDate: '2026-04-01',
      embarkationPort: 'Genoa',
    });
    expect(stays).toHaveLength(1);
    expect(stays[0]?.embarkationDate).toBe('2026-04-01');
    expect(stays[0]?.embarkationPort).toBe('Genoa');
    expect(stays[0]?.disembarkationDate).toBe('');
    expect(stays[0]?.disembarkationPort).toBe('');
  });

  it('prefers voyageStays over legacy embarkation fields', () => {
    const member = migratePassengerMember({
      ...createEmptyPassenger(),
      embarkationDate: '2020-01-01',
      embarkationPort: 'Old',
      voyageStays: [
        {
          id: 'stay-1',
          embarkationDate: '2026-05-01',
          embarkationPort: 'Singapore',
          disembarkationDate: '2026-05-10',
          disembarkationPort: 'Rotterdam',
        },
      ],
    });
    expect(member.voyageStays).toHaveLength(1);
    expect(member.voyageStays[0]?.embarkationPort).toBe('Singapore');
    expect(member.voyageStays[0]?.disembarkationPort).toBe('Rotterdam');
  });
});

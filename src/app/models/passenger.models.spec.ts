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

  it('normalizes passport document flag', () => {
    const withScan = migratePassengerMember({
      ...createEmptyPassenger(),
      documents: { passport: true },
    });
    expect(withScan.documents?.passport).toBe(true);

    const without = migratePassengerMember(createEmptyPassenger());
    expect(without.documents?.passport).toBe(false);
  });
});

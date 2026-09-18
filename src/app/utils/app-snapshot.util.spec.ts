import { describe, expect, it } from 'vitest';
import {
  appSnapshotVoyageKey,
  appSnapshotVoyageKeyIsComplete,
  findAppSnapshotByVoyageKey,
} from './app-snapshot.util';

describe('app snapshot voyage key', () => {
  it('matches port + voyage + arrival date case-insensitively', () => {
    const entries = [
      { id: '1', portName: 'Alger', voyageNumber: '99', arrivalDate: '2026-05-30' },
      { id: '2', portName: 'Oran', voyageNumber: '99', arrivalDate: '2026-05-30' },
    ];
    const hit = findAppSnapshotByVoyageKey(entries, {
      portName: 'alger',
      voyageNumber: '99',
      arrivalDate: '2026-05-30',
    });
    expect(hit?.id).toBe('1');
  });

  it('does not match when any key part is missing', () => {
    expect(
      appSnapshotVoyageKeyIsComplete({
        portName: 'Alger',
        voyageNumber: '99',
        arrivalDate: '',
      }),
    ).toBe(false);
    expect(
      findAppSnapshotByVoyageKey(
        [{ id: '1', portName: 'Alger', voyageNumber: '99', arrivalDate: '2026-05-30' }],
        { portName: 'Alger', voyageNumber: '99', arrivalDate: '' },
      ),
    ).toBeUndefined();
  });

  it('builds a stable key', () => {
    expect(
      appSnapshotVoyageKey({
        portName: ' Alger ',
        voyageNumber: '99',
        arrivalDate: '2026-05-30',
      }),
    ).toBe(appSnapshotVoyageKey({ portName: 'alger', voyageNumber: '99', arrivalDate: '2026-05-30' }));
  });
});

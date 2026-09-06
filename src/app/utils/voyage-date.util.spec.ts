import { describe, expect, it } from 'vitest';
import {
  arrivalVoyageDate,
  voyageDateByArrivalFlag,
  voyageDateForMode,
} from './voyage-date.util';

describe('voyage-date.util', () => {
  const ship = {
    dateOfArrival: '2026-06-01',
    dateOfDeparture: '2026-06-02',
  };

  it('voyageDateForMode returns the chosen side only', () => {
    expect(voyageDateForMode(ship, 'arrival')).toBe('2026-06-01');
    expect(voyageDateForMode(ship, 'departure')).toBe('2026-06-02');
  });

  it('does not fall back across arrival/departure', () => {
    expect(
      voyageDateForMode({ dateOfArrival: '', dateOfDeparture: '2026-06-02' }, 'arrival'),
    ).toBe('');
    expect(
      voyageDateForMode({ dateOfArrival: '2026-06-01', dateOfDeparture: '' }, 'departure'),
    ).toBe('');
    expect(voyageDateByArrivalFlag({ dateOfArrival: '', dateOfDeparture: '2026-06-02' }, true)).toBe(
      '',
    );
    expect(
      voyageDateByArrivalFlag({ dateOfArrival: '2026-06-01', dateOfDeparture: '' }, false),
    ).toBe('');
  });

  it('voyageDateByArrivalFlag picks by flag', () => {
    expect(voyageDateByArrivalFlag(ship, true)).toBe('2026-06-01');
    expect(voyageDateByArrivalFlag(ship, false)).toBe('2026-06-02');
  });

  it('arrivalVoyageDate uses arrival only', () => {
    expect(arrivalVoyageDate(ship)).toBe('2026-06-01');
    expect(arrivalVoyageDate({ dateOfArrival: '', dateOfDeparture: '2026-06-02' })).toBe('');
  });

  it('handles null/undefined ship', () => {
    expect(voyageDateForMode(null, 'arrival')).toBe('');
    expect(voyageDateByArrivalFlag(undefined, false)).toBe('');
    expect(arrivalVoyageDate(null)).toBe('');
  });
});

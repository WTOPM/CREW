import { describe, expect, it } from 'vitest';
import {
  etaUtcOffsetHoursForPort,
  formatOffsetLabel,
  getDstSeason,
  offsetMinutesToEtaHours,
  resolveTimezoneForPort,
  searchTimezoneRows,
  type TimezoneRow,
} from './timezone-browser.util';

describe('timezone-browser.util', () => {
  it('formats whole-hour and half-hour offsets', () => {
    expect(formatOffsetLabel(120)).toBe('UTC+2');
    expect(formatOffsetLabel(-90)).toBe('UTC-1:30');
    expect(formatOffsetLabel(0)).toBe('UTC+0');
  });

  it('maps offset minutes to ETA half-hour hours', () => {
    expect(offsetMinutesToEtaHours(150)).toBe(2.5);
    expect(offsetMinutesToEtaHours(-45)).toBe(-0.5);
  });

  it('resolves Cyprus / Italy / Hamburg ports to primary IANA zones', () => {
    expect(resolveTimezoneForPort({ name: 'Larnaca', country: 'Cyprus' })).toBe('Asia/Nicosia');
    expect(resolveTimezoneForPort({ name: 'Napoli', country: 'ITALY' })).toBe('Europe/Rome');
    expect(resolveTimezoneForPort({ name: 'Hamburg', country: 'Germany' })).toBe('Europe/Berlin');
  });

  it('prefers explicit port.timeZone', () => {
    expect(
      resolveTimezoneForPort({
        name: 'Napoli',
        country: 'ITALY',
        timeZone: 'Europe/Paris',
      }),
    ).toBe('Europe/Paris');
  });

  it('returns eta hours for a known country port', () => {
    const hours = etaUtcOffsetHoursForPort(
      { name: 'Alger', country: 'Algeria' },
      '2026-05-30',
    );
    expect(hours).toBeTypeOf('number');
    expect(hours).not.toBeNull();
  });

  it('detects summer time in Europe/Berlin in July', () => {
    expect(getDstSeason('Europe/Berlin', new Date('2026-07-15T12:00:00Z'))).toBe('summer');
    expect(getDstSeason('Europe/Berlin', new Date('2026-01-15T12:00:00Z'))).toBe('winter');
  });

  it('finds Hamburg via port search even though zone id is Berlin', () => {
    const rows: TimezoneRow[] = [
      {
        id: 'Europe/Berlin',
        region: 'Europe',
        cityLabel: 'Berlin',
        portNames: ['Hamburg', 'Bremerhaven'],
        portsLabel: 'Hamburg, Bremerhaven',
        offsetMinutes: 120,
        offsetLabel: 'UTC+2',
        dstSeason: 'summer',
        dstSeasonLabel: 'Summer time',
        nextChangeLabel: '—',
      },
      {
        id: 'Asia/Tokyo',
        region: 'Asia',
        cityLabel: 'Tokyo',
        portNames: [],
        portsLabel: '—',
        offsetMinutes: 540,
        offsetLabel: 'UTC+9',
        dstSeason: 'none',
        dstSeasonLabel: 'No DST',
        nextChangeLabel: '—',
      },
    ];
    expect(searchTimezoneRows(rows, 'hamburg').map((r) => r.id)).toEqual(['Europe/Berlin']);
  });
});

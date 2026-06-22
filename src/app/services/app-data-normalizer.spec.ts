import {
  normalizeAppData,
  normalizeOutputSettings,
  normalizePortOfCallSettings,
  rescueOrphanCrew,
  rescueOrphanPassengers,
} from './app-data-normalizer';
import { APP_DATA_SCHEMA_VERSION } from '../data/empty-app-data';
import { createEmptyCrewMember } from '../models/crew.models';
import { createEmptyPassenger } from '../models/passenger.models';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';

describe('normalizeAppData', () => {
  it('produces a complete AppData from empty input', () => {
    const data = normalizeAppData({});
    expect(data.seedVersion).toBe(APP_DATA_SCHEMA_VERSION);
    expect(Array.isArray(data.crew)).toBe(true);
    expect(Array.isArray(data.passengers)).toBe(true);
    expect(Array.isArray(data.ports)).toBe(true);
    expect(Array.isArray(data.ranks)).toBe(true);
    expect(data.ship).toBeTruthy();
  });

  it('keeps saved ports exactly (dedupe only, no default injection)', () => {
    const data = normalizeAppData({
      ports: [
        { name: 'HAMBURG', code: 'DEHAM', country: 'GERMANY' },
        { name: 'hamburg', code: '', country: '' }, // duplicate (case-insensitive)
      ] as never,
    });
    const names = data.ports.map((p) => p.name.toLowerCase());
    expect(names.filter((n) => n === 'hamburg')).toHaveLength(1);
  });

  it('does not inject default ports when an empty ports array is saved', () => {
    const data = normalizeAppData({ ports: [] as never });
    expect(data.ports).toEqual([]);
  });

  it('archives orphan crew (not on any list, not archived)', () => {
    const orphan = {
      ...createEmptyCrewMember(),
      onArrivalList: false,
      onDepartureList: false,
      archived: false,
    };
    const data = normalizeAppData({ crew: [orphan] });
    expect(data.crew[0].archived).toBe(true);
  });

  it('derives ranks from crew when ranks are absent', () => {
    const member = { ...createEmptyCrewMember(), rank: 'MASTER', onArrivalList: true };
    const data = normalizeAppData({ crew: [member] });
    expect(data.ranks).toContain('MASTER');
  });

  it('keeps saved ranks list exactly when provided', () => {
    const data = normalizeAppData({ ranks: ['BOSUN'], crew: [] });
    expect(data.ranks).toEqual(['BOSUN']);
  });
});

describe('normalizeOutputSettings', () => {
  it('returns defaults for undefined input', () => {
    const out = normalizeOutputSettings(undefined);
    expect(out.saveToFolder).toBe(false);
    expect(out.savedPaths).toEqual([]);
  });

  it('coerces saveToFolder to a strict boolean', () => {
    expect(normalizeOutputSettings({ saveToFolder: 'yes' as never }).saveToFolder).toBe(false);
    expect(normalizeOutputSettings({ saveToFolder: true }).saveToFolder).toBe(true);
  });

  it('trims, dedupes and caps savedPaths to 5', () => {
    const out = normalizeOutputSettings({
      savedPaths: [' a ', 'a', 'b', 'c', 'd', 'e', 'f', '   '],
    });
    expect(out.savedPaths).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('normalizePortOfCallSettings', () => {
  it('clamps pdfRowCount within bounds', () => {
    expect(normalizePortOfCallSettings({ pdfRowCount: 9999 }).pdfRowCount).toBe(POC_MAX_ROW_COUNT);
    expect(normalizePortOfCallSettings({ pdfRowCount: -5 }).pdfRowCount).toBe(POC_MIN_ROW_COUNT);
  });

  it('keeps a valid value unchanged', () => {
    expect(normalizePortOfCallSettings({ pdfRowCount: 12 }).pdfRowCount).toBe(12);
  });
});

describe('rescueOrphanCrew / rescueOrphanPassengers', () => {
  it('archives only orphans, leaving listed/archived members untouched', () => {
    const onList = { ...createEmptyCrewMember(), onArrivalList: true };
    const archived = { ...createEmptyCrewMember(), archived: true };
    const orphan = {
      ...createEmptyCrewMember(),
      onArrivalList: false,
      onDepartureList: false,
      archived: false,
    };

    const [a, b, c] = rescueOrphanCrew([onList, archived, orphan]);
    expect(a.archived).toBe(false);
    expect(b.archived).toBe(true);
    expect(c.archived).toBe(true);
  });

  it('mirrors the same behaviour for passengers', () => {
    const orphan = {
      ...createEmptyPassenger(),
      onArrivalList: false,
      onDepartureList: false,
      archived: false,
    };
    expect(rescueOrphanPassengers([orphan])[0].archived).toBe(true);
  });
});

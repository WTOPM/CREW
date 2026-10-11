import { describe, expect, it } from 'vitest';
import { createDefaultEtaPlan, createEtaLeg } from '../models/eta.models';
import { createEmptyFuelLogEvent } from '../models/fuel.models';
import { wallClockToUtcMs } from './eta-calculator.util';
import {
  annotateEtaFuelVoyagePreviewRows,
  buildEtaFuelVoyagePoints,
  buildEtaFuelVoyagePreview,
  insertShipNoonPoints,
  shiftEtaFuelVoyagePreviewAfterPrevious,
  utcMsToShipDateTime,
} from './eta-to-fuel-voyage.util';

describe('utcMsToShipDateTime', () => {
  it('converts UTC instant to ship-local ISO date/time', () => {
    const utc = wallClockToUtcMs('2026-10-06', '12:00', 2)!; // 10:00 UTC
    expect(utcMsToShipDateTime(utc, 2)).toEqual({ date: '2026-10-06', time: '12:00' });
    expect(utcMsToShipDateTime(utc, 0)).toEqual({ date: '2026-10-06', time: '10:00' });
  });
});

describe('insertShipNoonPoints', () => {
  it('inserts Noon at 12:00 Ship LT between events spanning midday', () => {
    const ship = 2;
    const a = wallClockToUtcMs('2026-10-06', '08:00', ship)!;
    const b = wallClockToUtcMs('2026-10-07', '18:00', ship)!;
    const out = insertShipNoonPoints(
      [
        { utcMs: a, place: 'Pilot A', rawEvent: 'BOSP' },
        { utcMs: b, place: 'Pilot B', rawEvent: 'EOSP' },
      ],
      ship,
    );
    const noons = out.filter((p) => p.rawEvent === 'Noon');
    expect(noons).toHaveLength(2);
    expect(utcMsToShipDateTime(noons[0]!.utcMs, ship)).toEqual({
      date: '2026-10-06',
      time: '12:00',
    });
    expect(utcMsToShipDateTime(noons[1]!.utcMs, ship)).toEqual({
      date: '2026-10-07',
      time: '12:00',
    });
  });
});

describe('buildEtaFuelVoyagePoints', () => {
  it('builds SBE → Noon → EOSP → FWE style chain from ETA legs', () => {
    const plan = createDefaultEtaPlan('Test');
    plan.fromPort = 'Antwerp';
    plan.toPort = 'Hamburg';
    plan.departureDate = '2026-10-06';
    plan.departureTime = '06:00';
    plan.departureUtcOffsetHours = 2;
    plan.arrivalUtcOffsetHours = 2;
    plan.departureFuelRawEvent = 'SBE';
    plan.legs = [
      createEtaLeg({
        distanceNm: 20,
        speedKnots: 10,
        toLabel: 'Pilot drop',
        fuelRawEvent: 'BOSP',
      }),
      createEtaLeg({
        distanceNm: 240,
        speedKnots: 12,
        toLabel: 'Pilot pick',
        fuelRawEvent: 'EOSP',
      }),
      createEtaLeg({
        distanceNm: 10,
        speedKnots: 8,
        toLabel: '',
        fuelRawEvent: 'FWE',
      }),
    ];
    const { points, warnings } = buildEtaFuelVoyagePoints(plan, 2);
    expect(warnings.some((w) => /no fuel events/i.test(w))).toBe(false);
    const labels = points.map((p) => p.rawEvent);
    expect(labels[0]).toBe('SBE');
    expect(labels).toContain('BOSP');
    expect(labels).toContain('EOSP');
    expect(labels[labels.length - 1]).toBe('FWE');
    expect(labels).toContain('Noon');
  });
});

describe('buildEtaFuelVoyagePreview', () => {
  it('ignores same labels from earlier voyages (before previous/latest event)', () => {
    const plan = createDefaultEtaPlan('NewVoyage');
    plan.fromPort = 'BEANR';
    plan.toPort = 'FRMRS';
    plan.departureDate = '2026-10-12';
    plan.departureTime = '03:00';
    plan.departureUtcOffsetHours = 2;
    plan.arrivalUtcOffsetHours = 2;
    plan.departureFuelRawEvent = 'SBE';
    plan.legs = [
      createEtaLeg({
        distanceNm: 12,
        speedKnots: 12,
        toLabel: 'PILOT',
        fuelRawEvent: 'BOSP',
      }),
      createEtaLeg({
        distanceNm: 13,
        speedKnots: 12,
        toLabel: '',
        fuelRawEvent: 'EOSP',
      }),
    ];
    const existing = [
      createEmptyFuelLogEvent({
        date: '2026-10-07',
        time: '04:00',
        rawEvent: 'SBE',
        place: 'Old berth',
      }),
      createEmptyFuelLogEvent({
        date: '2026-10-07',
        time: '23:30',
        rawEvent: 'BOSP',
        place: 'Old pilot',
      }),
      createEmptyFuelLogEvent({
        date: '2026-10-10',
        time: '08:06',
        rawEvent: 'EOSP',
        place: 'Old arrival',
      }),
      createEmptyFuelLogEvent({
        date: '2026-10-10',
        time: '15:36',
        rawEvent: 'FWE/Shifting',
        place: 'Riga',
      }),
    ];
    const preview = buildEtaFuelVoyagePreview(plan, 2, existing);
    expect(preview.previousEvent?.rawEvent).toBe('FWE/Shifting');
    expect(preview.hasDuplicates).toBe(false);
    for (const label of ['SBE', 'BOSP', 'EOSP']) {
      const row = preview.rows.find((r) => r.rawEvent === label);
      expect(row?.rawEvent).toBe(label);
      expect(row!.included).toBe(true);
      expect(row!.duplicateOf).toBeNull();
    }
  });

  it('flags a label already added at/after the previous event', () => {
    const plan = createDefaultEtaPlan('Dup');
    plan.fromPort = 'A';
    plan.toPort = 'B';
    plan.departureDate = '2026-10-12';
    plan.departureTime = '03:00';
    plan.departureUtcOffsetHours = 2;
    plan.arrivalUtcOffsetHours = 2;
    plan.departureFuelRawEvent = 'SBE';
    plan.legs = [
      createEtaLeg({ distanceNm: 12, speedKnots: 12, toLabel: '', fuelRawEvent: 'BOSP' }),
    ];
    const existing = [
      createEmptyFuelLogEvent({
        date: '2026-10-10',
        time: '15:36',
        rawEvent: 'FWE/Shifting',
        place: 'Riga',
      }),
      createEmptyFuelLogEvent({
        date: '2026-10-12',
        time: '03:00',
        rawEvent: 'SBE',
        place: 'BEANR',
      }),
    ];
    const preview = buildEtaFuelVoyagePreview(plan, 2, existing);
    const sbe = preview.rows.find((r) => r.rawEvent === 'SBE');
    expect(sbe).toBeTruthy();
    expect(sbe!.included).toBe(false);
    expect(sbe!.duplicateOf?.rawEvent).toBe('SBE');
    expect(preview.hasDuplicates).toBe(true);
    const bosp = preview.rows.find((r) => r.rawEvent === 'BOSP');
    expect(bosp!.included).toBe(true);
    expect(bosp!.duplicateOf).toBeNull();
  });

  it('flags included rows that are before the previous Fuel event', () => {
    const plan = createDefaultEtaPlan('Before');
    plan.fromPort = 'A';
    plan.toPort = 'B';
    plan.departureDate = '2026-10-06';
    plan.departureTime = '06:00';
    plan.departureUtcOffsetHours = 2;
    plan.arrivalUtcOffsetHours = 2;
    plan.departureFuelRawEvent = 'BOSP';
    plan.legs = [
      createEtaLeg({ distanceNm: 10, speedKnots: 10, toLabel: '', fuelRawEvent: 'FWE' }),
    ];
    const existing = [
      createEmptyFuelLogEvent({
        date: '2026-10-10',
        time: '12:00',
        rawEvent: 'Noon',
        place: 'At sea',
      }),
    ];
    const preview = buildEtaFuelVoyagePreview(plan, 2, existing);
    expect(preview.previousEvent?.rawEvent).toBe('Noon');
    expect(preview.hasTimeConflict).toBe(true);
    expect(preview.rows.some((r) => r.included && r.beforePrevious)).toBe(true);

    const shifted = annotateEtaFuelVoyagePreviewRows(
      shiftEtaFuelVoyagePreviewAfterPrevious(preview.rows, preview.previousEvent, 1),
      preview.previousEvent,
    );
    expect(shifted.some((r) => r.included && r.beforePrevious)).toBe(false);
  });
});

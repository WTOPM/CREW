import { describe, expect, it } from 'vitest';
import {
  applyFuelEventAutoCalcs,
  applyFuelConsumptionSideEffects,
  cascadeAppAddedFuelRob,
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  discoverFuelRobTanks,
  filterFuelEvents,
  formatFuelHoursHm,
  formatFuelTimeDisplay,
  fuelEventReadyForWrite,
  splitFuelHoursHm,
  createDefaultFuelLibrary,
  createDefaultFuelViewPrefs,
  normalizeFuelLibrary,
  defaultFuelWriteStatus,
  inferDefaultRobTanks,
  inheritFuelFieldsFromPrevious,
  parseFuelTimeDisplay,
  recomputeFuelCounterFromHours,
  recomputeFuelHoursFromCounter,
  projectFuelRobAfterConsumption,
  recomputeFuelFmFromTotalM3,
  recomputeFuelTotalM3FromFm,
  recomputeFuelTotalMtFromM3,
  syncFuelBoilerDmaPeriod,
  normalizeFuelDensity,
  nudgeFuelDensity,
  fillMissingPeriodTotals,
  mergeMissingFuelPeriodFields,
  splitFuelTotalMtToMeAe,
  balanceFuelMeAeAgainstTotal,
  dateTimeFromFuelHrsEdit,
  shiftFuelDateTime,
  type FuelLogEvent,
} from '../models/fuel.models';

function ev(partial: Partial<FuelLogEvent> & Pick<FuelLogEvent, 'id' | 'kind' | 'date' | 'time'>): FuelLogEvent {
  return createEmptyFuelLogEvent(partial);
}

describe('classifyFuelEvent', () => {
  it('maps VPS-relevant excel labels', () => {
    expect(classifyFuelEvent('BOSP')).toBe('start_sea');
    expect(classifyFuelEvent('EOSP')).toBe('end_sea');
    expect(classifyFuelEvent('Noon / EOSP')).toBe('end_sea');
    expect(classifyFuelEvent('SBE')).toBe('departure');
    expect(classifyFuelEvent('FEW')).toBe('arrival');
    expect(classifyFuelEvent('FWE')).toBe('arrival');
    expect(classifyFuelEvent('Noon')).toBe('noon');
    expect(classifyFuelEvent('Port Report')).toBe('port_report');
    expect(classifyFuelEvent('Canal In')).toBe('canal');
    expect(classifyFuelEvent('FEW/Shifting')).toBe('shifting');
    expect(classifyFuelEvent('SBE/Shifting')).toBe('shifting');
    expect(classifyFuelEvent('Noon/SBE/Shifting')).toBe('shifting');
  });
});

describe('formatFuelHoursHm', () => {
  it('converts decimal hours to H:MM', () => {
    expect(formatFuelHoursHm(1.1)).toBe('1:06');
    expect(formatFuelHoursHm(0.5)).toBe('0:30');
    expect(formatFuelHoursHm(24)).toBe('24:00');
    expect(formatFuelHoursHm(null)).toBe('—');
  });

  it('splits H:MM for colored display', () => {
    expect(splitFuelHoursHm('1:06')).toEqual({ sign: '', hours: '1', minutes: '06' });
    expect(splitFuelHoursHm('-2:30')).toEqual({ sign: '-', hours: '2', minutes: '30' });
    expect(splitFuelHoursHm('—')).toBeNull();
  });
});

describe('discoverFuelRobTanks / inferDefaultRobTanks', () => {
  it('discovers tanks that appear in the log', () => {
    expect(discoverFuelRobTanks([])).toEqual(['rmd', 'b100', 'dma']);
    expect(
      discoverFuelRobTanks([
        ev({ id: '1', kind: 'noon', date: '2026-01-01', time: '12:00', robB100Mt: 10, robDmaMt: 5 }),
      ]),
    ).toEqual(['b100', 'dma']);
  });

  it('infers B100 when previous burned B100 vs beforePrevious', () => {
    const before = ev({
      id: '0',
      kind: 'noon',
      date: '2026-10-05',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 343,
      robDmaMt: 68.5,
    });
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.1,
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    expect(inferDefaultRobTanks(prev, before)).toEqual({ me: 'b100', ae: 'b100', boiler: 'dma' });
  });

  it('falls back to stocked B100 when no beforePrevious', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    expect(inferDefaultRobTanks(prev, null)).toEqual({ me: 'b100', ae: 'b100', boiler: 'dma' });
  });
});

describe('dateTimeFromFuelHrsEdit', () => {
  it('anchors clock to previous + new hrs (±0.1 h = 6 min)', () => {
    const prev = { date: '2026-10-06', time: '05:24' };
    expect(dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.7, prev)).toEqual({
      date: '2026-10-06',
      time: '12:06',
    });
    expect(dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.5, prev)).toEqual({
      date: '2026-10-06',
      time: '11:54',
    });
  });

  it('falls back to delta from old hrs when no previous', () => {
    expect(
      dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.7, null),
    ).toEqual({ date: '2026-10-06', time: '12:06' });
  });
});

describe('recomputeFuelTotalM3FromFm', () => {
  it('matches Excel G = Fₙ − Fₙ₋₁', () => {
    expect(recomputeFuelTotalM3FromFm(802.3, 799.5)).toBe(2.8);
    expect(recomputeFuelTotalM3FromFm(799.5, 799.5)).toBe(0);
    expect(recomputeFuelTotalM3FromFm(100, null)).toBeNull();
    expect(recomputeFuelTotalM3FromFm(null, 100)).toBeNull();
    expect(recomputeFuelTotalM3FromFm(90, 100)).toBeNull(); // negative delta rejected
  });

  it('reverse: FMₙ = previous FM + Total m³', () => {
    expect(recomputeFuelFmFromTotalM3(4529.2, 1.9)).toBe(4531.1);
    expect(recomputeFuelFmFromTotalM3(4529.2, 0.5)).toBe(4529.7);
    expect(recomputeFuelFmFromTotalM3(null, 1.9)).toBeNull();
    expect(recomputeFuelFmFromTotalM3(100, null)).toBeNull();
    expect(recomputeFuelFmFromTotalM3(100, -0.1)).toBeNull();
  });
});

describe('syncFuelBoilerDmaPeriod', () => {
  it('Boiler FM delta → DMA m³ and t 1:1 (no density)', () => {
    expect(
      syncFuelBoilerDmaPeriod({ boilerFm: 73.7, dmaConsM3: 0.1, boilerMt: 0.7 }, 73.0, 'boilerFm'),
    ).toEqual({ boilerFm: 73.7, dmaConsM3: 0.7, boilerMt: 0.7 });
  });

  it('DMA m³ edit updates FM and t', () => {
    expect(
      syncFuelBoilerDmaPeriod({ boilerFm: 73.0, dmaConsM3: 0.5, boilerMt: 0.1 }, 73.0, 'dmaConsM3'),
    ).toEqual({ boilerFm: 73.5, dmaConsM3: 0.5, boilerMt: 0.5 });
  });

  it('DMA/Boiler t edit updates FM and m³', () => {
    expect(
      syncFuelBoilerDmaPeriod({ boilerFm: 73.0, dmaConsM3: 0.1, boilerMt: 0.7 }, 73.0, 'boilerMt'),
    ).toEqual({ boilerFm: 73.7, dmaConsM3: 0.7, boilerMt: 0.7 });
  });
});

describe('recomputeFuelTotalMtFromM3', () => {
  it('matches Excel H = ROUND(m³ × density, 1)', () => {
    expect(recomputeFuelTotalMtFromM3(2.5, 0.88)).toBe(2.2);
    expect(recomputeFuelTotalMtFromM3(5, 0.9)).toBe(4.5);
    expect(normalizeFuelDensity(0.879)).toBe(0.879);
    expect(normalizeFuelDensity(0.4)).toBe(0.5); // clamped
  });

  it('nudges density by hundredths / tenths (not thousandths)', () => {
    expect(nudgeFuelDensity(0.88, 1)).toBe(0.89);
    expect(nudgeFuelDensity(0.88, -1)).toBe(0.87);
    expect(nudgeFuelDensity(0.88, 1, 0.1)).toBe(0.98);
    expect(nudgeFuelDensity(0.879, 1)).toBe(0.89);
  });
});

describe('fillMissingPeriodTotals / mergeMissingFuelPeriodFields', () => {
  it('rebuilds Total m³ / t from FM on Edit rows', () => {
    const a = ev({
      id: 'a',
      kind: 'start_sea',
      rawEvent: 'BOSP',
      date: '2026-09-01',
      time: '08:00',
      fmMeAe: 100,
      totalM3: null,
      totalMt: null,
    });
    const b = ev({
      id: 'b',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      fmMeAe: 105,
      totalM3: null,
      totalMt: null,
      density: 0.88,
    });
    const filled = fillMissingPeriodTotals([a, b]);
    expect(filled[1]!.totalM3).toBe(5);
    expect(filled[1]!.totalMt).toBe(4.4);
  });

  it('merges missing totals from View into Edit by date/time/place/event', () => {
    const edit = ev({
      id: 'edit-1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      place: 'Sea',
      totalM3: null,
      totalMt: null,
    });
    const view = ev({
      id: 'view-9',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      place: 'Sea',
      totalM3: 2.2,
      totalMt: 1.9,
      density: 0.88,
    });
    const merged = mergeMissingFuelPeriodFields([edit], [view]);
    expect(merged[0]!.totalM3).toBe(2.2);
    expect(merged[0]!.totalMt).toBe(1.9);
    expect(merged[0]!.id).toBe('edit-1');
  });
});

describe('applyFuelEventAutoCalcs', () => {
  it('fills elapsed hours; Total t = ROUND(m³ × density, 1)', () => {
    const prev = ev({
      id: '1',
      kind: 'departure',
      rawEvent: 'SBE',
      date: '2026-09-01',
      time: '06:00',
      fmMeAe: 100,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      fmMeAe: 102.5,
      density: 0.88,
      meMt: 1.2,
      aeMt: 0.3,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.timeUsedHours).toBe(6);
    expect(next.totalM3).toBe(2.5);
    expect(next.totalMt).toBe(2.2); // ROUND(2.5 × 0.88, 1)
    expect(next.density).toBe(0.88);
    expect(next.kind).toBe('noon');
  });

  it('fills Total m³ from FM delta (Excel Fₙ−Fₙ₋₁)', () => {
    const prev = ev({
      id: '1',
      kind: 'start_sea',
      rawEvent: 'BOSP',
      date: '2026-09-01',
      time: '08:00',
      fmMeAe: 799.5,
    });
    const draft = ev({
      id: '2',
      kind: 'end_sea',
      rawEvent: 'EOSP',
      date: '2026-09-01',
      time: '11:24',
      fmMeAe: 802.3,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.totalM3).toBe(2.8);
    expect(next.totalMt).toBe(2.5); // ROUND(2.8 × 0.88, 1)
  });

  it('advances FM from Add-modal AE/ME t when FM still equals previous', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-10-11',
      time: '12:00',
      fmMeAe: 4532.3,
      robB100Mt: 291.5,
    });
    // Inherited FM (= previous) + user typed AE 0.5 t in Add modal.
    const draft = ev({
      id: '2',
      kind: 'port_report',
      rawEvent: 'Port Report',
      date: '2026-10-11',
      time: '18:00',
      fmMeAe: 4532.3,
      density: 0.88,
      aeMt: 0.5,
      meMt: 0,
      aeRobTank: 'b100',
      meRobTank: 'b100',
      sourceRow: 0,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    // m³ = ROUND(0.5 / 0.88, 1) = 0.6 → FM = 4532.3 + 0.6
    expect(next.totalM3).toBe(0.6);
    expect(next.fmMeAe).toBe(4532.9);
    expect(next.totalMt).toBe(0.5);
    expect(next.aeMt).toBe(0.5);
    expect(next.robB100Mt).toBe(291.0);
  });

  it('prefers AE/ME t over a stale Total t/m³ when advancing FM', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-11',
      time: '12:00',
      fmMeAe: 4532.3,
      robB100Mt: 291.5,
    });
    // Stale G/H from an earlier tiny FM bump, but user typed AE 0.5.
    const draft = ev({
      id: '2',
      kind: 'port_report',
      date: '2026-10-11',
      time: '18:00',
      fmMeAe: 4532.4,
      totalM3: 0.1,
      totalMt: 0.1,
      density: 0.88,
      aeMt: 0.5,
      meMt: 0,
      aeRobTank: 'b100',
      meRobTank: 'b100',
      sourceRow: 0,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.totalM3).toBe(0.6);
    expect(next.fmMeAe).toBe(4532.9);
    expect(next.totalMt).toBe(0.5);
    expect(next.aeMt).toBe(0.5);
  });

  it('projects ROB RMD/DMA from previous minus period consumption', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      robRmdMt: 100.5,
      robDmaMt: 20.0,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-02',
      time: '12:00',
      meMt: 1.2,
      aeMt: 0.3,
      boilerMt: 0.4,
      meRobTank: 'rmd',
      aeRobTank: 'rmd',
      boilerRobTank: 'dma',
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.robRmdMt).toBe(99.0);
    expect(next.robDmaMt).toBe(19.6);
    expect(next.timeUsedHours).toBe(24);
  });

  it('burns ME+AE from B100 when RMD stock is empty (bio ops)', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.4,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.meRobTank).toBe('b100');
    expect(next.aeRobTank).toBe('b100');
    expect(next.boilerRobTank).toBe('dma');
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(341.1);
    expect(next.robDmaMt).toBe(68.0);
  });

  it('keeps Add-modal tank picks even when stock would infer another tank', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 1,
      aeMt: 0,
      boilerMt: 0.2,
      meRobTank: 'rmd', // explicit — even though RMD is empty / B100 has stock
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
      sourceRow: 0,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.meRobTank).toBe('rmd');
    expect(next.robRmdMt).toBe(0); // clamped
    expect(next.robB100Mt).toBe(342.1); // not debited
    expect(next.robDmaMt).toBe(68.2);
  });

  it('cascades ROB only for app-added rows; Excel rows stay put', () => {
    const excel = ev({
      id: 'xlsx',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 100,
      robB100Mt: 200,
      robDmaMt: 50,
      sourceRow: 40,
    });
    const a = ev({
      id: 'new-a',
      kind: 'noon',
      date: '2026-10-06',
      time: '15:00',
      meMt: 1,
      aeMt: 0.5,
      boilerMt: 0.2,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
      sourceRow: 0,
    });
    const b = ev({
      id: 'new-b',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 0.5,
      aeMt: 0,
      boilerMt: 0,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
      sourceRow: 0,
    });
    const out = cascadeAppAddedFuelRob([excel, a, b]);
    expect(out[0].robB100Mt).toBe(200); // Excel untouched
    expect(out[1].robB100Mt).toBe(198.5); // 200 − 1 − 0.5
    expect(out[1].robDmaMt).toBe(49.8);
    expect(out[2].robB100Mt).toBe(198.0); // 198.5 − 0.5
  });

  it('never goes negative when previous ROB is 0', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 10,
      robDmaMt: 5,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 1,
      aeMt: 0,
      boilerMt: 0,
      meRobTank: 'rmd',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(10);
  });

  it('supports split ME→B100 and AE→RMD debit', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-09-01',
      time: '12:00',
      robRmdMt: 50,
      robB100Mt: 100,
      robDmaMt: 20,
    });
    const projected = projectFuelRobAfterConsumption(
      prev,
      { me: 'b100', ae: 'rmd', boiler: 'dma' },
      { meMt: 1.5, aeMt: 0.5, boilerMt: 0.2 },
    );
    expect(projected.robB100Mt).toBe(98.5);
    expect(projected.robRmdMt).toBe(49.5);
    expect(projected.robDmaMt).toBe(19.8);
  });
});

describe('applyFuelConsumptionSideEffects', () => {
  it('rebuilds ROB from previous when ME/AE/Boiler change; Total t stays density-based', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    const current = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 0.2,
      aeMt: 0.1,
      boilerMt: 0.1,
      totalMt: 2.2,
      density: 0.88,
      robRmdMt: 999,
      robB100Mt: 999,
      robDmaMt: 999,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelConsumptionSideEffects(current, prev, null, {
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.4,
    });
    // Total t is Excel H = m³×density — not ME+AE.
    expect(next.totalMt).toBe(2.2);
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(341.1);
    expect(next.robDmaMt).toBe(68.0);
  });

  it('clamps ME to Total t and puts the remainder on AE', () => {
    const current = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      totalMt: 0.6,
      meMt: 0.4,
      aeMt: 0.2,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelConsumptionSideEffects(current, null, null, { meMt: 0.5 });
    expect(next.meMt).toBe(0.5);
    expect(next.aeMt).toBe(0.1);
    expect(next.totalMt).toBe(0.6);

    const allMe = applyFuelConsumptionSideEffects(current, null, null, { meMt: 0.6 });
    expect(allMe.meMt).toBe(0.6);
    expect(allMe.aeMt).toBe(0);

    const over = applyFuelConsumptionSideEffects(current, null, null, { meMt: 0.9 });
    expect(over.meMt).toBe(0.6);
    expect(over.aeMt).toBe(0);

    const zeroMe = applyFuelConsumptionSideEffects(current, null, null, { meMt: 0 });
    expect(zeroMe.meMt).toBe(0);
    expect(zeroMe.aeMt).toBe(0.6);
  });

  it('clamps AE to Total t and puts the remainder on ME', () => {
    const current = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      totalMt: 0.6,
      meMt: 0.4,
      aeMt: 0.2,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelConsumptionSideEffects(current, null, null, { aeMt: 0.5 });
    expect(next.aeMt).toBe(0.5);
    expect(next.meMt).toBe(0.1);

    const allAe = applyFuelConsumptionSideEffects(current, null, null, { aeMt: 0.6 });
    expect(allAe.aeMt).toBe(0.6);
    expect(allAe.meMt).toBe(0);

    const over = applyFuelConsumptionSideEffects(current, null, null, { aeMt: 0.9 });
    expect(over.aeMt).toBe(0.6);
    expect(over.meMt).toBe(0);
  });
});

describe('splitFuelTotalMtToMeAe', () => {
  it('splits Total t ~2:1 ME:AE', () => {
    expect(splitFuelTotalMtToMeAe(0.3)).toEqual({ meMt: 0.2, aeMt: 0.1 });
    expect(splitFuelTotalMtToMeAe(0.6)).toEqual({ meMt: 0.4, aeMt: 0.2 });
    expect(balanceFuelMeAeAgainstTotal(0.6, 0, 0.5, 'ae')).toEqual({ meMt: 0.1, aeMt: 0.5 });
    expect(balanceFuelMeAeAgainstTotal(0.9, null, null, 'total')).toEqual({ meMt: 0.6, aeMt: 0.3 });
  });
});

describe('filterFuelEvents roll-up', () => {
  const sample: FuelLogEvent[] = [
    ev({
      id: '1',
      place: 'Hamburg',
      rawEvent: 'FEW',
      kind: 'arrival',
      date: '2026-09-01',
      time: '06:00',
      timeUsedHours: 2,
      meMt: 0.2,
      aeMt: 0.1,
      totalMt: 0.3,
    }),
    ev({
      id: '2',
      place: 'Hamburg',
      rawEvent: 'Noon',
      kind: 'noon',
      date: '2026-09-01',
      time: '12:00',
      timeUsedHours: 12,
      meMt: 1,
      aeMt: 0.5,
      totalMt: 1.5,
    }),
    ev({
      id: '3',
      place: 'Hamburg',
      rawEvent: 'SBE',
      kind: 'departure',
      date: '2026-09-01',
      time: '18:00',
      timeUsedHours: 6,
      meMt: 0.4,
      aeMt: 0.2,
      totalMt: 0.6,
    }),
  ];

  it('rolls hidden noon into next visible departure', () => {
    const view = {
      ...createDefaultFuelViewPrefs(),
      visibleKinds: ['arrival', 'departure'] as const,
      newestFirst: false,
      limitCount: 0,
    };
    const rows = filterFuelEvents(sample, { ...view, visibleKinds: [...view.visibleKinds] });
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('arrival');
    expect(rows[1].kind).toBe('departure');
    expect(rows[1].timeUsedHours).toBe(18);
    expect(rows[1].totalMt).toBe(2.1);
    expect(rows[1].rolledFromCount).toBe(2);
  });

  it('keeps machinery power when present', () => {
    const withPower: FuelLogEvent[] = [
      ev({
        id: '1',
        kind: 'start_sea',
        rawEvent: 'BOSP',
        date: '2026-09-01',
        time: '08:00',
        meKw: 4000,
      }),
    ];
    const rows = filterFuelEvents(withPower, {
      ...createDefaultFuelViewPrefs(),
      limitCount: 0,
    });
    expect(rows[0].meKw).toBe(4000);
  });
});

describe('shiftFuelDateTime', () => {
  it('subtracts hours for UTC display (local UTC+2 → UTC)', () => {
    expect(shiftFuelDateTime('2026-01-02', '01:30', -2)).toEqual({
      date: '2026-01-01',
      time: '23:30',
    });
    expect(shiftFuelDateTime('2026-01-01', '12:00', -2)).toEqual({
      date: '2026-01-01',
      time: '10:00',
    });
  });
});

describe('formatFuelTimeDisplay / parseFuelTimeDisplay', () => {
  it('appends UTC only when UTC mode is on', () => {
    expect(formatFuelTimeDisplay('12:00', false)).toBe('12:00');
    expect(formatFuelTimeDisplay('12:00', true)).toBe('12:00 UTC');
    expect(formatFuelTimeDisplay('', true)).toBe('');
  });

  it('parses HH:MM with optional UTC suffix', () => {
    expect(parseFuelTimeDisplay('9:05')).toBe('09:05');
    expect(parseFuelTimeDisplay('12:00 UTC')).toBe('12:00');
    expect(parseFuelTimeDisplay('12:00 utc')).toBe('12:00');
    expect(parseFuelTimeDisplay('25:00')).toBeNull();
    expect(parseFuelTimeDisplay('noon')).toBeNull();
  });
});

describe('inheritFuelFieldsFromPrevious', () => {
  it('copies counters, place and ROB tanks; skips empty', () => {
    const prev = ev({
      id: 'p',
      kind: 'noon',
      date: '2026-01-01',
      time: '12:00',
      place: 'Sea',
      fmMeAe: 1234.5,
      meCounterRh: 9001,
      meRobTank: 'rmd',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
      meMt: 12.3,
    });
    const { patch, inheritedFields } = inheritFuelFieldsFromPrevious(prev);
    expect(patch.place).toBe('Sea');
    expect(patch.fmMeAe).toBe(1234.5);
    expect(patch.meCounterRh).toBe(9001);
    expect(patch.meRobTank).toBe('rmd');
    expect(patch.meMt).toBeUndefined();
    expect(inheritedFields).toContain('fmMeAe');
    expect(inheritedFields).toContain('place');
    expect(inheritedFields).not.toContain('meMt');
  });
});

describe('recomputeFuelHoursFromCounter', () => {
  it('returns period delta; rejects missing/negative', () => {
    expect(recomputeFuelHoursFromCounter(9012.5, 9001)).toBe(11.5);
    expect(recomputeFuelHoursFromCounter(9001, 9001)).toBe(0);
    expect(recomputeFuelHoursFromCounter(100, null)).toBeNull();
    expect(recomputeFuelHoursFromCounter(null, 100)).toBeNull();
    expect(recomputeFuelHoursFromCounter(90, 100)).toBeNull();
  });
});

describe('recomputeFuelCounterFromHours', () => {
  it('adds period hours onto previous counter', () => {
    expect(recomputeFuelCounterFromHours(87013.1, 1.5)).toBe(87014.6);
    expect(recomputeFuelCounterFromHours(9001, 0)).toBe(9001);
    expect(recomputeFuelCounterFromHours(null, 1.5)).toBeNull();
    expect(recomputeFuelCounterFromHours(9001, null)).toBeNull();
    expect(recomputeFuelCounterFromHours(9001, -0.1)).toBeNull();
  });
});

describe('normalizeFuelLibrary edit draft', () => {
  it('seeds editEvents from events when edit fields are missing (old saves)', () => {
    const lib = normalizeFuelLibrary({
      events: [ev({ id: 'a', kind: 'noon', date: '2026-01-01', time: '12:00', place: 'Sea' })],
    });
    expect(lib.events).toHaveLength(1);
    expect(lib.editEvents).toHaveLength(1);
    expect(lib.editEvents[0].place).toBe('Sea');
    expect(lib.editBaseline).toHaveLength(1);
    expect(lib.editDirty).toBe(false);
  });

  it('keeps an independent dirty edit draft', () => {
    const lib = normalizeFuelLibrary({
      ...createDefaultFuelLibrary(),
      events: [ev({ id: 'v', kind: 'noon', date: '2026-01-01', time: '12:00', place: 'ViewPort' })],
      editEvents: [ev({ id: 'e', kind: 'noon', date: '2026-01-02', time: '12:00', place: 'EditPort' })],
      editBaseline: [ev({ id: 'b', kind: 'noon', date: '2026-01-01', time: '12:00', place: 'Base' })],
      editDirty: true,
    });
    expect(lib.events[0].place).toBe('ViewPort');
    expect(lib.editEvents[0].place).toBe('EditPort');
    expect(lib.editBaseline[0].place).toBe('Base');
    expect(lib.editDirty).toBe(true);
  });
});

describe('writeStatus', () => {
  it('defaults from sourceRow when missing', () => {
    expect(defaultFuelWriteStatus(0)).toBe('draft');
    expect(defaultFuelWriteStatus(5)).toBe('synced');
    expect(createEmptyFuelLogEvent({ sourceRow: 0 }).writeStatus).toBe('draft');
    expect(createEmptyFuelLogEvent({ sourceRow: 8 }).writeStatus).toBe('synced');
  });

  it('preserves explicit writeStatus on normalize', () => {
    const lib = normalizeFuelLibrary({
      editEvents: [
        ev({
          id: 'd',
          kind: 'noon',
          date: '2026-01-01',
          time: '12:00',
          place: 'Sea',
          rawEvent: 'Noon',
          writeStatus: 'ready',
        }),
      ],
      editDirty: true,
    });
    expect(lib.editEvents[0]!.writeStatus).toBe('ready');
  });

  it('fuelEventReadyForWrite requires date/time/place/event', () => {
    expect(
      fuelEventReadyForWrite({
        date: '2026-01-01',
        time: '12:00',
        place: 'Sea',
        rawEvent: 'Noon',
      }),
    ).toBe(true);
    expect(
      fuelEventReadyForWrite({ date: '', time: '12:00', place: 'Sea', rawEvent: 'Noon' }),
    ).toBe(false);
  });
});

import {
  applyFuelEventAutoCalcs,
  cascadeAppAddedFuelRob,
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  findFuelEventBeforePrevious,
  findPreviousFuelEvent,
  fuelElapsedHours,
  fuelEventChronoKey,
  inheritFuelFieldsFromPrevious,
  recomputeFuelFmFromTotalM3,
  resolveFuelDensity,
  splitFuelTotalMtToMeAe,
  type FuelLogEvent,
} from '../models/fuel.models';
import { defaultFoRateMtPerHour } from './fuel-distance-forecast.util';
import {
  FUEL_VOYAGE_SEA_PLACE,
  type EtaFuelVoyagePreviewRow,
} from './eta-to-fuel-voyage.util';

export type EtaVoyageAddOptions = {
  /** Pre-fill FO burn / FM / ROB from hours × mt/h (FO-VPC bands). */
  predictFo: boolean;
  /** Link added rows so editing an earlier one shifts later ones. */
  linkVoyage: boolean;
};

/** Payload from Add-voyage modal confirm (rows + Predict FO / Link voyage). */
export type EtaVoyageConfirmPayload = {
  rows: EtaFuelVoyagePreviewRow[];
  options: EtaVoyageAddOptions;
};

/** Sea → 1.2 mt/h; in-port / shifting → canal band (~0.3). */
export function foRateMtPerHourForVoyageSegment(
  previous: Pick<FuelLogEvent, 'place' | 'rawEvent' | 'kind'> | null | undefined,
  current: Pick<FuelLogEvent, 'place' | 'rawEvent' | 'kind'>,
): number {
  const places = [previous?.place, current.place].map((p) => (p ?? '').trim().toLowerCase());
  const atSea = places.some((p) => !p || p === FUEL_VOYAGE_SEA_PLACE.toLowerCase() || p === 'at sea');
  const kinds = [previous?.kind ?? classifyFuelEvent(previous?.rawEvent ?? ''), current.kind];
  const seaKinds = kinds.some((k) => k === 'start_sea' || k === 'end_sea' || k === 'noon');
  // Port approaches / shifting: slow band.
  if (
    kinds.some((k) => k === 'arrival' || k === 'departure' || k === 'shifting') &&
    !seaKinds
  ) {
    return defaultFoRateMtPerHour(5);
  }
  if (atSea || seaKinds) return defaultFoRateMtPerHour(12);
  return defaultFoRateMtPerHour(12);
}

/** Advance machinery counters by elapsed hours when previous values exist. */
function advanceCountersByHours(
  previous: FuelLogEvent,
  hours: number,
): Partial<FuelLogEvent> {
  const patch: Partial<FuelLogEvent> = {};
  const add = (field: keyof FuelLogEvent, hoursField: keyof FuelLogEvent) => {
    const prev = previous[field];
    if (typeof prev === 'number' && Number.isFinite(prev)) {
      (patch as Record<string, unknown>)[field] = Math.round((prev + hours) * 100) / 100;
      (patch as Record<string, unknown>)[hoursField] = hours;
    }
  };
  add('meCounterRh', 'meHours');
  add('ae1CounterRh', 'ae1Hours');
  add('ae2CounterRh', 'ae2Hours');
  add('ae3CounterRh', 'ae3Hours');
  add('boilerCounterRh', 'boilerHours');
  return patch;
}

/**
 * Predict FO period fields for `draft` from elapsed time since `previous`
 * (same principle as FO distance forecast: hours × mt/h).
 */
export function predictFuelVoyageEventFromPrevious(
  draft: FuelLogEvent,
  previous: FuelLogEvent | null | undefined,
  preferredDensity: number | null,
): FuelLogEvent {
  if (!previous) {
    const { patch } = inheritFuelFieldsFromPrevious(null);
    return createEmptyFuelLogEvent(
      applyFuelEventAutoCalcs({ ...draft, ...patch }, null, null, preferredDensity),
    );
  }

  const { patch: inherited, inheritedFields } = inheritFuelFieldsFromPrevious(previous);
  const fill: Partial<FuelLogEvent> = {};
  for (const field of inheritedFields) {
    if (field === 'meRobTank' || field === 'aeRobTank' || field === 'boilerRobTank') continue;
    const cur = draft[field];
    const empty = cur == null || (typeof cur === 'string' && !String(cur).trim());
    if (!empty) continue;
    (fill as Record<string, unknown>)[field] = inherited[field];
  }

  const hours = fuelElapsedHours(previous.date, previous.time, draft.date, draft.time);
  let predicted: Partial<FuelLogEvent> = { ...fill };
  if (hours != null && hours > 0) {
    const rate = foRateMtPerHourForVoyageSegment(previous, draft);
    const totalMt = Math.round(hours * rate * 10) / 10;
    const density = resolveFuelDensity(draft, null, preferredDensity);
    const split = splitFuelTotalMtToMeAe(totalMt);
    const totalM3 =
      density != null && density > 0 ? Math.round((totalMt / density) * 1000) / 1000 : null;
    const fmMeAe =
      previous.fmMeAe != null && totalM3 != null
        ? recomputeFuelFmFromTotalM3(previous.fmMeAe, totalM3)
        : previous.fmMeAe;
    predicted = {
      ...predicted,
      timeUsedHours: hours,
      density,
      totalMt,
      meMt: split.meMt,
      aeMt: split.aeMt,
      totalM3,
      fmMeAe: fmMeAe ?? predicted.fmMeAe ?? null,
      ...advanceCountersByHours(previous, hours),
    };
  }

  const before = null;
  return createEmptyFuelLogEvent(
    applyFuelEventAutoCalcs({ ...draft, ...predicted }, previous, before, preferredDensity),
  );
}

/** Stamp voyage-chain fields on a batch of newly added events. */
export function stampVoyageChain(
  events: readonly FuelLogEvent[],
  chainId: string,
  predictFo: boolean,
): FuelLogEvent[] {
  const sorted = [...events].sort((a, b) =>
    fuelEventChronoKey(a).localeCompare(fuelEventChronoKey(b)),
  );
  return sorted.map((e, i) =>
    createEmptyFuelLogEvent({
      ...e,
      voyageChainId: chainId,
      voyageChainIndex: i,
      voyageChainPredict: predictFo,
    }),
  );
}

export function clearVoyageChainOnEvent(e: FuelLogEvent): FuelLogEvent {
  if (!e.voyageChainId && e.voyageChainIndex == null && !e.voyageChainPredict) return e;
  return createEmptyFuelLogEvent({
    ...e,
    voyageChainId: null,
    voyageChainIndex: null,
    voyageChainPredict: false,
  });
}

function parseFuelLocalMs(date: string, time: string): number | null {
  if (!date) return null;
  const ms = Date.parse(`${date}T${(time || '00:00').padStart(5, '0')}:00`);
  return Number.isFinite(ms) ? ms : null;
}

function formatFuelLocalMs(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

/**
 * After editing date/time on a chained event, shift all later chain members
 * by the same delta and optionally re-predict FO.
 */
export function applyVoyageChainTimeShift(
  events: readonly FuelLogEvent[],
  editedId: string,
  oldDate: string,
  oldTime: string,
  preferredDensity: number | null,
): FuelLogEvent[] {
  const edited = events.find((e) => e.id === editedId);
  if (!edited?.voyageChainId) return [...events];
  const oldMs = parseFuelLocalMs(oldDate, oldTime);
  const newMs = parseFuelLocalMs(edited.date, edited.time);
  if (oldMs == null || newMs == null) return [...events];
  const delta = newMs - oldMs;
  if (delta === 0) return [...events];

  const chainId = edited.voyageChainId;
  const editedIndex = edited.voyageChainIndex ?? 0;
  let next = events.map((e) => {
    if (e.id === editedId) return e;
    if (e.voyageChainId !== chainId) return e;
    if ((e.voyageChainIndex ?? 0) <= editedIndex) return e;
    const ms = parseFuelLocalMs(e.date, e.time);
    if (ms == null) return e;
    const shifted = formatFuelLocalMs(ms + delta);
    return createEmptyFuelLogEvent({ ...e, ...shifted });
  });

  // Recompute hours / FO for the edited row and every later chain member that was predicted.
  next = repredictVoyageChainFrom(next, chainId, editedIndex, preferredDensity);
  return cascadeAppAddedFuelRob(next);
}

/**
 * After FO/consumption edit on a chained event, re-predict later predicted members.
 */
export function applyVoyageChainFuelCascade(
  events: readonly FuelLogEvent[],
  editedId: string,
  preferredDensity: number | null,
): FuelLogEvent[] {
  const edited = events.find((e) => e.id === editedId);
  if (!edited?.voyageChainId) return [...events];
  const next = repredictVoyageChainFrom(
    events,
    edited.voyageChainId,
    (edited.voyageChainIndex ?? 0) + 1,
    preferredDensity,
  );
  return cascadeAppAddedFuelRob(next);
}

function repredictVoyageChainFrom(
  events: readonly FuelLogEvent[],
  chainId: string,
  fromIndexInclusive: number,
  preferredDensity: number | null,
): FuelLogEvent[] {
  const sorted = [...events].sort((a, b) =>
    fuelEventChronoKey(a).localeCompare(fuelEventChronoKey(b)),
  );
  const byId = new Map(sorted.map((e) => [e.id, e]));
  for (const e of sorted) {
    if (e.voyageChainId !== chainId) continue;
    if ((e.voyageChainIndex ?? 0) < fromIndexInclusive) continue;
    if (!e.voyageChainPredict && (e.voyageChainIndex ?? 0) > fromIndexInclusive) {
      // Non-predict chain: still refresh Hrs from previous.
      const prev = findPreviousFuelEvent(sorted.map((x) => byId.get(x.id)!), e.date, e.time, e.id);
      if (prev) {
        const hrs = fuelElapsedHours(prev.date, prev.time, e.date, e.time);
        byId.set(e.id, createEmptyFuelLogEvent({ ...e, timeUsedHours: hrs }));
      }
      continue;
    }
    const live = sorted.map((x) => byId.get(x.id)!);
    const prev = findPreviousFuelEvent(live, e.date, e.time, e.id);
    const before = findFuelEventBeforePrevious(live, prev);
    if (e.voyageChainPredict) {
      const predicted = predictFuelVoyageEventFromPrevious(
        { ...e, meMt: null, aeMt: null, totalMt: null, totalM3: null, fmMeAe: null },
        prev,
        preferredDensity,
      );
      byId.set(
        e.id,
        createEmptyFuelLogEvent({
          ...predicted,
          voyageChainId: e.voyageChainId,
          voyageChainIndex: e.voyageChainIndex,
          voyageChainPredict: true,
        }),
      );
    } else {
      byId.set(
        e.id,
        createEmptyFuelLogEvent(
          applyFuelEventAutoCalcs(e, prev, before, preferredDensity),
        ),
      );
    }
  }
  return events.map((e) => byId.get(e.id) ?? e);
}

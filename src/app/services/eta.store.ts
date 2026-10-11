import { Injectable, inject } from '@angular/core';
import {
  applyEtaGpsByWaypointName,
  cloneEtaPlan,
  createDefaultEtaPlan,
  createEtaLeg,
  createEtaWaypointGpsEntry,
  etaWaypointGpsKey,
  findEtaWaypointByName,
  hydrateEtaPlanWaypointGps,
  normalizeEtaLibrary,
  pickEtaGpsForRenamedWaypoint,
  removeEtaWaypoint,
  reorderEtaWaypoints,
  resolveEtaWaypointGps,
  upsertEtaWaypoint,
  type EtaGpsCoords,
  type EtaLeg,
  type EtaLibrarySettings,
  type EtaPlan,
  type EtaScenario,
  type EtaWaypointGpsEntry,
} from '../models/eta.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class EtaStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  private touchDraft(draft: EtaPlan): EtaPlan {
    return { ...draft, updatedAt: new Date().toISOString() };
  }

  /**
   * Update etaLibrary in memory immediately. Disk write only on 'saved' (SAVE)
   * or an explicit flushPersist (tab leave / close / minimize).
   */
  private updateLibrary(
    mutator: (lib: EtaLibrarySettings) => EtaLibrarySettings,
    notify: 'silent' | 'saved' | 'memory' = 'memory',
  ): void {
    this.data.update((d) => ({
      ...d,
      etaLibrary: mutator(d.etaLibrary),
    }));
    if (notify === 'saved') {
      void this.state.persist('saved');
      return;
    }
    void this.state.persist('memory');
  }

  /** Flush pending ETA (+ rest of AppData) to disk. */
  flushPersist(notify: 'silent' | 'saved' = 'silent'): void {
    void this.state.flushPersist(notify);
  }

  updateDraft(partial: Partial<EtaPlan>, notify: 'silent' | 'saved' = 'silent'): void {
    this.updateLibrary(
      (lib) => ({
        ...lib,
        draft: this.touchDraft({ ...lib.draft, ...partial }),
      }),
      notify,
    );
  }

  setDraftField<K extends keyof EtaPlan>(field: K, value: EtaPlan[K]): void {
    this.updateDraft({ [field]: value } as Partial<EtaPlan>);
  }

  setScenario(scenario: EtaScenario): void {
    this.updateDraft({ scenario });
  }

  addLeg(): void {
    this.updateLibrary((lib) => {
      const prev = lib.draft.legs;
      // Previous last was arrival (FWE) — become intermediate (EOSP); new last = FWE.
      const adjusted = prev.map((leg, i) => {
        if (i !== prev.length - 1) return leg;
        if (!leg.fuelRawEvent.trim() || leg.fuelRawEvent.trim() === 'FWE') {
          return { ...leg, fuelRawEvent: 'EOSP' };
        }
        return leg;
      });
      return {
        ...lib,
        draft: this.touchDraft({
          ...lib.draft,
          legs: [...adjusted, createEtaLeg({ fuelRawEvent: 'FWE' })],
        }),
      };
    });
  }

  setShipUtcOffsetHours(hours: number): void {
    this.updateLibrary((lib) => ({
      ...lib,
      shipUtcOffsetHours: hours,
    }));
  }

  removeLeg(legId: string): void {
    this.updateLibrary((lib) => {
      const legs = lib.draft.legs.filter((l) => l.id !== legId);
      return {
        ...lib,
        draft: this.touchDraft({
          ...lib.draft,
          legs: legs.length ? legs : [createEtaLeg()],
        }),
      };
    });
  }

  updateLeg(
    legId: string,
    partial: Partial<
      Pick<
        EtaLeg,
        'distanceNm' | 'speedKnots' | 'toLabel' | 'etaUtcOffsetHours' | 'toGps' | 'fuelRawEvent'
      >
    >,
  ): void {
    this.updateLibrary((lib) => ({
      ...lib,
      draft: this.touchDraft({
        ...lib.draft,
        legs: lib.draft.legs.map((leg) => (leg.id === legId ? { ...leg, ...partial } : leg)),
      }),
    }));
  }

  /** Rename intermediate waypoint; auto-fill GPS when the name already exists elsewhere. */
  setLegToLabel(legId: string, value: string): void {
    this.updateLibrary((lib) => {
      const known = resolveEtaWaypointGps(lib, value);
      let waypoints = lib.waypoints ?? [];
      if (known && !findEtaWaypointByName(waypoints, value)) {
        waypoints = upsertEtaWaypoint(waypoints, value, known);
      }
      return {
        ...lib,
        waypoints,
        draft: this.touchDraft({
          ...lib.draft,
          legs: lib.draft.legs.map((leg) => {
            if (leg.id !== legId) return leg;
            return {
              ...leg,
              toLabel: value,
              toGps: pickEtaGpsForRenamedWaypoint(leg.toLabel, value, leg.toGps, known),
            };
          }),
        }),
      };
    });
  }

  /** Set departure port; auto-fill fromGps when name is known. */
  setFromPort(value: string, extra?: Partial<Pick<EtaPlan, 'departureUtcOffsetHours'>>): void {
    this.updateLibrary((lib) => {
      const known = resolveEtaWaypointGps(lib, value);
      let waypoints = lib.waypoints ?? [];
      if (known && !findEtaWaypointByName(waypoints, value)) {
        waypoints = upsertEtaWaypoint(waypoints, value, known);
      }
      return {
        ...lib,
        waypoints,
        draft: this.touchDraft({
          ...lib.draft,
          fromPort: value,
          fromGps: pickEtaGpsForRenamedWaypoint(
            lib.draft.fromPort,
            value,
            lib.draft.fromGps,
            known,
          ),
          ...extra,
        }),
      };
    });
  }

  /** Set arrival port; auto-fill toGps when name is known. */
  setToPort(value: string, extra?: Partial<Pick<EtaPlan, 'arrivalUtcOffsetHours'>>): void {
    this.updateLibrary((lib) => {
      const known = resolveEtaWaypointGps(lib, value);
      let waypoints = lib.waypoints ?? [];
      if (known && !findEtaWaypointByName(waypoints, value)) {
        waypoints = upsertEtaWaypoint(waypoints, value, known);
      }
      return {
        ...lib,
        waypoints,
        draft: this.touchDraft({
          ...lib.draft,
          toPort: value,
          toGps: pickEtaGpsForRenamedWaypoint(lib.draft.toPort, value, lib.draft.toGps, known),
          ...extra,
        }),
      };
    });
  }

  /**
   * Save GPS under a waypoint/port name and sync every matching label in draft + all saved plans.
   * Persists immediately (Done from GPS panel) — not on every keystroke.
   */
  setWaypointGps(name: string, coords: EtaGpsCoords | null): void {
    const key = etaWaypointGpsKey(name);
    if (!key) return;
    this.updateLibrary((lib) => {
      let waypoints = [...(lib.waypoints ?? [])];
      if (coords) {
        waypoints = upsertEtaWaypoint(waypoints, name, coords);
      } else {
        const existing = findEtaWaypointByName(waypoints, name);
        if (existing) {
          waypoints = removeEtaWaypoint(waypoints, existing.id).waypoints;
        }
      }
      return {
        ...lib,
        waypoints,
        draft: this.touchDraft(applyEtaGpsByWaypointName(lib.draft, name, coords)),
        plans: lib.plans.map((plan) => applyEtaGpsByWaypointName(plan, name, coords)),
      };
    });
    void this.state.persist('memory');
  }

  /** Create or update a catalog entry (modal editor). Syncs matching route labels. */
  saveWaypointEntry(
    input: { id?: string; name: string; lat: number; lon: number },
  ): { ok: true } | { ok: false; error: string } {
    const entry = createEtaWaypointGpsEntry(input);
    if (!entry) return { ok: false, error: 'Enter a name and valid coordinates' };

    const lib = this.data().etaLibrary;
    const waypoints = lib.waypoints ?? [];
    const nameKey = etaWaypointGpsKey(entry.name);
    const nameClash = waypoints.find(
      (w) => etaWaypointGpsKey(w.name) === nameKey && w.id !== input.id,
    );
    if (nameClash) return { ok: false, error: `Name "${entry.name}" already exists` };

    const coordClash = waypoints.find(
      (w) =>
        w.id !== input.id &&
        w.lat.toFixed(6) === entry.lat.toFixed(6) &&
        w.lon.toFixed(6) === entry.lon.toFixed(6),
    );
    if (coordClash) {
      return { ok: false, error: `Coordinates already used by "${coordClash.name}"` };
    }

    this.updateLibrary((current) => {
      let nextList = [...(current.waypoints ?? [])];
      const idx = input.id ? nextList.findIndex((w) => w.id === input.id) : -1;
      const prevName = idx >= 0 ? nextList[idx]!.name : null;
      if (idx >= 0) {
        nextList[idx] = { ...entry, id: nextList[idx]!.id };
      } else {
        nextList = upsertEtaWaypoint(nextList, entry.name, {
          lat: entry.lat,
          lon: entry.lon,
        });
      }
      const coords = { lat: entry.lat, lon: entry.lon };
      let draft = current.draft;
      let plans = current.plans;
      if (prevName && etaWaypointGpsKey(prevName) !== nameKey) {
        draft = applyEtaGpsByWaypointName(draft, prevName, null);
        plans = plans.map((p) => applyEtaGpsByWaypointName(p, prevName, null));
      }
      draft = applyEtaGpsByWaypointName(draft, entry.name, coords);
      plans = plans.map((p) => applyEtaGpsByWaypointName(p, entry.name, coords));
      return {
        ...current,
        waypoints: nextList,
        draft: this.touchDraft(draft),
        plans,
      };
    });
    void this.state.persist('memory');
    return { ok: true };
  }

  deleteWaypointEntry(id: string): void {
    this.updateLibrary((lib) => {
      const { waypoints, removed } = removeEtaWaypoint(lib.waypoints ?? [], id);
      if (!removed) return lib;
      return {
        ...lib,
        waypoints,
        draft: this.touchDraft(applyEtaGpsByWaypointName(lib.draft, removed.name, null)),
        plans: lib.plans.map((plan) => applyEtaGpsByWaypointName(plan, removed.name, null)),
      };
    });
  }

  reorderWaypoints(fromIndex: number, toIndex: number): void {
    this.updateLibrary((lib) => ({
      ...lib,
      waypoints: reorderEtaWaypoints(lib.waypoints ?? [], fromIndex, toIndex),
    }));
  }

  lookupWaypointGps(name: string): EtaGpsCoords | null {
    return resolveEtaWaypointGps(this.data().etaLibrary, name);
  }

  newDraft(): void {
    this.updateLibrary(
      (lib) => ({
        ...lib,
        draft: createDefaultEtaPlan(),
        activePlanId: null,
      }),
      'saved',
    );
  }

  /** Saves current draft as a new library entry, or overwrites an existing plan when overwritePlanId is set. */
  saveAs(name: string, options?: { overwritePlanId?: string }): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.updateLibrary((lib) => {
      const now = new Date().toISOString();
      const existing = options?.overwritePlanId
        ? lib.plans.find((p) => p.id === options.overwritePlanId)
        : undefined;

      if (existing) {
        const saved: EtaPlan = {
          ...cloneEtaPlan(lib.draft),
          id: existing.id,
          name: trimmed,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
        return {
          ...lib,
          plans: lib.plans.map((p) => (p.id === existing.id ? saved : p)),
          activePlanId: lib.activePlanId === existing.id ? null : lib.activePlanId,
        };
      }

      const saved: EtaPlan = {
        ...cloneEtaPlan(lib.draft),
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...lib,
        plans: [...lib.plans, saved],
        activePlanId: null,
      };
    }, 'saved');
  }

  findPlanByName(name: string): EtaPlan | undefined {
    const key = name.trim().toLowerCase();
    if (!key) return undefined;
    return normalizeEtaLibrary(this.data().etaLibrary).plans.find(
      (p) => p.name.trim().toLowerCase() === key,
    );
  }

  /** Loads a saved plan into the editor (new draft id — edits won't overwrite the saved copy). */
  loadPlan(planId: string): void {
    this.updateLibrary((lib) => {
      const plan = lib.plans.find((p) => p.id === planId);
      if (!plan) return lib;
      const draft = hydrateEtaPlanWaypointGps(cloneEtaPlan(plan), lib);
      draft.id = crypto.randomUUID();
      draft.name = '';
      return {
        ...lib,
        draft: this.touchDraft(draft),
        activePlanId: null,
      };
    });
  }

  deletePlan(planId: string): void {
    this.updateLibrary(
      (lib) => ({
        ...lib,
        plans: lib.plans.filter((p) => p.id !== planId),
        activePlanId: lib.activePlanId === planId ? null : lib.activePlanId,
      }),
      'saved',
    );
  }
}

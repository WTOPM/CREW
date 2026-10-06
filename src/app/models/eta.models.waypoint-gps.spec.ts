import { describe, expect, it } from 'vitest';
import {
  createDefaultEtaPlan,
  createEtaLeg,
  etaWaypointGpsKey,
  findEtaWaypointByName,
  hydrateEtaPlanWaypointGps,
  normalizeEtaLibrary,
  pickEtaGpsForRenamedWaypoint,
  reorderEtaWaypoints,
  resolveEtaWaypointGps,
  upsertEtaWaypoint,
} from '../models/eta.models';

describe('eta waypoints catalog', () => {
  it('normalizes keys case-insensitively', () => {
    expect(etaWaypointGpsKey('  Weser   Pilot ')).toBe('weser pilot');
  });

  it('migrates legacy waypointGps map into ordered waypoints', () => {
    const lib = normalizeEtaLibrary({
      draft: createDefaultEtaPlan(),
      plans: [],
      activePlanId: null,
      waypointGps: { 'weser pilot': { lat: 53.5, lon: 8.1 } },
    });
    expect(lib.waypoints).toHaveLength(1);
    expect(lib.waypoints[0]!.name.toLowerCase()).toContain('weser');
    expect(lib.waypoints[0]!.lat).toBe(53.5);
  });

  it('upserts by unique name and unique coordinates', () => {
    let list = upsertEtaWaypoint([], 'A', { lat: 1, lon: 2 });
    list = upsertEtaWaypoint(list, 'A', { lat: 3, lon: 4 });
    expect(list).toHaveLength(1);
    expect(list[0]!.lat).toBe(3);
    list = upsertEtaWaypoint(list, 'B', { lat: 3, lon: 4 });
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('B');
  });

  it('reorders and keeps entries', () => {
    const a = upsertEtaWaypoint([], 'A', { lat: 1, lon: 1 });
    const b = upsertEtaWaypoint(a, 'B', { lat: 2, lon: 2 });
    const c = upsertEtaWaypoint(b, 'C', { lat: 3, lon: 3 });
    const re = reorderEtaWaypoints(c, 0, 2);
    expect(re.map((w) => w.name)).toEqual(['B', 'C', 'A']);
  });

  it('resolves GPS from catalog for a new matching name', () => {
    const lib = normalizeEtaLibrary({
      draft: createDefaultEtaPlan(),
      plans: [
        {
          ...createDefaultEtaPlan(),
          legs: [
            createEtaLeg({ toLabel: 'WESER PILOT', toGps: { lat: 53.5, lon: 8.1 } }),
            createEtaLeg(),
          ],
        },
      ],
      waypoints: [],
    });
    expect(resolveEtaWaypointGps(lib, 'weser pilot')).toEqual({ lat: 53.5, lon: 8.1 });
    expect(findEtaWaypointByName(lib.waypoints, 'WESER PILOT')).not.toBeNull();
  });

  it('does not wipe GPS when the same name is re-emitted', () => {
    expect(
      pickEtaGpsForRenamedWaypoint('WESER PILOT', 'WESER PILOT', { lat: 53.5, lon: 8.1 }, null),
    ).toEqual({ lat: 53.5, lon: 8.1 });
  });

  it('hydrates empty slots from catalog', () => {
    const lib = {
      draft: createDefaultEtaPlan(),
      plans: [],
      waypoints: [{ id: '1', name: 'WESER PILOT', lat: 53.5, lon: 8.1 }],
    };
    const plan = {
      ...createDefaultEtaPlan(),
      legs: [createEtaLeg({ toLabel: 'WESER PILOT' }), createEtaLeg()],
    };
    const next = hydrateEtaPlanWaypointGps(plan, lib);
    expect(next.legs[0]!.toGps).toEqual({ lat: 53.5, lon: 8.1 });
  });
});

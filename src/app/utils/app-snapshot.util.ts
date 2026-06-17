import type { CrewMember, PortAuthority, PortPackage, PortPackageItem } from '../models/crew.models';
import type { AppData } from '../models/crew.models';
import type { AppMainSnapshot } from '../models/app-snapshot.models';
import type { PassengerMember } from '../models/passenger.models';

export function extractMainAppSnapshot(data: AppData): AppMainSnapshot {
  const {
    dgLibrary: _dg,
    reeferLibrary: _rf,
    seedVersion: _sv,
    ...main
  } = structuredClone(data);
  return main;
}

export function cloneMainAppSnapshot(snapshot: AppMainSnapshot): AppMainSnapshot {
  return structuredClone(snapshot);
}

/**
 * Apply a saved snapshot onto live data while preserving reference lists,
 * the fullest document packages, and crew/passenger archives.
 */
export function mergeMainAppSnapshotIntoLive(live: AppData, snapshot: AppMainSnapshot): AppMainSnapshot {
  const snap = structuredClone(snapshot);
  return {
    ...snap,
    ports: structuredClone(live.ports),
    ranks: [...live.ranks],
    nationalities: [...live.nationalities],
    printPackages: mergePrintPackagesMaxFilled(live.printPackages, snap.printPackages),
    crew: mergeCrewMembersForSnapshotApply(live.crew, snap.crew),
    passengers: mergePassengersForSnapshotApply(live.passengers, snap.passengers),
  };
}

function mergeCrewMembersForSnapshotApply(live: CrewMember[], snapshot: CrewMember[]): CrewMember[] {
  return mergeRosterForSnapshotApply(live, snapshot);
}

function mergePassengersForSnapshotApply(
  live: PassengerMember[],
  snapshot: PassengerMember[],
): PassengerMember[] {
  return mergeRosterForSnapshotApply(live, snapshot);
}

/** Snapshot defines active lists; live-only members stay archived, never deleted. */
function mergeRosterForSnapshotApply<T extends CrewMember | PassengerMember>(
  live: T[],
  snapshot: T[],
): T[] {
  const snapshotIds = new Set(snapshot.map((m) => m.id));
  const result: T[] = snapshot.map((m) => structuredClone(m));

  for (const member of live) {
    if (snapshotIds.has(member.id)) continue;
    if (member.archived || member.archivedFromDeparture) {
      result.push(structuredClone(member));
      continue;
    }
    result.push({
      ...structuredClone(member),
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
      archivedFromDeparture: false,
    });
  }

  return result;
}

export function mergePrintPackagesMaxFilled(live: PortPackage[], snapshot: PortPackage[]): PortPackage[] {
  const byPort = new Map<string, PortPackage>();

  for (const pkg of [...live, ...snapshot]) {
    const port = pkg.port?.trim();
    if (!port) continue;
    const key = port.toLowerCase();
    const prev = byPort.get(key);
    if (!prev) {
      byPort.set(key, structuredClone(pkg));
      continue;
    }
    byPort.set(key, {
      port: prev.port || port,
      authorities: mergePortAuthorities(prev.authorities, pkg.authorities),
    });
  }

  return [...byPort.values()].sort((a, b) => a.port.localeCompare(b.port));
}

function mergePortAuthorities(a: PortAuthority[], b: PortAuthority[]): PortAuthority[] {
  const byName = new Map<string, PortAuthority>();

  for (const auth of [...a, ...b]) {
    const label = auth.name?.trim() || '(unnamed)';
    const key = label.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, {
        name: auth.name?.trim() || label,
        items: auth.items.map((it) => ({ ...it })),
      });
      continue;
    }
    byName.set(key, {
      name: prev.name || auth.name?.trim() || label,
      items: mergePortPackageItems(prev.items, auth.items),
    });
  }

  return [...byName.values()];
}

function mergePortPackageItems(a: PortPackageItem[], b: PortPackageItem[]): PortPackageItem[] {
  const byDoc = new Map<string, PortPackageItem>();
  const order: string[] = [];

  for (const item of [...a, ...b]) {
    const documentId = item.documentId?.trim();
    if (!documentId) continue;
    if (!byDoc.has(documentId)) order.push(documentId);
    const prev = byDoc.get(documentId);
    byDoc.set(documentId, {
      documentId,
      copies: Math.max(prev?.copies ?? 1, item.copies ?? 1),
    });
  }

  return order.map((id) => byDoc.get(id)!);
}

// Feature store for the passenger domain: arrival / departure / archive lists and the
// sync / preview / apply flows. Mirrors CrewStore (same list-membership flag model:
// onArrivalList / onDepartureList / archived / archivedFromDeparture, linked vs diverged
// lists).
//
// State is shared via AppStateStore. Read selectors stay on StorageService for backward
// compatibility; this store owns passenger mutations + their private helpers.

import { Injectable, inject } from '@angular/core';
import {
  ArrivalToDepartureSyncPreview,
  DepartureToArrivalSyncPreview,
} from '../models/crew.models';
import {
  PassengerMember,
  PaxListKind,
  createEmptyPassenger,
  migratePassengerListFlags,
  arePassengerListsInSync,
  filterActivePassengerList,
  activePassengerListIds,
} from '../models/passenger.models';
import { rescueOrphanPassengers } from './app-data-normalizer';
import { reorderIdList } from '../utils/list-reorder.util';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class PassengerStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  addPassenger(member?: Partial<PassengerMember>): PassengerMember {
    const newMember = migratePassengerListFlags({
      ...createEmptyPassenger(),
      ...member,
    });
    this.data.update((d) => ({ ...d, passengers: [...d.passengers, newMember] }));
    void this.state.persist('silent');
    return newMember;
  }

  updatePassenger(
    id: string,
    partial: Partial<PassengerMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }));
    void this.state.persist(notify);
  }

  addPassengerToArrival(member?: Partial<PassengerMember>): PassengerMember {
    const d = this.data();
    const linked = arePassengerListsInSync(
      d.passengers,
      d.passengerArrivalOrder,
      d.passengerDepartureOrder,
    );
    return this.addPassenger({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: true,
      onDepartureList: linked,
    });
  }

  addPassengerToDeparture(member?: Partial<PassengerMember>): PassengerMember {
    return this.addPassenger({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: false,
      onDepartureList: true,
    });
  }

  addPassengerToArchive(member?: Partial<PassengerMember>): PassengerMember {
    return this.addPassenger({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
      archivedFromDeparture: false,
    });
  }

  archivePassenger(id: string): void {
    this.updatePassenger(
      id,
      {
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      },
      'silent',
    );
  }

  restorePassengerToList(id: string, list: PaxListKind): void {
    this.updatePassenger(id, this.passengerRestorePatch(list), 'silent');
  }

  /** Linked lists: restore on arrival adds to both; restore on departure adds to departure only. */
  private passengerRestorePatch(list: PaxListKind): Partial<PassengerMember> {
    const d = this.data();
    const linked = arePassengerListsInSync(
      d.passengers,
      d.passengerArrivalOrder,
      d.passengerDepartureOrder,
    );
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival',
      onDepartureList: list === 'departure' || (list === 'arrival' && linked),
    };
  }

  archiveFromPassengerList(id: string, _list: PaxListKind): 'archived' {
    const member = this.data().passengers.find((m) => m.id === id);
    if (!member || member.archived) return 'archived';
    this.archivePassenger(id);
    return 'archived';
  }

  /** FROM ARRIVAL: copy arrival list + archive to departure; merge extra departure archive. */
  syncPassengerDepartureFromArrival(): ArrivalToDepartureSyncPreview {
    const preview = this.previewPassengerArrivalToDeparture();
    this.data.update((d) => {
      let passengers = d.passengers.map((m) => this.mapPassengerArrivalToDepartureSync(m));
      passengers = this.mergePassengerDepartureArchiveIntoArrivalArchive(passengers);
      passengers = this.reorderPassengerLikeList(passengers, 'arrival', d.passengerArrivalOrder);
      return {
        ...d,
        passengers: rescueOrphanPassengers(passengers),
        passengerArrivalOrder: undefined,
        passengerDepartureOrder: undefined,
      };
    });
    void this.state.persist('saved');
    return preview;
  }

  previewPassengerArrivalToDeparture(): ArrivalToDepartureSyncPreview {
    const active = this.data().passengers.filter((m) => !m.archived);
    return {
      onArrival: active.filter((m) => m.onArrivalList).length,
      departureOnlyToArchive: active.filter((m) => m.onDepartureList && !m.onArrivalList).length,
      departureArchiveMerged: this.data().passengers.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** INTO ARRIVAL: copy departure list to arrival; merge departure archive into arrival archive. */
  applyPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewPassengerDepartureToArrival();
    this.data.update((d) => {
      let passengers = d.passengers.map((m) => this.mapPassengerDepartureToArrival(m));
      passengers = this.mergePassengerDepartureArchiveIntoArrivalArchive(passengers);
      passengers = this.reorderPassengerLikeList(
        passengers,
        'departure',
        d.passengerDepartureOrder,
      );
      return {
        ...d,
        passengers: rescueOrphanPassengers(passengers),
        passengerArrivalOrder: undefined,
        passengerDepartureOrder: undefined,
      };
    });
    void this.state.persist('saved');
    return preview;
  }

  previewPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().passengers.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
      departureArchiveMerged: this.data().passengers.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  archiveArrivalOnlyPassengers(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => {
        if (m.archived || m.onDepartureList || !m.onArrivalList) return m;
        count++;
        return {
          ...m,
          archived: true,
          onArrivalList: false,
          onDepartureList: false,
          archivedFromDeparture: false,
        };
      }),
    }));
    if (count > 0) void this.state.persist(notify);
    return count;
  }

  private mapPassengerDepartureToArrival(m: PassengerMember): PassengerMember {
    if (m.archived) return m;
    if (m.onDepartureList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      };
    }
    return m;
  }

  private mapPassengerArrivalToDepartureSync(m: PassengerMember): PassengerMember {
    if (m.archived) {
      return {
        ...m,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onDepartureList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    return m;
  }

  private mergePassengerDepartureArchiveIntoArrivalArchive(
    passengers: PassengerMember[],
  ): PassengerMember[] {
    return passengers.map((m) => {
      if (!m.archivedFromDeparture || m.archived) return m;
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
      };
    });
  }

  private reorderPassengerLikeList(
    passengers: PassengerMember[],
    list: PaxListKind,
    orderOverride?: readonly string[] | null,
  ): PassengerMember[] {
    const ordered = filterActivePassengerList(passengers, list, orderOverride);
    const orderedIds = new Set(ordered.map((m) => m.id));
    const rest = passengers.filter((m) => !orderedIds.has(m.id));
    return [...ordered, ...rest];
  }

  /** Remove from departure list → departure archive (stays on arrival if listed there). */
  removePassengerFromDepartureList(id: string): void {
    const member = this.data().passengers.find((m) => m.id === id);
    if (!member) return;

    const patch: Partial<PassengerMember> = {
      onDepartureList: false,
      archivedFromDeparture: true,
    };
    if (!member.onArrivalList) {
      patch.archived = true;
      patch.onArrivalList = false;
    }
    this.updatePassenger(id, patch, 'silent');
  }

  removePassengerFromArrivalList(id: string): void {
    const d = this.data();
    if (arePassengerListsInSync(d.passengers, d.passengerArrivalOrder, d.passengerDepartureOrder)) {
      this.archivePassenger(id);
      return;
    }

    const member = this.data().passengers.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updatePassenger(id, { onArrivalList: false }, 'silent');
      return;
    }

    if (member.onDepartureList) {
      this.updatePassenger(id, { onArrivalList: false }, 'silent');
      return;
    }

    this.archivePassenger(id);
  }

  removePassenger(id: string): void {
    this.data.update((d) => ({ ...d, passengers: d.passengers.filter((m) => m.id !== id) }));
    void this.state.persist('silent');
  }

  reorderPassengerList(list: PaxListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    this.data.update((d) => {
      const linked = arePassengerListsInSync(
        d.passengers,
        d.passengerArrivalOrder,
        d.passengerDepartureOrder,
      );
      if (list === 'arrival') {
        if (linked) {
          return {
            ...d,
            passengers: this.reorderMembersInPassengerArray(
              d.passengers,
              'arrival',
              fromIndex,
              toIndex,
            ),
            passengerArrivalOrder: undefined,
            passengerDepartureOrder: undefined,
          };
        }
        const ids = activePassengerListIds(d.passengers, 'arrival', d.passengerArrivalOrder);
        return { ...d, passengerArrivalOrder: reorderIdList(ids, fromIndex, toIndex) };
      }

      const ids = activePassengerListIds(d.passengers, 'departure', d.passengerDepartureOrder);
      const reordered = reorderIdList(ids, fromIndex, toIndex);
      if (linked) {
        const arrivalIds = activePassengerListIds(d.passengers, 'arrival', d.passengerArrivalOrder);
        return {
          ...d,
          passengerArrivalOrder: arrivalIds,
          passengerDepartureOrder: reordered,
        };
      }
      return { ...d, passengerDepartureOrder: reordered };
    });
    void this.state.persist('debounced');
  }

  private reorderMembersInPassengerArray(
    passengers: PassengerMember[],
    list: PaxListKind,
    fromIndex: number,
    toIndex: number,
  ): PassengerMember[] {
    const inList = (m: PassengerMember) =>
      list === 'arrival' ? !m.archived && m.onArrivalList : !m.archived && m.onDepartureList;
    const indices: number[] = [];
    const members: PassengerMember[] = [];
    passengers.forEach((m, i) => {
      if (inList(m)) {
        indices.push(i);
        members.push(m);
      }
    });
    const reordered = [...members];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const next = [...passengers];
    indices.forEach((idx, j) => {
      next[idx] = reordered[j];
    });
    return next;
  }
}

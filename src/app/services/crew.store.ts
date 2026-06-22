// Feature store for the crew domain: the arrival / departure / archive lists and the
// sync / preview / apply flows between them. The most intricate slice — list
// membership is encoded on each member via onArrivalList / onDepartureList / archived /
// archivedFromDeparture flags, and the two lists can be "linked" (in sync) or diverged.
//
// State is shared via AppStateStore. Read selectors stay on StorageService for backward
// compatibility; this store owns crew mutations + their private helpers.

import { Injectable, inject } from '@angular/core';
import {
  CrewMember,
  CrewListKind,
  CrewDocumentType,
  ArrivalToDepartureSyncPreview,
  DepartureToArrivalSyncPreview,
  createEmptyCrewMember,
  migrateCrewListFlags,
  areCrewListsInSync,
  activeCrewListIds,
  filterActiveCrewList,
} from '../models/crew.models';
import { rescueOrphanCrew } from './app-data-normalizer';
import { reorderIdList } from '../utils/list-reorder.util';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class CrewStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  addCrewMember(member?: Partial<CrewMember>): CrewMember {
    const newMember = migrateCrewListFlags({
      ...createEmptyCrewMember(),
      ...member,
    });
    this.data.update((d) => ({ ...d, crew: [...d.crew, newMember] }));
    void this.state.persist('silent');
    return newMember;
  }

  updateCrewMember(
    id: string,
    partial: Partial<CrewMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }));
    void this.state.persist(notify);
  }

  addCrewMemberToArrival(member?: Partial<CrewMember>): CrewMember {
    const d = this.data();
    const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
    return this.addCrewMember({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: true,
      onDepartureList: linked,
    });
  }

  addCrewMemberToDeparture(member?: Partial<CrewMember>): CrewMember {
    return this.addCrewMember({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: false,
      onDepartureList: true,
    });
  }

  addCrewMemberToArchive(member?: Partial<CrewMember>): CrewMember {
    return this.addCrewMember({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
      archivedFromDeparture: false,
    });
  }

  archiveCrewMember(id: string): void {
    this.updateCrewMember(
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

  restoreCrewMemberToList(id: string, list: CrewListKind): void {
    this.updateCrewMember(id, this.crewRestorePatch(list), 'silent');
  }

  /** Linked lists: restore on arrival adds to both; restore on departure adds to departure only. */
  private crewRestorePatch(list: CrewListKind): Partial<CrewMember> {
    const d = this.data();
    const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival',
      onDepartureList: list === 'departure' || (list === 'arrival' && linked),
    };
  }

  /**
   * Move to archive (both lists). Use removeFromArrivalList / removeFromDepartureList
   * when lists differ and the person should stay on the other list for printing.
   */
  archiveFromCrewList(id: string, _list: CrewListKind): 'archived' {
    const member = this.data().crew.find((m) => m.id === id);
    if (!member || member.archived) return 'archived';
    this.archiveCrewMember(id);
    return 'archived';
  }

  /** FROM ARRIVAL: copy arrival list + archive to departure; merge extra departure archive. */
  syncDepartureFromArrival(): ArrivalToDepartureSyncPreview {
    const preview = this.previewArrivalToDeparture();
    this.data.update((d) => {
      let crew = d.crew.map((m) => this.mapCrewArrivalToDepartureSync(m));
      crew = this.mergeDepartureArchiveIntoArrivalArchive(crew);
      crew = this.reorderCrewLikeList(crew, 'arrival', d.crewArrivalOrder);
      return {
        ...d,
        crew: rescueOrphanCrew(crew),
        crewArrivalOrder: undefined,
        crewDepartureOrder: undefined,
      };
    });
    void this.state.persist('saved');
    return preview;
  }

  previewArrivalToDeparture(): ArrivalToDepartureSyncPreview {
    const active = this.data().crew.filter((m) => !m.archived);
    return {
      onArrival: active.filter((m) => m.onArrivalList).length,
      departureOnlyToArchive: active.filter((m) => m.onDepartureList && !m.onArrivalList).length,
      departureArchiveMerged: this.data().crew.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** INTO ARRIVAL: copy departure list to arrival; merge departure archive into arrival archive. */
  applyDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewDepartureToArrival();
    this.data.update((d) => {
      let crew = d.crew.map((m) => this.mapCrewDepartureToArrival(m));
      crew = this.mergeDepartureArchiveIntoArrivalArchive(crew);
      crew = this.reorderCrewLikeList(crew, 'departure', d.crewDepartureOrder);
      return {
        ...d,
        crew: rescueOrphanCrew(crew),
        crewArrivalOrder: undefined,
        crewDepartureOrder: undefined,
      };
    });
    void this.state.persist('saved');
    return preview;
  }

  previewDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().crew.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
      departureArchiveMerged: this.data().crew.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** Active crew on arrival but not departure → archive. Returns count archived. */
  archiveArrivalOnlyCrew(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => {
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

  private mapCrewDepartureToArrival(m: CrewMember): CrewMember {
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

  private mapCrewArrivalToDepartureSync(m: CrewMember): CrewMember {
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

  private mergeDepartureArchiveIntoArrivalArchive(crew: CrewMember[]): CrewMember[] {
    return crew.map((m) => {
      if (!m.archivedFromDeparture || m.archived) return m;
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
      };
    });
  }

  private reorderCrewLikeList(
    crew: CrewMember[],
    list: CrewListKind,
    orderOverride?: readonly string[] | null,
  ): CrewMember[] {
    const ordered = filterActiveCrewList(crew, list, orderOverride);
    const orderedIds = new Set(ordered.map((m) => m.id));
    const rest = crew.filter((m) => !orderedIds.has(m.id));
    return [...ordered, ...rest];
  }

  /** Remove from departure list → departure archive (stays on arrival if listed there). */
  removeFromDepartureList(id: string): void {
    const member = this.data().crew.find((m) => m.id === id);
    if (!member) return;

    const patch: Partial<CrewMember> = {
      onDepartureList: false,
      archivedFromDeparture: true,
    };
    if (!member.onArrivalList) {
      patch.archived = true;
      patch.onArrivalList = false;
    }
    this.updateCrewMember(id, patch, 'silent');
  }

  removeFromArrivalList(id: string): void {
    const d = this.data();
    if (areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder)) {
      this.archiveCrewMember(id);
      return;
    }

    const member = this.data().crew.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updateCrewMember(id, { onArrivalList: false }, 'silent');
      return;
    }

    if (member.onDepartureList) {
      this.updateCrewMember(id, { onArrivalList: false }, 'silent');
      return;
    }

    this.archiveCrewMember(id);
  }

  removeCrewMember(id: string): void {
    this.data.update((d) => ({ ...d, crew: d.crew.filter((m) => m.id !== id) }));
    void this.state.persist('silent');
  }

  setCrewDocumentAttached(crewId: string, docType: CrewDocumentType, attached: boolean): void {
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) =>
        m.id === crewId
          ? {
              ...m,
              documents: { ...m.documents, [docType]: attached },
            }
          : m,
      ),
    }));
    void this.state.persist('debounced');
  }

  setCrewSignatureAttached(crewId: string, attached: boolean, fileName: string): void {
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) =>
        m.id === crewId
          ? {
              ...m,
              hasSignature: attached,
              signatureFileName: attached ? fileName : '',
            }
          : m,
      ),
    }));
    void this.state.persist('debounced');
  }

  reorderCrewList(list: CrewListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    this.data.update((d) => {
      const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
      if (list === 'arrival') {
        if (linked) {
          return {
            ...d,
            crew: this.reorderMembersInCrewArray(d.crew, 'arrival', fromIndex, toIndex),
            crewArrivalOrder: undefined,
            crewDepartureOrder: undefined,
          };
        }
        const ids = activeCrewListIds(d.crew, 'arrival', d.crewArrivalOrder);
        return { ...d, crewArrivalOrder: reorderIdList(ids, fromIndex, toIndex) };
      }

      const ids = activeCrewListIds(d.crew, 'departure', d.crewDepartureOrder);
      const reordered = reorderIdList(ids, fromIndex, toIndex);
      if (linked) {
        const arrivalIds = activeCrewListIds(d.crew, 'arrival', d.crewArrivalOrder);
        return {
          ...d,
          crewArrivalOrder: arrivalIds,
          crewDepartureOrder: reordered,
        };
      }
      return { ...d, crewDepartureOrder: reordered };
    });
    void this.state.persist('debounced');
  }

  private reorderMembersInCrewArray(
    crew: CrewMember[],
    list: CrewListKind,
    fromIndex: number,
    toIndex: number,
  ): CrewMember[] {
    const inList = (m: CrewMember) =>
      list === 'arrival'
        ? !m.archived && m.onArrivalList
        : !m.archived && m.onDepartureList;
    const indices: number[] = [];
    const members: CrewMember[] = [];
    crew.forEach((m, i) => {
      if (inList(m)) {
        indices.push(i);
        members.push(m);
      }
    });
    const reordered = [...members];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const next = [...crew];
    indices.forEach((idx, j) => {
      next[idx] = reordered[j];
    });
    return next;
  }
}

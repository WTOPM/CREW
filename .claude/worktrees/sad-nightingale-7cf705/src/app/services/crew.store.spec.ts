import { TestBed } from '@angular/core/testing';
import { CrewStore } from './crew.store';
import { AppStateStore } from './app-state.store';
import { createEmptyAppData } from '../data/empty-app-data';
import { createEmptyCrewMember } from '../models/crew.models';

describe('CrewStore', () => {
  let store: CrewStore;
  let state: AppStateStore;

  beforeEach(() => {
    state = TestBed.inject(AppStateStore);
    state.data.set(createEmptyAppData());
    store = TestBed.inject(CrewStore);
  });

  it('addCrewMemberToArrival adds an active arrival member', () => {
    const member = store.addCrewMemberToArrival();
    const crew = state.data().crew;
    expect(crew).toHaveLength(1);
    expect(crew[0].id).toBe(member.id);
    expect(crew[0].onArrivalList).toBe(true);
    expect(crew[0].archived).toBe(false);
  });

  it('addCrewMemberToArchive adds an archived member only', () => {
    store.addCrewMemberToArchive();
    const m = state.data().crew[0];
    expect(m.archived).toBe(true);
    expect(m.onArrivalList).toBe(false);
    expect(m.onDepartureList).toBe(false);
  });

  it('updateCrewMember patches the matching member', () => {
    const m = store.addCrewMemberToArrival();
    store.updateCrewMember(m.id, { rank: 'BOSUN' }, 'silent');
    expect(state.data().crew[0].rank).toBe('BOSUN');
  });

  it('archiveCrewMember removes the member from both lists', () => {
    const m = store.addCrewMemberToArrival();
    store.archiveCrewMember(m.id);
    const updated = state.data().crew[0];
    expect(updated.archived).toBe(true);
    expect(updated.onArrivalList).toBe(false);
  });

  it('removeCrewMember deletes the member entirely', () => {
    const m = store.addCrewMemberToArrival();
    store.removeCrewMember(m.id);
    expect(state.data().crew).toHaveLength(0);
  });

  it('archiveArrivalOnlyCrew archives members on arrival but not departure', () => {
    const arrivalOnly = { ...createEmptyCrewMember(), onArrivalList: true, onDepartureList: false };
    const onBoth = { ...createEmptyCrewMember(), onArrivalList: true, onDepartureList: true };
    state.data.set({ ...createEmptyAppData(), crew: [arrivalOnly, onBoth] });

    const count = store.archiveArrivalOnlyCrew('silent');

    expect(count).toBe(1);
    const crew = state.data().crew;
    expect(crew.find((c) => c.id === arrivalOnly.id)?.archived).toBe(true);
    expect(crew.find((c) => c.id === onBoth.id)?.archived).toBe(false);
  });

  it('previewDepartureToArrival counts arrival-only members heading to archive', () => {
    const arrivalOnly = { ...createEmptyCrewMember(), onArrivalList: true, onDepartureList: false };
    const onDeparture = { ...createEmptyCrewMember(), onArrivalList: false, onDepartureList: true };
    state.data.set({ ...createEmptyAppData(), crew: [arrivalOnly, onDeparture] });

    const preview = store.previewDepartureToArrival();

    expect(preview.onDeparture).toBe(1);
    expect(preview.arrivalOnlyToArchive).toBe(1);
  });
});

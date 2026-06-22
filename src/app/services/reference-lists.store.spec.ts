import { TestBed } from '@angular/core/testing';
import { ReferenceListsStore } from './reference-lists.store';
import { AppStateStore } from './app-state.store';
import { createEmptyAppData } from '../data/empty-app-data';

describe('ReferenceListsStore', () => {
  let store: ReferenceListsStore;
  let state: AppStateStore;

  beforeEach(() => {
    state = TestBed.inject(AppStateStore);
    state.data.set(createEmptyAppData());
    store = TestBed.inject(ReferenceListsStore);
  });

  it('addPort adds a trimmed port', () => {
    store.addPort('  Hamburg  ', 'DEHAM', 'GERMANY');
    expect(state.data().ports).toHaveLength(1);
    expect(state.data().ports[0]).toMatchObject({ name: 'Hamburg', code: 'DEHAM', country: 'GERMANY' });
  });

  it('addPort ignores blank names', () => {
    store.addPort('   ', '', '');
    expect(state.data().ports).toHaveLength(0);
  });

  it('removePort removes by exact name', () => {
    store.addPort('Hamburg', '', '');
    store.addPort('Rotterdam', '', '');
    store.removePort('Hamburg');
    expect(state.data().ports.map((p) => p.name)).toEqual(['Rotterdam']);
  });

  it('addRank dedupes exact duplicates and ignores blanks', () => {
    store.addRank('Master');
    store.addRank('Master');
    store.addRank('  ');
    expect(state.data().ranks).toEqual(['Master']);
  });

  it('removeRank removes the matching rank', () => {
    store.addRank('Master');
    store.addRank('Bosun');
    store.removeRank('Master');
    expect(state.data().ranks).toEqual(['Bosun']);
  });

  it('reorderRanks moves a rank to a new position', () => {
    store.addRank('A');
    store.addRank('B');
    store.addRank('C');
    store.reorderRanks(2, 0);
    expect(state.data().ranks).toEqual(['C', 'A', 'B']);
  });

  it('addNationality and removeNationality manage the list', () => {
    store.addNationality('CYPRUS');
    store.addNationality('UKRAINE');
    store.removeNationality('CYPRUS');
    expect(state.data().nationalities).toEqual(['UKRAINE']);
  });

  it('addPortTerminal attaches a terminal to the matching port', () => {
    store.addPort('Hamburg', '', '');
    store.addPortTerminal('Hamburg', 'CTA', 'Container Terminal Altenwerder');
    const terminals = state.data().ports[0].terminals ?? [];
    expect(terminals).toHaveLength(1);
    expect(terminals[0].abbrev).toBe('CTA');
  });
});

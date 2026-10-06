import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyAppData } from '../data/empty-app-data';
import {
  getBundledUnNumberRows,
  lookupUnNumberReference,
  setUnNumberReferenceOverride,
  type UnNumberReferenceRow,
} from '../utils/dg-un-number.util';
import type { ImdgChapter32Entry } from '../utils/dg-imdg-chapter32-pdf.util';
import { AppStateStore } from './app-state.store';
import { DgUnReferenceStore } from './dg-un-reference.store';

function entry(unNo: string, over: Partial<ImdgChapter32Entry> = {}): ImdgChapter32Entry {
  return {
    unNo,
    description: `SUBSTANCE ${unNo}`,
    dgClass: '3',
    packingGroup: 'II',
    subRisk: '',
    fire: 'F-E',
    spillage: 'S-E',
    marinePollutant: false,
    variants: 1,
    ...over,
  };
}

function row(unNo: string, over: Partial<UnNumberReferenceRow> = {}): UnNumberReferenceRow {
  return {
    unNo,
    description: `OLD ${unNo}`,
    dgClass: '3',
    packingGroup: 'II',
    subRisk: '',
    fire: 'F-A',
    spillage: 'S-A',
    marinePollutant: false,
    ...over,
  };
}

describe('DgUnReferenceStore', () => {
  let state: AppStateStore;
  let store: DgUnReferenceStore;

  beforeEach(() => {
    setUnNumberReferenceOverride(null);
    state = TestBed.inject(AppStateStore);
    state.data.set(createEmptyAppData());
    store = TestBed.inject(DgUnReferenceStore);
  });

  it('starts on the bundled list', () => {
    expect(store.isCustom()).toBe(false);
    expect(store.rows().length).toBe(getBundledUnNumberRows().length);
  });

  it('replace mode makes the reference exactly the imported list', () => {
    state.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [row('1111'), row('2222')],
        fileName: 'old.pdf',
        amendment: '',
        updatedAt: '',
      },
    }));

    store.applyImport([entry('2222'), entry('3333')], 'replace', {
      fileName: 'imdg.pdf',
      amendment: 'Amendment 42-24',
    });

    const library = state.data().dgUnReference;
    expect(library.origin).toBe('custom');
    expect(library.entries.map((e) => e.unNo)).toEqual(['2222', '3333']);
    expect(library.fileName).toBe('imdg.pdf');
    expect(library.amendment).toBe('Amendment 42-24');
    expect(library.entries[0].fire).toBe('F-E');
  });

  it('keeps packing-group variants of the same UN on replace', () => {
    store.applyImport(
      [
        entry('3288', { packingGroup: 'I', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
        entry('3288', { packingGroup: 'II', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
        entry('3288', { packingGroup: 'III', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
      ],
      'replace',
      { fileName: 'imdg.pdf', amendment: '' },
    );

    expect(state.data().dgUnReference.entries).toHaveLength(3);
    expect(lookupUnNumberReference('3288', { packingGroup: 'III' })?.packingGroup).toBe('III');
  });

  it('merge mode corrects the same UN+PG+PSN variant but keeps other rows', () => {
    state.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [
          row('1111'),
          row('2222', { description: 'SUBSTANCE 2222', packingGroup: 'II' }),
        ],
        fileName: '',
        amendment: '',
        updatedAt: '',
      },
    }));

    store.applyImport([entry('2222', { description: 'SUBSTANCE 2222', packingGroup: 'II' })], 'merge', {
      fileName: 'imdg.pdf',
      amendment: '',
    });

    const entries = state.data().dgUnReference.entries;
    expect(entries.map((e) => e.unNo)).toEqual(['1111', '2222']);
    expect(entries.find((e) => e.unNo === '1111')?.fire).toBe('F-A');
    expect(entries.find((e) => e.unNo === '2222')?.fire).toBe('F-E');
  });

  it('addOnly mode adds missing list rows and never edits existing ones', () => {
    state.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [row('2222', { description: 'SUBSTANCE 2222', packingGroup: 'II' })],
        fileName: '',
        amendment: '',
        updatedAt: '',
      },
    }));

    store.applyImport(
      [
        entry('2222', { description: 'SUBSTANCE 2222', packingGroup: 'II' }),
        entry('3333'),
      ],
      'addOnly',
      {
        fileName: 'imdg.pdf',
        amendment: '',
      },
    );

    const entries = state.data().dgUnReference.entries;
    expect(entries.map((e) => e.unNo)).toEqual(['2222', '3333']);
    expect(entries.find((e) => e.unNo === '2222')?.fire).toBe('F-A');
  });

  it('importing over the bundled list starts from the bundled entries', () => {
    const bundledCount = getBundledUnNumberRows().length;
    store.applyImport([entry('9999')], 'merge', {
      fileName: 'imdg.pdf',
      amendment: '',
    });

    expect(state.data().dgUnReference.entries.length).toBe(bundledCount + 1);
  });

  it('clearAllEntries empties the reference without falling back to the bundle', () => {
    store.clearAllEntries();

    const library = state.data().dgUnReference;
    expect(library.origin).toBe('custom');
    expect(library.entries).toEqual([]);
    expect(store.rows()).toEqual([]);
  });

  it('restoreBundled goes back to the shipped list', () => {
    store.clearAllEntries();
    store.restoreBundled();

    expect(state.data().dgUnReference.origin).toBe('bundled');
    expect(store.rows().length).toBe(getBundledUnNumberRows().length);
  });

  it('keeps the pure lookup helpers on the imported list', () => {
    store.applyImport(
      [entry('1203', { description: 'RENAMED PETROL', fire: 'F-Z', packingGroup: 'II' })],
      'replace',
      { fileName: 'imdg.pdf', amendment: '' },
    );
    TestBed.tick();

    expect(lookupUnNumberReference('1203')?.fire).toBe('F-Z');
  });
});

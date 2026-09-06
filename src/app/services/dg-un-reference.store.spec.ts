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

    const imported = new Map([
      ['2222', entry('2222')],
      ['3333', entry('3333')],
    ]);
    store.applyImport(imported, 'replace', { fileName: 'imdg.pdf', amendment: 'Amendment 42-24' });

    const library = state.data().dgUnReference;
    expect(library.origin).toBe('custom');
    expect(library.entries.map((e) => e.unNo)).toEqual(['2222', '3333']);
    expect(library.fileName).toBe('imdg.pdf');
    expect(library.amendment).toBe('Amendment 42-24');
    expect(library.entries[0].fire).toBe('F-E');
  });

  it('merge mode corrects matches but keeps entries the import omits', () => {
    state.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [row('1111'), row('2222')],
        fileName: '',
        amendment: '',
        updatedAt: '',
      },
    }));

    store.applyImport(new Map([['2222', entry('2222')]]), 'merge', {
      fileName: 'imdg.pdf',
      amendment: '',
    });

    const entries = state.data().dgUnReference.entries;
    expect(entries.map((e) => e.unNo)).toEqual(['1111', '2222']);
    expect(entries.find((e) => e.unNo === '1111')?.fire).toBe('F-A');
    expect(entries.find((e) => e.unNo === '2222')?.fire).toBe('F-E');
  });

  it('addOnly mode adds missing UN numbers and never edits existing ones', () => {
    state.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [row('2222')],
        fileName: '',
        amendment: '',
        updatedAt: '',
      },
    }));

    const imported = new Map([
      ['2222', entry('2222')],
      ['3333', entry('3333')],
    ]);
    store.applyImport(imported, 'addOnly', { fileName: 'imdg.pdf', amendment: '' });

    const entries = state.data().dgUnReference.entries;
    expect(entries.map((e) => e.unNo)).toEqual(['2222', '3333']);
    expect(entries.find((e) => e.unNo === '2222')?.description).toBe('OLD 2222');
  });

  it('importing over the bundled list starts from the bundled entries', () => {
    const bundledCount = getBundledUnNumberRows().length;
    store.applyImport(new Map([['9999', entry('9999')]]), 'merge', {
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
      new Map([['1203', entry('1203', { description: 'RENAMED PETROL', fire: 'F-Z' })]]),
      'merge',
      { fileName: 'imdg.pdf', amendment: '' },
    );
    TestBed.tick();

    expect(lookupUnNumberReference('1203')?.fire).toBe('F-Z');
  });
});

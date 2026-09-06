import { TestBed } from '@angular/core/testing';
import { FormsStore } from './forms.store';
import { AppStateStore } from './app-state.store';
import { createEmptyAppData } from '../data/empty-app-data';
import { createDefaultShipStoresForm02 } from '../models/ship-stores.models';

describe('FormsStore ship stores copy', () => {
  let store: FormsStore;
  let state: AppStateStore;

  beforeEach(() => {
    state = TestBed.inject(AppStateStore);
    state.data.set(createEmptyAppData());
    store = TestBed.inject(FormsStore);
  });

  it('copyShipStoresForm writes overlapping rows and clears target overlay cells', () => {
    const long = createDefaultShipStoresForm02();
    long.placeOfStorage = 'Provision';
    long.rows[0] = { name: 'Coffee', quantity: '5', unit: 'kg' };
    long.rows[30] = { name: 'Overflow', quantity: '1', unit: 'pcs' };
    state.data.update((d) => ({
      ...d,
      shipStoresForm02: long,
      documentOverlay: {
        ...d.documentOverlay,
        shipStores: {
          ...d.documentOverlay.shipStores,
          cellValues: { 'd-0-0': 'Stale', 'h-storage': 'Stale place', _ssMode: 'departure' },
        },
      },
    }));

    const stats = store.copyShipStoresForm('shipStores02', 'shipStores');
    expect(stats).toEqual({
      from: 'shipStores02',
      to: 'shipStores',
      transferred: 1,
      didNotFit: 1,
    });

    const data = state.data();
    expect(data.shipStoresForm.placeOfStorage).toBe('Provision');
    expect(data.shipStoresForm.rows[0]).toEqual({
      name: 'Coffee',
      quantity: '5',
      unit: 'kg',
    });
    expect(data.documentOverlay.shipStores.cellValues?.['d-0-0']).toBeUndefined();
    expect(data.documentOverlay.shipStores.cellValues?.['h-storage']).toBeUndefined();
    expect(data.documentOverlay.shipStores.cellValues?.['_ssMode']).toBe('departure');
  });

  it('copyShipStoresForm returns null when from === to', () => {
    expect(store.copyShipStoresForm('shipStores', 'shipStores')).toBeNull();
  });
});

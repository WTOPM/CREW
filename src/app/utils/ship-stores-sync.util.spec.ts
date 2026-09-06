import {
  createDefaultShipStoresForm,
  createDefaultShipStoresForm02,
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
} from '../models/ship-stores.models';
import { createEmptyAppData } from '../data/empty-app-data';
import {
  buildShipStoresCopy,
  formatShipStoresCopyToast,
  readEffectiveShipStoresForm,
  shipStoresRowHasContent,
} from './ship-stores-sync.util';

describe('ship-stores-sync.util', () => {
  it('shipStoresRowHasContent detects any filled field', () => {
    expect(shipStoresRowHasContent({ name: '', quantity: '', unit: '' })).toBe(false);
    expect(shipStoresRowHasContent({ name: 'Tea', quantity: '', unit: '' })).toBe(true);
    expect(shipStoresRowHasContent({ name: '', quantity: '1', unit: '' })).toBe(true);
  });

  it('copies overlapping rows and reports overflow articles', () => {
    const source = createDefaultShipStoresForm02();
    source.placeOfStorage = 'Bonded store';
    source.rows[0] = { name: 'Beer', quantity: '10', unit: 'ctn' };
    source.rows[26] = { name: 'Wine', quantity: '2', unit: 'btl' };
    source.rows[27] = { name: 'Extra', quantity: '1', unit: 'pcs' };
    source.rows[40] = { name: 'Far', quantity: '3', unit: 'kg' };

    const built = buildShipStoresCopy(source, 'shipStores02', 'shipStores', {
      'd-0-0': 'OLD',
      'h-storage': 'Old place',
      '_ssMode': 'arrival',
    });

    expect(built.form.placeOfStorage).toBe('Bonded store');
    expect(built.form.rows).toHaveLength(SHIP_STORES_ROW_COUNT);
    expect(built.form.rows[0]).toEqual({ name: 'Beer', quantity: '10', unit: 'ctn' });
    expect(built.form.rows[26]).toEqual({ name: 'Wine', quantity: '2', unit: 'btl' });
    expect(built.stats.transferred).toBe(2);
    expect(built.stats.didNotFit).toBe(2);
    expect(built.cellValues['d-0-0']).toBeUndefined();
    expect(built.cellValues['h-storage']).toBeUndefined();
    expect(built.cellValues['_ssMode']).toBe('arrival');
    expect(formatShipStoresCopyToast(built.stats)).toContain('2 articles');
    expect(formatShipStoresCopyToast(built.stats)).toContain('2 did not fit');
  });

  it('pads when copying into a longer form', () => {
    const source = createDefaultShipStoresForm(SHIP_STORES_03_ROW_COUNT);
    source.rows[0] = { name: 'Salt', quantity: '1', unit: 'kg' };
    const built = buildShipStoresCopy(source, 'shipStores03', 'shipStores02', undefined);
    expect(built.form.rows).toHaveLength(SHIP_STORES_02_ROW_COUNT);
    expect(built.form.rows[0].name).toBe('Salt');
    expect(built.form.rows[18].name).toBe('');
    expect(built.stats.transferred).toBe(1);
    expect(built.stats.didNotFit).toBe(0);
  });

  it('readEffectiveShipStoresForm prefers overlay article cells', () => {
    const data = createEmptyAppData();
    data.shipStoresForm = createDefaultShipStoresForm();
    data.shipStoresForm.rows[0] = { name: 'FromForm', quantity: '1', unit: 'pcs' };
    data.documentOverlay.shipStores.cellValues = {
      'd-0-0': 'FromOverlay',
      'd-0-1': '9',
      'h-storage': 'Deck locker',
    };
    const effective = readEffectiveShipStoresForm(data, 'shipStores');
    expect(effective.rows[0]).toEqual({
      name: 'FromOverlay',
      quantity: '9',
      unit: 'pcs',
    });
    expect(effective.placeOfStorage).toBe('Deck locker');
  });
});

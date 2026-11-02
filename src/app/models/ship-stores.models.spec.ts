import { describe, expect, it } from 'vitest';
import {
  createEmptyShipStoresRow,
  evaluateShipStoresQtyFactors,
  formatShipStoresQtyProduct,
  normalizeShipStoresForm,
  normalizeShipStoresQtyFactors,
  parseShipStoresQtyFactor,
} from './ship-stores.models';

describe('ship-stores qty calculator', () => {
  it('parses decimal factors with comma', () => {
    expect(parseShipStoresQtyFactor('0,33')).toBeCloseTo(0.33);
    expect(parseShipStoresQtyFactor('10')).toBe(10);
    expect(parseShipStoresQtyFactor('')).toBeNull();
  });

  it('formats product without float junk', () => {
    expect(formatShipStoresQtyProduct(10 * 24 * 0.33)).toBe('79.2');
    expect(formatShipStoresQtyProduct(10 * 200)).toBe('2000');
    expect(formatShipStoresQtyProduct(0)).toBe('0');
  });

  it('evaluates cigarettes / beer style products', () => {
    expect(evaluateShipStoresQtyFactors(['10', '200'])).toBe('2000');
    expect(evaluateShipStoresQtyFactors(['8', '200'])).toBe('1600');
    expect(evaluateShipStoresQtyFactors(['10', '24', '0.33'])).toBe('79.2');
    expect(evaluateShipStoresQtyFactors(['10', '24', '0,33'])).toBe('79.2');
  });

  it('needs at least two factors', () => {
    expect(evaluateShipStoresQtyFactors(['10'])).toBeNull();
    expect(evaluateShipStoresQtyFactors(['10', ''])).toBeNull();
    expect(evaluateShipStoresQtyFactors([])).toBeNull();
  });

  it('normalize keeps factors additively on rows', () => {
    const form = normalizeShipStoresForm({
      rows: [
        {
          name: 'Beer',
          quantity: '79.2',
          unit: 'Ltrs',
          qtyFactors: ['10', '24', '0.33', '', 'x'],
        },
      ],
    });
    expect(form.rows[0]!.qtyFactors).toEqual(['10', '24', '0.33']);
    expect(createEmptyShipStoresRow().qtyFactors).toEqual([]);
    expect(normalizeShipStoresQtyFactors(undefined)).toEqual([]);
  });
});

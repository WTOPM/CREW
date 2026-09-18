import {
  airdraftHeightAboveWaterMetres,
  formatAirdraftMetres,
  normalizeShipMetresInput,
  parseAirdraftMetres,
  shipPresentDraftMetres,
} from './airdraft-field-positions';

describe('airdraft metres helpers', () => {
  it('parses comma and dot metres', () => {
    expect(parseAirdraftMetres('9.2')).toBe(9.2);
    expect(parseAirdraftMetres('37,5')).toBe(37.5);
    expect(parseAirdraftMetres('')).toBeNull();
  });

  it('computes height above water as keel–mast minus draft', () => {
    expect(airdraftHeightAboveWaterMetres('37.5', '9.2')).toBeCloseTo(28.3);
    expect(airdraftHeightAboveWaterMetres('37.5', '')).toBeNull();
    expect(formatAirdraftMetres(28.3)).toBe('28.3');
  });

  it('takes the greater of draft fore / aft as present draft', () => {
    expect(shipPresentDraftMetres('9.2', '9.5')).toBe('9.5');
    expect(shipPresentDraftMetres('9.2', '')).toBe('9.2');
    expect(shipPresentDraftMetres('', '8.0')).toBe('8.0');
    expect(shipPresentDraftMetres('', '')).toBe('');
  });

  it('normalizes confirm display to one decimal with a dot', () => {
    expect(normalizeShipMetresInput('1,1')).toBe('1.1');
    expect(normalizeShipMetresInput('46.7')).toBe('46.7');
    expect(normalizeShipMetresInput('9')).toBe('9.0');
    expect(normalizeShipMetresInput('')).toBe('');
    expect(normalizeShipMetresInput('abc')).toBeNull();
  });
});

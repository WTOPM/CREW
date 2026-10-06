import { describe, expect, it } from 'vitest';
import {
  decimalToEtaGpsDmsDraft,
  etaGpsDmsDraftToDecimal,
  formatEtaGpsShort,
  isEtaGpsDmsPartComplete,
  isValidEtaGpsCoords,
  normalizeEtaGpsCoords,
  sanitizeEtaGpsDmsPart,
  stepEtaGpsDmsPart,
  tryBuildEtaGpsCoordsFromDms,
} from './eta-gps.util';

describe('eta-gps.util', () => {
  it('accepts valid WGS84 ranges', () => {
    expect(isValidEtaGpsCoords({ lat: 54.35, lon: 18.65 })).toBe(true);
    expect(isValidEtaGpsCoords({ lat: -90, lon: 180 })).toBe(true);
    expect(isValidEtaGpsCoords({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidEtaGpsCoords({ lat: 0, lon: -181 })).toBe(false);
  });

  it('normalizes persisted objects and drops junk', () => {
    expect(normalizeEtaGpsCoords({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 });
    expect(normalizeEtaGpsCoords({ lat: '54,5', lon: '18.6' })).toEqual({ lat: 54.5, lon: 18.6 });
    expect(normalizeEtaGpsCoords({ lat: 999, lon: 0 })).toBeNull();
    expect(normalizeEtaGpsCoords(null)).toBeNull();
  });

  it('accepts split DDM 53° 52 . 70 N / 007° 52 . 66 E', () => {
    const built = tryBuildEtaGpsCoordsFromDms(
      { deg: '53', min: '52', sec: '70', hemi: 'N' },
      { deg: '007', min: '52', sec: '66', hemi: 'E' },
    );
    expect(built).not.toBeNull();
    expect(built!.lat).toBeCloseTo(53 + 52.7 / 60, 6);
    expect(built!.lon).toBeCloseTo(7 + 52.66 / 60, 6);
  });

  it('rejects hundredths >= 100 and minutes >= 60', () => {
    expect(
      etaGpsDmsDraftToDecimal({ deg: '53', min: '52', sec: '100', hemi: 'N' }, 'lat'),
    ).toBeNull();
    expect(
      etaGpsDmsDraftToDecimal({ deg: '53', min: '60', sec: '00', hemi: 'N' }, 'lat'),
    ).toBeNull();
  });

  it('auto-advances after two minute digits', () => {
    expect(isEtaGpsDmsPartComplete('52', 'min', 'lat')).toBe(true);
    expect(isEtaGpsDmsPartComplete('5', 'min', 'lat')).toBe(false);
    expect(sanitizeEtaGpsDmsPart('52.70', 'min', 'lat')).toBe('52');
  });

  it('round-trips editor drafts as whole min + hundredths', () => {
    const lat = decimalToEtaGpsDmsDraft(53 + 52.7 / 60, 'lat');
    const lon = decimalToEtaGpsDmsDraft(7 + 52.66 / 60, 'lon');
    expect(lat).toMatchObject({ deg: '53', min: '52', sec: '70', hemi: 'N' });
    expect(lon).toMatchObject({ deg: '007', min: '52', sec: '66', hemi: 'E' });
  });

  it('pads longitude degrees to three digits', () => {
    expect(decimalToEtaGpsDmsDraft(null, 'lon').deg).toBe('000');
    expect(decimalToEtaGpsDmsDraft(5, 'lon').deg).toBe('005');
  });

  it('steps longitude degrees with wrap past 180', () => {
    const next = stepEtaGpsDmsPart(
      { deg: '180', min: '00', sec: '00', hemi: 'E' },
      'deg',
      'lon',
      1,
    );
    expect(next.deg).toBe('000');
  });

  it('steps hundredths with wrap past 99', () => {
    const next = stepEtaGpsDmsPart(
      { deg: '53', min: '52', sec: '99', hemi: 'N' },
      'sec',
      'lat',
      1,
    );
    expect(next.sec).toBe('00');
  });

  it('applies S/W signs', () => {
    expect(etaGpsDmsDraftToDecimal({ deg: '10', min: '0', sec: '0', hemi: 'S' }, 'lat')).toBe(-10);
    expect(
      etaGpsDmsDraftToDecimal({ deg: '20', min: '30', sec: '00', hemi: 'W' }, 'lon'),
    ).toBeCloseTo(-(20 + 0.5), 6);
  });

  it('formats a short DDM display line', () => {
    const text = formatEtaGpsShort({
      lat: 53 + 52.7 / 60,
      lon: 7 + 52.66 / 60,
    });
    expect(text).toContain('53°52.70′ N');
    expect(text).toContain('007°52.66′ E');
  });
});

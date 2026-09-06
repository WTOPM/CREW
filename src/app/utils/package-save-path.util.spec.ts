import {
  fileNameWithCopyCount,
  joinOutputDir,
  sanitizePathSegment,
} from './package-save-path.util';

describe('package-save-path.util', () => {
  it('sanitizes authority folder names', () => {
    expect(sanitizePathSegment('Immigration / Police')).toBe('Immigration _ Police');
    expect(sanitizePathSegment('  ')).toBe('Authority');
  });

  it('joins output dirs', () => {
    expect(joinOutputDir('C:\\CREW\\out', 'Customs')).toBe('C:\\CREW\\out\\Customs');
    expect(joinOutputDir('/tmp/out', 'Customs')).toBe('/tmp/out/Customs');
  });

  it('appends copy count before .pdf', () => {
    expect(fileNameWithCopyCount('MDH_ship.pdf', 2)).toBe('MDH_ship_x2.pdf');
    expect(fileNameWithCopyCount('Airdraft.pdf', 1)).toBe('Airdraft_x1.pdf');
  });
});

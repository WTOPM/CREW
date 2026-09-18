import { describe, expect, it } from 'vitest';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import {
  isUnifeederDagosPositionsPdf,
  parseUnifeederDagosPositions,
} from './dg-unifeeder-dagos-pdf.util';

function item(str: string, x: number, y: number, page: number): DgPdfTextItem {
  return { str, x, y, page };
}

/** Minimal recreation of IMDG list.pdf (MACS3 Dagos on Board). */
function dagosFixture(): DgPdfTextItem[] {
  return [
    item('seacos MACS3 by Navis v. NET 1.1', 42.5, 40.2, 1),
    item('Dagos on Board (IMDG-Code Amendment 42) - Dangerous goods, All items', 42.5, 78.8, 1),
    item('Pos.', 43.7, 89.9, 1),
    item('Serial Number', 77.2, 89.9, 1),
    item('POL', 142.8, 89.9, 1),
    item('POD', 175.6, 89.9, 1),
    item('UN', 208.4, 89.9, 1),
    // Row 1
    item('071082', 43.7, 97.8, 1),
    item('BGBU4706312', 77.2, 97.8, 1),
    item('DEEGH', 142.8, 97.8, 1),
    item('FIHEL', 175.6, 97.8, 1),
    item('1593', 208.4, 97.8, 1),
    item('DICHLOROMETHANE', 235.7, 97.8, 1),
    // Row 2 + wrapped shipping name (must not create a fake row)
    item('090284', 43.7, 105.7, 1),
    item('MRKU9861852', 77.2, 105.7, 1),
    item('DENTB', 142.8, 105.7, 1),
    item('FIHEL', 175.6, 105.7, 1),
    item('3480', 208.4, 105.7, 1),
    item('LITHIUM ION BATTERIES (including lithium ion', 235.7, 105.7, 1),
    item('polymer batteries)', 235.7, 111.3, 1),
    // Page 2 overwrites BGBU position (multi-page final wins)
    item('Dagos on Board (IMDG-Code Amendment 42) - Dangerous goods, All items', 42.5, 78.8, 2),
    item('Pos.', 43.7, 89.9, 2),
    item('Serial Number', 77.2, 89.9, 2),
    item('071099', 43.7, 97.8, 2),
    item('BGBU4706312', 77.2, 97.8, 2),
    item('110404', 43.7, 105.7, 2),
    item('HASU1202445', 77.2, 105.7, 2),
  ];
}

describe('dg-unifeeder-dagos-pdf', () => {
  it('detects Dagos on Board and rejects cargo manifests', () => {
    expect(isUnifeederDagosPositionsPdf(dagosFixture())).toBe(true);
    expect(
      isUnifeederDagosPositionsPdf([
        item('Dangerous Cargo Manifest', 40, 40, 1),
        item('Dagos on Board', 40, 60, 1),
        item('Pos.', 40, 80, 1),
        item('Serial Number', 80, 80, 1),
      ]),
    ).toBe(false);
  });

  it('parses Pos + Serial Number and lets later pages overwrite', () => {
    const rows = parseUnifeederDagosPositions(dagosFixture());
    expect(rows).toEqual([
      { containerNo: 'BGBU4706312', position: '071099' },
      { containerNo: 'HASU1202445', position: '110404' },
      { containerNo: 'MRKU9861852', position: '090284' },
    ]);
  });

  it('parses Serial Number column when MACS3 places it near x71', () => {
    // Real “Dagos positions.pdf” layout: Serial header/value at x≈71.3 (was missed when col started at 72).
    const items: DgPdfTextItem[] = [
      item('Dagos on Board (IMDG-Code Amendment 42) - Dangerous goods, All items', 42.5, 78.8, 1),
      item('Pos.', 43.7, 89.9, 1),
      item('Serial Number', 71.3, 89.9, 1),
      item('030182', 43.7, 98, 1),
      item('TRHU1197969', 71.3, 98, 1),
      item('030184', 43.7, 106, 1),
      item('SDDU2029252', 71.3, 106, 1),
      // Continuation line without Pos — must not invent a row
      item('CBHU4315076', 71.3, 122, 1),
    ];
    expect(isUnifeederDagosPositionsPdf(items)).toBe(true);
    expect(parseUnifeederDagosPositions(items)).toEqual([
      { containerNo: 'SDDU2029252', position: '030184' },
      { containerNo: 'TRHU1197969', position: '030182' },
    ]);
  });
});

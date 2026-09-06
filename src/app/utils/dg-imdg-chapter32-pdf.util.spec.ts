import { describe, expect, it } from 'vitest';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import {
  collapseImdgRows,
  ImdgChapter32ParseError,
  isImdgChapter32Pdf,
  parseImdgChapter32,
} from './dg-imdg-chapter32-pdf.util';

/** Column marker x positions measured from the real IMDG Code chapter 3.2 PDF. */
const MARKER_X: Record<string, number> = {
  '(1)': 50,
  '(2)': 124,
  '(3)': 200,
  '(4)': 233,
  '(5)': 268,
  '(6)': 304,
  '(7a)': 339,
  '(7b)': 376,
  '(8)': 416,
  '(9)': 454,
  '(10)': 491,
  '(11)': 529,
  '(12)': 641,
  '(13)': 669,
  '(14)': 707,
  '(15)': 746,
  '(16a)': 792,
  '(16b)': 849,
  '(17)': 999,
  '(18)': 1131,
};

const MARKER_Y = 139;

function markerRow(page: number): DgPdfTextItem[] {
  return Object.entries(MARKER_X).map(([str, x]) => ({ str, x, y: MARKER_Y, page }));
}

function item(str: string, x: number, y: number, page = 1): DgPdfTextItem {
  return { str, x, y, page };
}

describe('parseImdgChapter32', () => {
  it('reads UN number, name, class, packing group and EmS codes from a list row', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('0004', 45, 170),
      item('AMMONIUM PICRATE dry or', 67, 170),
      item('wetted with less than 10% water,', 67, 179),
      item('1.1D', 197, 170),
      item('–', 235, 170),
      item('–', 270, 170),
      item('F-B, S-Y', 737, 170),
      item('0004', 1128, 170),
    ];

    const result = parseImdgChapter32(items);

    expect(result.tablePages).toEqual([1]);
    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      unNo: '0004',
      description: 'AMMONIUM PICRATE dry or wetted with less than 10% water,',
      dgClass: '1.1D',
      dgClassBase: '1',
      subRisk: '',
      packingGroup: '',
      fire: 'F-B',
      spillage: 'S-Y',
      marinePollutant: false,
    });
  });

  it('splits a UN number that pdf.js merged into the shipping name item', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('1830 SULPHURIC ACID with more than', 46, 736),
      item('51% acid', 67, 745),
      item('8', 202, 736),
      item('II', 270, 736),
      item('F-A, S-B', 736, 736),
    ];

    const [row] = parseImdgChapter32(items).rows;

    expect(row.unNo).toBe('1830');
    expect(row.description).toBe('SULPHURIC ACID with more than 51% acid');
    expect(row.dgClass).toBe('8');
    expect(row.packingGroup).toBe('II');
    expect(row.fire).toBe('F-A');
    expect(row.spillage).toBe('S-B');
  });

  it('keeps italic shipping-name tails out of the class column', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('2512', 45, 398),
      item('AMINOPHENOLS (', 67, 398),
      item('o', 133, 398),
      item('-,', 138, 398),
      item('p', 159, 398),
      item('-)', 163, 398),
      item('6.1', 199, 398),
      item('III', 269, 398),
      item('F-A, S-A', 736, 398),
    ];

    const [row] = parseImdgChapter32(items).rows;

    expect(row.dgClass).toBe('6.1');
    expect(row.description).toContain('-)');
    expect(row.packingGroup).toBe('III');
  });

  it('reads the marine-pollutant P out of the subsidiary hazard column', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('0076', 45, 200),
      item('DINITROPHENOL', 67, 200),
      item('1.1D', 197, 200),
      item('6.1', 231, 200),
      item('P', 243, 200),
      item('F-B, S-Z', 737, 200),
    ];

    const [row] = parseImdgChapter32(items).rows;

    expect(row.subRisk).toBe('6.1');
    expect(row.marinePollutant).toBe(true);
  });

  it('leaves fire and spillage empty for entries whose EmS cell is a dash', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('1512', 45, 353),
      item('ZINC AMMONIUM NITRITE', 67, 353),
      item('5.1', 199, 353),
      item('–', 749, 353),
      item('Transport is prohibited', 886, 353),
    ];

    const [row] = parseImdgChapter32(items).rows;

    expect(row.fire).toBe('');
    expect(row.spillage).toBe('');
  });

  it('skips pages before the list and only scans pages carrying the column row', () => {
    const items: DgPdfTextItem[] = [
      item('Chapter 3.2', 141, 141, 1),
      item('3.2.1 Structure of the Dangerous Goods List', 42, 234, 1),
      item('Column 1 UN No. – this column contains', 42, 273, 1),
      item('Dangerous Goods List', 231, 324, 2),
      ...markerRow(3),
      item('0004', 45, 170, 3),
      item('AMMONIUM PICRATE', 67, 170, 3),
      item('1.1D', 197, 170, 3),
      item('F-B, S-Y', 737, 170, 3),
    ];

    const result = parseImdgChapter32(items);

    expect(result.skippedLeadingPages).toBe(2);
    expect(result.tablePages).toEqual([3]);
    expect(result.rows.map((row) => row.unNo)).toEqual(['0004']);
  });

  it('ignores page headers, footers and the DGL thumb tabs', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('Part 3 – Dangerous Goods List, special provisions and exceptions', 42, 57),
      item('D', 5, 232),
      item('L', 1169, 296),
      item('0004', 45, 170),
      item('AMMONIUM PICRATE', 67, 170),
      item('1.1D', 197, 170),
      item('F-B, S-Y', 737, 170),
      item('26', 42, 811),
      item('IMDG Code (Amendment 42-24)', 336, 811),
    ];

    const result = parseImdgChapter32(items);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe('AMMONIUM PICRATE');
  });

  it('rejects a PDF that has no Dangerous Goods List grid', () => {
    const items: DgPdfTextItem[] = [
      item('DANGEROUS CARGO MANIFEST', 100, 100, 1),
      item('Some other shipping document', 100, 140, 1),
    ];

    expect(isImdgChapter32Pdf(items)).toBe(false);
    expect(() => parseImdgChapter32(items)).toThrow(ImdgChapter32ParseError);
  });

  it('rejects a PDF with no extractable text', () => {
    expect(() => parseImdgChapter32([])).toThrow(ImdgChapter32ParseError);
  });
});

describe('collapseImdgRows', () => {
  it('merges packing-group variants of one UN number and counts them', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('1263', 45, 200),
      item('PAINT', 67, 200),
      item('3', 202, 200),
      item('I', 271, 200),
      item('F-E, S-E', 737, 200),
      item('1263', 45, 260),
      item('PAINT', 67, 260),
      item('3', 202, 260),
      item('II', 270, 260),
      item('F-E, S-E', 737, 260),
    ];

    const entries = collapseImdgRows(parseImdgChapter32(items).rows);

    expect(entries.size).toBe(1);
    expect(entries.get('1263')).toMatchObject({
      unNo: '1263',
      dgClass: '3',
      packingGroup: 'I',
      fire: 'F-E',
      spillage: 'S-E',
      variants: 2,
    });
  });

  it('fills missing fields of the first variant from later ones', () => {
    const items: DgPdfTextItem[] = [
      ...markerRow(1),
      item('3082', 45, 200),
      item('ENVIRONMENTALLY HAZARDOUS SUBSTANCE', 67, 200),
      item('9', 202, 200),
      item('–', 749, 200),
      item('3082', 45, 260),
      item('ENVIRONMENTALLY HAZARDOUS SUBSTANCE', 67, 260),
      item('9', 202, 260),
      item('III', 269, 260),
      item('F-A, S-F', 737, 260),
    ];

    const entry = collapseImdgRows(parseImdgChapter32(items).rows).get('3082');

    expect(entry).toMatchObject({ packingGroup: 'III', fire: 'F-A', spillage: 'S-F', variants: 2 });
  });
});

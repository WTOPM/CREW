import { describe, expect, it } from 'vitest';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import {
  pageRefsFromIndexStarts,
  parseEmsSchedulePdf,
} from './dg-ems-schedule-pdf.util';

function item(str: string, x: number, y: number, page = 1): DgPdfTextItem {
  return { str, x, y, page };
}

describe('pageRefsFromIndexStarts', () => {
  it('builds ranges until the next schedule start', () => {
    const rows = pageRefsFromIndexStarts([
      { code: 'F-E', startPage: 27 },
      { code: 'F-F', startPage: 28 },
      { code: 'F-G', startPage: 30 },
    ]);
    expect(rows).toEqual([
      { code: 'F-E', pageRef: 'p.27' },
      { code: 'F-F', pageRef: 'p.28-29' },
      { code: 'F-G', pageRef: 'p.30' },
    ]);
  });
});

describe('parseEmsSchedulePdf', () => {
  it('reads FIRE index with en-dash codes', () => {
    const items: DgPdfTextItem[] = [
      item('Introduction', 50, 100, 1),
      item('Emergency schedules for FIRE', 54, 96, 2),
      item('F–A', 54, 144, 2),
      item('................................................................ 23', 77, 144, 2),
      item('F–B', 54, 162, 2),
      item('24', 526, 162, 2),
      item('F–F', 54, 236, 2),
      item('28', 526, 236, 2),
      item('F–G', 54, 252, 2),
      item('30', 526, 252, 2),
    ];
    const result = parseEmsSchedulePdf(items);
    expect(result.kind).toBe('fire');
    expect(result.indexPage).toBe(2);
    expect(result.rows.find((r) => r.code === 'F-A')?.pageRef).toBe('p.23');
    expect(result.rows.find((r) => r.code === 'F-F')?.pageRef).toBe('p.28-29');
  });

  it('reads SPILLAGE index including codes glued to leader dots', () => {
    const items: DgPdfTextItem[] = [
      item('Emergency schedules for SPILLAGE', 52, 96, 1),
      item('S–A', 52, 144, 1),
      item('47', 527, 144, 1),
      item('S–C ........................................................................', 52, 180, 1),
      item('49', 527, 180, 1),
      item('S–D', 52, 198, 1),
      item('50', 527, 198, 1),
      item('S–S', 52, 468, 1),
      item('65', 527, 468, 1),
      item('S–T', 52, 486, 1),
      item('67', 527, 486, 1),
      item('S–U', 52, 504, 1),
      item('68', 527, 504, 1),
      item('S–V', 52, 522, 1),
      item('70', 527, 522, 1),
      item('S–W ........................................................................', 52, 540, 1),
      item('71', 526, 540, 1),
    ];
    const result = parseEmsSchedulePdf(items);
    expect(result.kind).toBe('spillage');
    expect(result.rows.find((r) => r.code === 'S-C')?.pageRef).toBe('p.49');
    expect(result.rows.find((r) => r.code === 'S-S')?.pageRef).toBe('p.65-66');
    expect(result.rows.find((r) => r.code === 'S-U')?.pageRef).toBe('p.68-69');
    expect(result.rows.find((r) => r.code === 'S-W')?.pageRef).toBe('p.71');
  });
});

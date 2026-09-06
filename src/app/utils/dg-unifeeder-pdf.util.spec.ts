import { describe, expect, it } from 'vitest';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import { parseUnifeederDangerousCargoManifest } from './dg-unifeeder-pdf.util';
import { validateUnifeederImportAgainstSummary } from './dg-unifeeder-pdf-summary.util';

function item(str: string, x: number, y: number, page: number): DgPdfTextItem {
  return { str, x, y, page };
}

/**
 * Minimal recreation of the page-break bug:
 * page 1 ends with a trailing container header (no IMO body);
 * page 2 starts with that container's IMO/cargo column and no container number.
 */
function pageBreakFixture(): DgPdfTextItem[] {
  const page1: DgPdfTextItem[] = [
    item('Dangerous Cargo Manifest', 40, 40, 1),
    // Completed column for EURU1174007
    item('4.620,00', 487, 176, 1),
    item('Gweight', 472, 177, 1),
    item('1,00', 487, 125, 1),
    item('Nweight', 472, 133, 1),
    item('S-J', 487, 251, 1),
    item('F-A', 487, 286, 1),
    item('290382', 447, 313, 1),
    item('Stowage position', 447, 375, 1),
    item('I', 487, 371, 1),
    item('1381', 487, 469, 1),
    item('YES', 522, 470, 1),
    item('PHOSPHORUS, WHITE, DRY', 501, 466, 1),
    item('6.1 / / /', 411, 466, 1),
    item('4.2', 487, 514, 1),
    item('EURU 117400-7', 435, 505, 1),
    item('22TN', 435, 532, 1),
    item('IMO Information', 459, 532, 1),
    // Orphan header only — cargo continues on page 2
    item('EURU 127263-6', 570, 505, 1),
    item('22TN', 570, 532, 1),
  ];

  const page2: DgPdfTextItem[] = [
    item('Dangerous Cargo Manifest', 40, 40, 2),
    // Continuation body for EURU1272636 (no container number on this page)
    item('4.580,00', 70, 176, 2),
    item('Gweight', 55, 177, 2),
    item('1,00', 70, 125, 2),
    item('Nweight', 55, 133, 2),
    item('20,0 C', 70, 71, 2),
    item('Flashpoint', 55, 83, 2),
    item('S-J', 70, 251, 2),
    item('F-A', 70, 286, 2),
    item('310682', 30, 313, 2),
    item('Stowage position', 30, 375, 2),
    item('I', 70, 371, 2),
    item('1381', 70, 469, 2),
    item('YES', 105, 470, 2),
    item('PHOSPHORUS, WHITE, DRY', 84, 466, 2),
    item('6.1 / / /', 129, 466, 2),
    item('4.2', 70, 514, 2),
    item('IMO Information', 42, 532, 2),
    item('Proper ship. name:', 84, 532, 2),
    // Next complete column so the page looks like a normal 4-up sheet
    item('EURU 167387-6', 153, 505, 2),
    item('22TN', 153, 532, 2),
    item('IMO Information', 177, 532, 2),
    item('4.445,00', 205, 176, 2),
    item('Gweight', 190, 177, 2),
    item('1,00', 205, 125, 2),
    item('Nweight', 190, 133, 2),
    item('S-J', 205, 251, 2),
    item('F-A', 205, 286, 2),
    item('290884', 165, 313, 2),
    item('Stowage position', 165, 375, 2),
    item('I', 205, 371, 2),
    item('1381', 205, 469, 2),
    item('YES', 240, 470, 2),
    item('PHOSPHORUS, WHITE, DRY', 219, 466, 2),
    item('6.1 / / /', 264, 466, 2),
    item('4.2', 205, 514, 2),
  ];

  return [...page1, ...page2];
}

describe('parseUnifeederDangerousCargoManifest page-break orphan header', () => {
  it('keeps a trailing container header and binds the next page body to it', () => {
    const result = parseUnifeederDangerousCargoManifest(pageBreakFixture(), {});

    const byContainer = new Map<string, typeof result.rows>();
    for (const row of result.rows) {
      const list = byContainer.get(row.containerNo) ?? [];
      list.push(row);
      byContainer.set(row.containerNo, list);
    }

    expect(byContainer.get('EURU1174007')).toHaveLength(1);
    expect(byContainer.get('EURU1174007')![0]).toMatchObject({
      weightKg: '4620',
      stow: '290382',
    });

    expect(byContainer.get('EURU1272636')).toHaveLength(1);
    expect(byContainer.get('EURU1272636')![0]).toMatchObject({
      weightKg: '4580',
      stow: '310682',
      size: '22TN',
      unNo: '1381',
    });

    expect(byContainer.has('EURU1673876')).toBe(true);
  });
});

describe('validateUnifeederImportAgainstSummary', () => {
  it('reports container count mismatches instead of silently accepting off-by-one', () => {
    const rows = [
      {
        containerNo: 'AAAA1111111',
        size: '22TN',
        weightKg: '1000',
        grossWeightKg: '1000',
        netWeightKg: '1',
      },
    ];
    const summary = {
      containerCountsByLength: { '20': 2, '30': 0, '40': 0, '45': 0 },
      totalContainers: 2,
      totalImoNetWeightKg: 1,
      totalImoGrossWeightKg: 1000,
    };

    const validation = validateUnifeederImportAgainstSummary(rows, summary, {
      useGrossWeight: true,
      extractableContainers: 2,
    });

    expect(validation.ok).toBe(false);
    expect(validation.mismatches.some((m) => m.includes('containers:'))).toBe(true);
  });
});

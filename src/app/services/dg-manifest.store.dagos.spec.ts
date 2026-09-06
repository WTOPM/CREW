import { TestBed } from '@angular/core/testing';
import { AppStateStore } from './app-state.store';
import { DgManifestStore } from './dg-manifest.store';
import { createEmptyAppData } from '../data/empty-app-data';
import { createDgUnifeederRow } from '../models/dg-unifeeder.models';
import { normalizeDgLibrary } from '../models/dg-manifest.models';

describe('DgManifestStore.applyUnifeederDagosPositions', () => {
  let store: DgManifestStore;
  let state: AppStateStore;

  beforeEach(() => {
    state = TestBed.inject(AppStateStore);
    state.data.set(createEmptyAppData());
    store = TestBed.inject(DgManifestStore);
  });

  function seedOnboard(
    rows: { containerNo: string; stow: string; status?: 'onboard' | 'discharged' }[],
  ): void {
    const empty = createEmptyAppData();
    const dgLibrary = normalizeDgLibrary(empty.dgLibrary);
    state.data.set({
      ...empty,
      dgLibrary: {
        ...dgLibrary,
        unifeeder: {
          ...dgLibrary.unifeeder,
          onboard: rows.map((r) =>
            createDgUnifeederRow({
              containerNo: r.containerNo,
              stow: r.stow,
              status: r.status ?? 'onboard',
            }),
          ),
        },
      },
    });
  }

  it('overwrites stow on matching onboard rows and skips equals / discharged', () => {
    seedOnboard([
      { containerNo: 'BGBU4706312', stow: '000000' },
      { containerNo: 'BGBU4706312', stow: '000000' }, // second line same ctr
      { containerNo: 'MRKU9861852', stow: '090284' }, // already final
      { containerNo: 'HASU1202445', stow: '111111', status: 'discharged' },
    ]);

    const result = store.applyUnifeederDagosPositions([
      { containerNo: 'BGBU4706312', position: '071082' },
      { containerNo: 'MRKU9861852', position: '090284' },
      { containerNo: 'HASU1202445', position: '110404' },
      { containerNo: 'ZZZZ1234567', position: '999999' },
    ]);

    expect(result.updatedLines).toBe(2);
    expect(result.checked).toBe(2);
    expect(result.replaced).toBe(1);
    expect(result.unmatched).toEqual(['HASU1202445', 'ZZZZ1234567']);

    const onboard = state.data().dgLibrary.unifeeder.onboard;
    expect(onboard.filter((r) => r.containerNo === 'BGBU4706312').map((r) => r.stow)).toEqual([
      '071082',
      '071082',
    ]);
    expect(onboard.find((r) => r.containerNo === 'MRKU9861852')?.stow).toBe('090284');
    expect(onboard.find((r) => r.containerNo === 'HASU1202445')?.stow).toBe('111111');
  });
});

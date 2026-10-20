import { describe, expect, it } from 'vitest';
import { createDefaultDgLibrary, createDgOnboardContainer } from './dg-manifest.models';
import { createDgUnifeederRow } from './dg-unifeeder.models';
import {
  dgLibraryActiveContainerCount,
  dgPageSnapshotMatchKey,
  type DgPageShipContext,
} from './dg-page-archive.models';

const ship = (port: string, voyage: string): DgPageShipContext => ({
  voyageNumber: voyage,
  portOfCall: port,
  nextPortOfCall: '',
  dateOfDeparture: '',
  dateOfArrival: '',
});

describe('dgPageSnapshotMatchKey', () => {
  it('matches same port, voyage and container count on the same tab', () => {
    const lib = createDefaultDgLibrary();
    lib.activeInventoryTab = 'cmaCgm';
    lib.onboard = [
      createDgOnboardContainer({ containerNo: 'AAAA1111111' }),
      createDgOnboardContainer({ containerNo: 'BBBB2222222' }),
    ];
    const a = dgPageSnapshotMatchKey(ship('Bremerhaven', '0XY123E'), lib);
    const b = dgPageSnapshotMatchKey(ship('bremerhaven', '0xy123e'), lib);
    expect(a).toBe(b);
    expect(dgLibraryActiveContainerCount(lib)).toBe(2);
  });

  it('differs when container count changes', () => {
    const libA = createDefaultDgLibrary();
    libA.activeInventoryTab = 'cmaCgm';
    libA.onboard = [createDgOnboardContainer({ containerNo: 'AAAA1111111' })];
    const libB = createDefaultDgLibrary();
    libB.activeInventoryTab = 'cmaCgm';
    libB.onboard = [
      createDgOnboardContainer({ containerNo: 'AAAA1111111' }),
      createDgOnboardContainer({ containerNo: 'BBBB2222222' }),
    ];
    expect(dgPageSnapshotMatchKey(ship('Riga', '1'), libA)).not.toBe(
      dgPageSnapshotMatchKey(ship('Riga', '1'), libB),
    );
  });

  it('differs between CMA and Unifeeder tabs', () => {
    const cma = createDefaultDgLibrary();
    cma.activeInventoryTab = 'cmaCgm';
    cma.onboard = [createDgOnboardContainer({ containerNo: 'AAAA1111111' })];
    const uf = createDefaultDgLibrary();
    uf.activeInventoryTab = 'unifeeder';
    uf.unifeeder = {
      ...uf.unifeeder,
      onboard: [createDgUnifeederRow({ containerNo: 'AAAA1111111' })],
    };
    expect(dgPageSnapshotMatchKey(ship('Riga', '1'), cma)).not.toBe(
      dgPageSnapshotMatchKey(ship('Riga', '1'), uf),
    );
  });
});

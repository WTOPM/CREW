import { createEmptyAppData } from '../data/empty-app-data';
import {
  formSessionSlicesChanged,
  mergeSectionForSave,
  mergeSectionFromDisk,
  mergeSectionsForSave,
  sectionFromRoutePath,
} from './app-data-section.util';

describe('app-data-section.util', () => {
  it('maps routes to sections', () => {
    expect(sectionFromRoutePath('/')).toBe('home');
    expect(sectionFromRoutePath('/dg')).toBe('dg');
    expect(sectionFromRoutePath('/dg/reference')).toBe('dg');
    expect(sectionFromRoutePath('/dg/dep-rep')).toBe('dg');
    expect(sectionFromRoutePath('/eta')).toBe('eta');
    expect(sectionFromRoutePath('/fuel')).toBe('fuel');
    expect(sectionFromRoutePath('/settings')).toBe('settings');
    expect(sectionFromRoutePath('/crew-arr')).toBeNull();
  });

  it('mergeSectionForSave writes ETA / DG from any PC into the shared file', () => {
    const disk = createEmptyAppData();
    const memory = createEmptyAppData();
    memory.etaLibrary = {
      ...memory.etaLibrary,
      draft: { ...memory.etaLibrary.draft, name: 'Shared ETA' },
    };
    memory.dgLibrary = { ...memory.dgLibrary, showDischarged: true };
    const etaSaved = mergeSectionForSave(disk, memory, 'eta');
    expect(etaSaved.etaLibrary.draft.name).toBe('Shared ETA');
    const dgSaved = mergeSectionForSave(disk, memory, 'dg');
    expect(dgSaved.dgLibrary.showDischarged).toBe(true);
  });

  it('mergeSectionFromDisk updates only the target section', () => {
    const target = createEmptyAppData();
    target.crew = [{ id: '1', familyName: 'OLD', givenNames: '', rank: 'Master' } as never];
    const source = createEmptyAppData();
    source.etaLibrary = { ...source.etaLibrary, draft: { ...source.etaLibrary.draft, name: 'Plan A' } };
    source.ship = { ...source.ship, name: 'NEW SHIP' };

    const merged = mergeSectionFromDisk(target, source, 'eta');
    expect(merged.etaLibrary.draft.name).toBe('Plan A');
    expect(merged.crew[0]?.familyName).toBe('OLD');
    expect(merged.ship.name).toBe('NEW SHIP');
  });

  it('mergeSectionForSave writes only the active section into disk snapshot', () => {
    const disk = createEmptyAppData();
    disk.crew = [{ id: '1', familyName: 'DISK', givenNames: '', rank: 'Master' } as never];
    const memory = createEmptyAppData();
    memory.crew = [{ id: '2', familyName: 'MEM', givenNames: '', rank: 'Cook' } as never];
    memory.etaLibrary = { ...memory.etaLibrary, draft: { ...memory.etaLibrary.draft, name: 'X' } };

    const saved = mergeSectionForSave(disk, memory, 'home');
    expect(saved.crew[0]?.familyName).toBe('MEM');
    expect(saved.etaLibrary.draft.name).not.toBe('X');
  });

  it('mergeSectionForSave always persists outputSettings from memory', () => {
    const disk = createEmptyAppData();
    disk.outputSettings = { ...disk.outputSettings, saveToFolder: false, activePath: 'disk-path' };
    const memory = createEmptyAppData();
    memory.outputSettings = { ...memory.outputSettings, saveToFolder: true, activePath: 'mem-path' };

    const saved = mergeSectionForSave(disk, memory, 'home');
    expect(saved.outputSettings.saveToFolder).toBe(true);
    expect(saved.outputSettings.activePath).toBe('mem-path');
  });

  it('mergeSectionForSave always persists ship from memory on Home', () => {
    const disk = createEmptyAppData();
    disk.ship = { ...disk.ship, portOfCall: 'Hamburg' };
    const memory = createEmptyAppData();
    memory.ship = { ...memory.ship, portOfCall: 'Rotterdam' };

    const saved = mergeSectionForSave(disk, memory, 'home');
    expect(saved.ship.portOfCall).toBe('Rotterdam');
  });

  it('mergeSectionsForSave keeps every dirty tab and leaves clean tabs from disk', () => {
    const disk = createEmptyAppData();
    disk.crew = [{ id: '1', familyName: 'DISK', givenNames: '', rank: 'Master' } as never];
    disk.fuelLibrary = { ...disk.fuelLibrary, events: [] };
    disk.etaLibrary = { ...disk.etaLibrary, draft: { ...disk.etaLibrary.draft, name: 'DISK-ETA' } };
    const memory = createEmptyAppData();
    memory.crew = [{ id: '2', familyName: 'MEM', givenNames: '', rank: 'Cook' } as never];
    memory.fuelLibrary = {
      ...memory.fuelLibrary,
      events: [{ id: 'e1' } as never],
    };
    memory.etaLibrary = { ...memory.etaLibrary, draft: { ...memory.etaLibrary.draft, name: 'MEM-ETA' } };

    const saved = mergeSectionsForSave(disk, memory, ['home', 'fuel']);
    expect(saved.crew[0]?.familyName).toBe('MEM');
    expect(saved.fuelLibrary.events).toHaveLength(1);
    // ETA was not dirty — disk wins (other PC / older shared value).
    expect(saved.etaLibrary.draft.name).toBe('DISK-ETA');
  });

  it('mergeSectionsForSave with no sections still writes shared ship/outputSettings', () => {
    const disk = createEmptyAppData();
    disk.ship = { ...disk.ship, portOfCall: 'DiskPort' };
    disk.crew = [{ id: '1', familyName: 'DISK', givenNames: '', rank: 'Master' } as never];
    const memory = createEmptyAppData();
    memory.ship = { ...memory.ship, portOfCall: 'MemPort' };
    memory.outputSettings = { ...memory.outputSettings, saveToFolder: true };
    memory.crew = [{ id: '2', familyName: 'MEM', givenNames: '', rank: 'Cook' } as never];

    const saved = mergeSectionsForSave(disk, memory, []);
    expect(saved.ship.portOfCall).toBe('MemPort');
    expect(saved.outputSettings.saveToFolder).toBe(true);
    expect(saved.crew[0]?.familyName).toBe('DISK');
  });

  it('mergeSectionsForSave includes dgPageArchives on dg section', () => {
    const disk = createEmptyAppData();
    const memory = createEmptyAppData();
    memory.dgPageArchives = [
      {
        id: 'a1',
        label: 'Snap',
        savedAt: '2026-10-16T00:00:00.000Z',
        ship: {
          voyageNumber: '',
          portOfCall: 'Hamburg',
          nextPortOfCall: '',
          dateOfDeparture: '2026-10-07',
          dateOfArrival: '',
        },
        dgLibrary: memory.dgLibrary,
      },
    ];
    memory.dgLibrary = { ...memory.dgLibrary, showDischarged: true };

    const saved = mergeSectionsForSave(disk, memory, ['dg']);
    expect(saved.dgPageArchives).toHaveLength(1);
    expect(saved.dgPageArchives[0]?.label).toBe('Snap');
    expect(saved.dgLibrary.showDischarged).toBe(true);
  });

  it('formSessionSlicesChanged detects Home form edits and Settings list edits', () => {
    const a = createEmptyAppData();
    const same = structuredClone(a);
    expect(formSessionSlicesChanged(a, same)).toBe(false);

    const homeEdit = structuredClone(a);
    homeEdit.shipStoresForm = {
      ...homeEdit.shipStoresForm,
      placeOfStorage: 'Provision Room',
    };
    expect(formSessionSlicesChanged(a, homeEdit)).toBe(true);

    const settingsEdit = structuredClone(a);
    settingsEdit.ports = [{ name: 'Hamburg', code: 'DEHAM', terminals: [] }];
    expect(formSessionSlicesChanged(a, settingsEdit)).toBe(true);

    const otherTab = structuredClone(a);
    otherTab.fuelLibrary = { ...otherTab.fuelLibrary, events: [{ id: 'e1' } as never] };
    expect(formSessionSlicesChanged(a, otherTab)).toBe(false);
  });

  it('formSessionSlicesChanged ignores Select-document tab prefs', () => {
    const a = createEmptyAppData();
    const tabOnly = structuredClone(a);
    tabOnly.portOfCall = { ...tabOnly.portOfCall, settingsDocId: 'sso0108' };
    tabOnly.shipStoresSettingsDocId = 'shipStores03';
    expect(formSessionSlicesChanged(a, tabOnly)).toBe(false);

    tabOnly.portOfCall = { ...tabOnly.portOfCall, pdfRowCount: 12 };
    expect(formSessionSlicesChanged(a, tabOnly)).toBe(true);
  });
});

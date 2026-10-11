import { TestBed } from '@angular/core/testing';
import { createEmptyAppData } from '../data/empty-app-data';
import {
  mergeSectionForSave,
  mergeSectionFromDisk,
  SECTION_LOCK_EXEMPT,
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

  it('DG / ETA / FUEL / Phone are lock-exempt', () => {
    expect(SECTION_LOCK_EXEMPT.has('dg')).toBe(true);
    expect(SECTION_LOCK_EXEMPT.has('eta')).toBe(true);
    expect(SECTION_LOCK_EXEMPT.has('fuel')).toBe(true);
    expect(SECTION_LOCK_EXEMPT.has('phone')).toBe(true);
    expect(SECTION_LOCK_EXEMPT.has('home')).toBe(false);
    expect(SECTION_LOCK_EXEMPT.has('reefer')).toBe(false);
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
});

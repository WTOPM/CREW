import { TestBed } from '@angular/core/testing';
import { createEmptyAppData } from '../data/empty-app-data';
import {
  mergeSectionForSave,
  mergeSectionFromDisk,
  sectionFromRoutePath,
} from './app-data-section.util';

describe('app-data-section.util', () => {
  it('maps routes to sections', () => {
    expect(sectionFromRoutePath('/')).toBe('home');
    expect(sectionFromRoutePath('/dg')).toBe('dg');
    expect(sectionFromRoutePath('/dg/reference')).toBe('dg');
    expect(sectionFromRoutePath('/eta')).toBe('eta');
    expect(sectionFromRoutePath('/settings')).toBe('settings');
    expect(sectionFromRoutePath('/crew-arr')).toBeNull();
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
});

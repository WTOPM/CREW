import { describe, expect, it } from 'vitest';
import { outputFolderSectionFromRoute } from './output-folder-section.util';

describe('outputFolderSectionFromRoute', () => {
  it('maps Home and document routes to home', () => {
    expect(outputFolderSectionFromRoute('/')).toBe('home');
    expect(outputFolderSectionFromRoute('/crew-arr')).toBe('home');
  });

  it('maps DG and Reefer', () => {
    expect(outputFolderSectionFromRoute('/dg')).toBe('dg');
    expect(outputFolderSectionFromRoute('/dg/reference')).toBe('dg');
    expect(outputFolderSectionFromRoute('/reefer')).toBe('reefer');
  });

  it('hides the bar on ETA, FUEL and Settings', () => {
    expect(outputFolderSectionFromRoute('/eta')).toBeNull();
    expect(outputFolderSectionFromRoute('/eta/timezones')).toBeNull();
    expect(outputFolderSectionFromRoute('/fuel')).toBeNull();
    expect(outputFolderSectionFromRoute('/settings')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  createDefaultHomeListViewSettings,
  normalizeHomeListViewSettings,
} from './crew.models';

describe('normalizeHomeListViewSettings', () => {
  it('defaults to edit mode with standard columns (no scans)', () => {
    const d = createDefaultHomeListViewSettings();
    expect(d.mode).toBe('edit');
    expect(d.crewTableColumns).toContain('family');
    expect(d.crewTableColumns).not.toContain('scans' as never);
  });

  it('keeps table mode and filters unknown / legacy column ids', () => {
    const n = normalizeHomeListViewSettings({
      mode: 'table',
      crewTableColumns: ['family', 'bogus' as never, 'passport', 'scans' as never, 'gender'],
    });
    expect(n.mode).toBe('table');
    expect(n.crewTableColumns).toEqual(['family', 'passport', 'gender']);
  });

  it('falls back to defaults when column list is empty', () => {
    const n = normalizeHomeListViewSettings({ mode: 'table', crewTableColumns: [] });
    expect(n.crewTableColumns.length).toBeGreaterThan(0);
  });
});

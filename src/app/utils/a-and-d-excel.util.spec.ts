import { describe, expect, it } from 'vitest';
import { createEmptyAdDraft } from '../models/a-and-d.models';
import { parseAdLocalDateTime } from './a-and-d-excel.util';

describe('parseAdLocalDateTime', () => {
  it('keeps typed wall-clock time in UTC components (no local TZ shift)', () => {
    const d = parseAdLocalDateTime('2026-11-01T14:30');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(10);
    expect(d!.getUTCDate()).toBe(1);
    expect(d!.getUTCHours()).toBe(14);
    expect(d!.getUTCMinutes()).toBe(30);
  });

  it('returns null for empty / invalid', () => {
    expect(parseAdLocalDateTime('')).toBeNull();
    expect(parseAdLocalDateTime('not-a-date')).toBeNull();
  });
});

describe('createEmptyAdDraft + Excel parse contract', () => {
  it('allows starting parse with zero terminals (no phantom blank card)', () => {
    const draft = createEmptyAdDraft({
      vessel: 'TEST',
      portCallId: '1',
      portCode: 'DEBRV',
      terminals: [],
    });
    expect(draft.terminals).toEqual([]);
    // Parser pushes real columns onto this array; empty → seed one blank only at end.
  });
});

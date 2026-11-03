import { describe, expect, it } from 'vitest';
import {
  adExportFileName,
  adKindForDrop,
  adPaletteGroupOfKind,
  buildAdFileNameFromPattern,
  buildAdFileNameStem,
  createAdAction,
  createAdFileNameBlock,
  createDefaultAdFileNamePattern,
  createEmptyAdDraft,
  formatAdFolderSequence,
  isAdPilotAction,
  isAdTugAction,
  latestAdReportDisplayDate,
  nextAdFolderSequence,
  normalizeAdFileNamePattern,
  normalizeAdWorkspace,
  resolveAdPortName,
} from './a-and-d.models';

describe('a-and-d.models', () => {
  it('creates pilot action with empty times', () => {
    const a = createAdAction('harbour_out');
    expect(isAdPilotAction(a)).toBe(true);
    if (isAdPilotAction(a)) {
      expect(a.onboarding).toBe('');
      expect(a.disembarkment).toBe('');
    }
  });

  it('creates tug action with Safety / qty 1 defaults', () => {
    const a = createAdAction('tug_mooring');
    expect(isAdTugAction(a)).toBe(true);
    if (isAdTugAction(a)) {
      expect(a.quantity).toBe(1);
      expect(a.reason).toBe('Safety');
    }
  });

  it('applies custom tug reason when creating a block', () => {
    const a = createAdAction('tug_unmooring', {
      tug: { reason: 'Ice', quantity: 1, waitMins: '0', vain: 'No' },
    });
    expect(isAdTugAction(a)).toBe(true);
    if (isAdTugAction(a)) {
      expect(a.reason).toBe('Ice');
      expect(a.quantity).toBe(1);
    }
  });

  it('builds export file name from port + call id', () => {
    const draft = createEmptyAdDraft({ portCode: 'debrv', portCallId: '701216' });
    const name = adExportFileName(draft, new Date(2026, 9, 15));
    expect(name).toBe('A&D DEBRV 15.10.2026 - 701216.xlsx');
  });

  it('createEmptyAdDraft keeps explicit empty terminals array (Excel parse)', () => {
    const draft = createEmptyAdDraft({ portCode: 'DEBRV', terminals: [] });
    expect(draft.terminals).toEqual([]);
  });

  it('createEmptyAdDraft seeds one blank terminal when omitted', () => {
    expect(createEmptyAdDraft().terminals.length).toBe(1);
    expect(createEmptyAdDraft().terminals[0]!.code).toBe('');
  });

  it('maps palette drop zone to Excel action kinds', () => {
    expect(adKindForDrop('river', 'in')).toBe('river_in');
    expect(adKindForDrop('river', 'out')).toBe('river_out');
    expect(adKindForDrop('tug', 'in')).toBe('tug_mooring');
    expect(adKindForDrop('tug', 'out')).toBe('tug_unmooring');
    expect(adKindForDrop('anchorage', 'in')).toBe('anchorage_to');
    expect(adPaletteGroupOfKind('harbour_out').id).toBe('harbour');
  });

  it('normalizeAdWorkspace keeps folder path and draft across reopen shape', () => {
    const ws = normalizeAdWorkspace({
      folderPath: ' D:\\Reports\\AandD ',
      selectedFile: 'A&D DEBRV.xlsx',
      draft: createEmptyAdDraft({ portCode: 'debrv', portCallId: '701216' }),
      blockDefaults: {
        tug: { reason: 'Ice', quantity: 2, waitMins: '5', vain: 'Yes' },
        terminal: { shoreGangwayShift: 'Yes' },
      } as never,
    });
    expect(ws.folderPath).toBe('D:\\Reports\\AandD');
    expect(ws.selectedFile).toBe('A&D DEBRV.xlsx');
    expect(ws.draft.portCode).toBe('DEBRV');
    expect(ws.draft.portCallId).toBe('701216');
    expect(ws.blockDefaults.tug.reason).toBe('Ice');
    expect(ws.blockDefaults.tug.quantity).toBe(2);
    expect(ws.blockDefaults.terminal.shoreGangwayShift).toBe('Yes');
  });

  it('normalizeAdWorkspace migrates legacy flat defaults', () => {
    const ws = normalizeAdWorkspace({
      blockDefaults: { tugReason: 'Ice', gangwayShift: 'Yes' } as never,
    });
    expect(ws.blockDefaults.tug.reason).toBe('Ice');
    expect(ws.blockDefaults.terminal.shoreGangwayShift).toBe('Yes');
  });

  it('normalizeAdWorkspace fills defaults for missing / legacy blobs', () => {
    const ws = normalizeAdWorkspace(null);
    expect(ws.folderPath).toBe('');
    expect(ws.selectedFile).toBe('');
    expect(ws.draft.terminals.length).toBeGreaterThan(0);
    expect(ws.blockDefaults.tug.reason).toBe('Safety');
    expect(ws.blockDefaults.river.pec).toBe('No');
    expect(ws.fileNamePattern.blocks.length).toBeGreaterThan(0);
    expect(ws.actionDisplaySort).toBe('document');
  });

  it('nextAdFolderSequence uses max leading number or file count', () => {
    expect(nextAdFolderSequence([])).toBe(1);
    expect(nextAdFolderSequence(['A&D.xlsx', 'notes.xlsx'])).toBe(3);
    expect(nextAdFolderSequence(['3 A&D.xlsx', '12 A&D.xlsx', 'A&D.xlsx'])).toBe(13);
    expect(formatAdFolderSequence(1)).toBe('01');
    expect(formatAdFolderSequence(12)).toBe('12');
  });

  it('buildAdFileNameStem joins non-empty blocks with per-block sepAfter', () => {
    const pattern = normalizeAdFileNamePattern({
      delimiter: ' ',
      blocks: [
        createAdFileNameBlock('sequence', '', ' '),
        createAdFileNameBlock('empty', '', '-'),
        createAdFileNameBlock('custom', 'A&D', ' '),
        createAdFileNameBlock('portCallId', '', '_'),
        createAdFileNameBlock('portCode', '', ' '),
        createAdFileNameBlock('portName', '', ' '),
        createAdFileNameBlock('reportDate', '', ''),
      ],
    });
    expect(
      buildAdFileNameStem(pattern, {
        portCallId: '701216',
        portCode: 'debrv',
        portName: 'Bremerhaven',
        folderFiles: ['01 A&D.xlsx'],
        sequence: 2,
        reportDate: '14.10.2026',
      }),
    ).toBe('02 A&D 701216_DEBRV Bremerhaven 14.10.2026');
    expect(resolveAdPortName('DEBRV', [{ code: 'DEBRV', name: 'Bremerhaven' }])).toBe(
      'Bremerhaven',
    );
  });

  it('normalizeAdFileNamePattern migrates legacy delimiter into missing sepAfter', () => {
    const pattern = normalizeAdFileNamePattern({
      delimiter: '-',
      blocks: [
        { id: 'a', type: 'sequence', text: '' },
        { id: 'b', type: 'custom', text: 'A&D' },
        { id: 'c', type: 'portCallId', text: '', sepAfter: ' · ' },
      ] as never,
    });
    expect(pattern.blocks[0]!.sepAfter).toBe('-');
    expect(pattern.blocks[1]!.sepAfter).toBe('-');
    expect(pattern.blocks[2]!.sepAfter).toBe(' · ');
  });

  it('latestAdReportDisplayDate takes the latest event date', () => {
    const draft = createEmptyAdDraft({ portCallId: '1' });
    const harbour = createAdAction('harbour_in');
    const tug = createAdAction('tug_mooring');
    if (!isAdPilotAction(harbour) || !isAdTugAction(tug)) throw new Error('bad');
    harbour.onboarding = '2026-10-14T13:48';
    tug.start = '2026-10-15T09:00';
    draft.terminals[0]!.actions = [harbour, tug];
    expect(latestAdReportDisplayDate(draft)).toBe('15.10.2026');
  });

  it('buildAdFileNameFromPattern appends .xlsx and falls back when empty', () => {
    const draft = {
      ...createEmptyAdDraft(),
      portCode: 'DEBRV',
      portCallId: '701216',
    };
    const named = buildAdFileNameFromPattern(createDefaultAdFileNamePattern(), draft, []);
    expect(named).toBe('01 A&D 701216.xlsx');

    const emptyPattern = normalizeAdFileNamePattern({
      delimiter: ' ',
      blocks: [createAdFileNameBlock('empty')],
    });
    const when = new Date('2026-10-15T12:00:00');
    expect(buildAdFileNameFromPattern(emptyPattern, draft, [], { when })).toBe(
      adExportFileName(draft, when),
    );
  });

  it('createAdAction copies pilot/tug extras from defaults', () => {
    const pilot = createAdAction('harbour_in', {
      harbour: { pec: 'Yes', waitMins: '12', vain: 'Yes' },
    });
    expect(isAdPilotAction(pilot)).toBe(true);
    if (isAdPilotAction(pilot)) {
      expect(pilot.pec).toBe('Yes');
      expect(pilot.waitMins).toBe('12');
      expect(pilot.vain).toBe('Yes');
    }
    const tug = createAdAction('tug_mooring', {
      tug: { quantity: 3, reason: 'Ice', waitMins: '4', vain: 'No' },
    });
    expect(isAdTugAction(tug)).toBe(true);
    if (isAdTugAction(tug)) {
      expect(tug.quantity).toBe(3);
      expect(tug.reason).toBe('Ice');
      expect(tug.waitMins).toBe('4');
    }
  });
});

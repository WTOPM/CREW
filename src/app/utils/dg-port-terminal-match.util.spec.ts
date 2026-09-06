import { describe, expect, it } from 'vitest';
import type { Port } from '../models/crew.models';
import {
  extractPortTerminalHint,
  matchBestPortTerminal,
  resolveUnifeederTerminalAbbrev,
  scorePortTerminalMatch,
} from './dg-port-terminal-match.util';

describe('dg-port-terminal-match', () => {
  it('extracts the part after the first slash', () => {
    expect(extractPortTerminalHint('BREMERHAVEN/NTB NORTH SEA TERMINAL')).toBe(
      'NTB NORTH SEA TERMINAL',
    );
    expect(extractPortTerminalHint('HAMBURG')).toBe('');
  });

  it('scores NTB against DENTB / NORTH SEA TERMINAL highly', () => {
    const score = scorePortTerminalMatch('NTB NORTH SEA TERMINAL', {
      abbrev: 'DENTB',
      name: 'NORTH SEA TERMINAL',
    });
    expect(score).toBeGreaterThanOrEqual(600);
  });

  it('picks the best terminal abbrev for a port', () => {
    const port: Port = {
      name: 'BREMERHAVEN',
      code: 'DEBRV',
      terminals: [
        { abbrev: 'OTHER', name: 'Somewhere Else' },
        { abbrev: 'DENTB', name: 'NORTH SEA TERMINAL' },
      ],
    };
    expect(matchBestPortTerminal('NTB NORTH SEA TERMINAL', port)).toBe('DENTB');
  });

  it('resolves EUROGATE hint to EGH on Hamburg', () => {
    const ports: Port[] = [
      {
        name: 'HAMBURG',
        code: 'DEHAM',
        terminals: [{ abbrev: 'EGH', name: 'Eurogate Terminal Hamburg' }],
      },
      {
        name: 'BREMERHAVEN',
        code: 'DEBRV',
        terminals: [{ abbrev: 'DENTB', name: 'NORTH SEA TERMINAL' }],
      },
    ];
    expect(
      resolveUnifeederTerminalAbbrev('HAMBURG', 'EUROGATE CONTAINER TERMINAL', ports),
    ).toBe('EGH');
  });
});

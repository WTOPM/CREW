import { describe, expect, it } from 'vitest';
import type { Port } from '../../models/crew.models';
import { portMatchesQuery, terminalOptionMatchesQuery } from './port-select.component';

/** Mirrors port-select terminals-mode option building (pure). */
function buildTerminalSections(ports: Port[]) {
  const map = new Map<string, { portCode: string; abbrevs: string[] }>();
  for (const p of ports) {
    for (const t of p.terminals ?? []) {
      const abbrev = (t.abbrev?.trim() || t.name.trim()).toUpperCase();
      if (!abbrev) continue;
      let section = map.get(p.name);
      if (!section) {
        section = { portCode: p.code?.trim() || p.name, abbrevs: [] };
        map.set(p.name, section);
      }
      section.abbrevs.push(abbrev);
    }
  }
  return [...map.entries()].map(([portName, s]) => ({ portName, ...s }));
}

describe('port-select modes', () => {
  const ports: Port[] = [
    {
      name: 'HAMBURG',
      code: 'DEHAM',
      terminals: [{ abbrev: 'EGH', name: 'Eurogate' }],
    },
    { name: 'ROTTERDAM', code: 'NLRTM', terminals: [] },
  ];

  it('ports mode uses port list only (no terminal rows)', () => {
    expect(ports.map((p) => p.code)).toEqual(['DEHAM', 'NLRTM']);
    expect(buildTerminalSections(ports).every((s) => s.abbrevs.length > 0)).toBe(true);
  });

  it('terminals mode lists abbrevs grouped under ports that have terminals', () => {
    const sections = buildTerminalSections(ports);
    expect(sections).toEqual([
      { portName: 'HAMBURG', portCode: 'DEHAM', abbrevs: ['EGH'] },
    ]);
  });
});

describe('portMatchesQuery', () => {
  const hamburg: Port = { name: 'HAMBURG', code: 'DEHAM' };

  it('matches LOCODE prefix and port name', () => {
    expect(portMatchesQuery(hamburg, 'de')).toBe(true);
    expect(portMatchesQuery(hamburg, 'DEH')).toBe(true);
    expect(portMatchesQuery(hamburg, 'ham')).toBe(true);
    expect(portMatchesQuery(hamburg, 'xyz')).toBe(false);
  });
});

describe('terminalOptionMatchesQuery', () => {
  const opt = {
    portName: 'HAMBURG',
    portCode: 'DEHAM',
    abbrev: 'EGH',
    terminalName: 'Eurogate',
  };

  it('matches terminal abbrev and parent port code', () => {
    expect(terminalOptionMatchesQuery(opt, 'eg')).toBe(true);
    expect(terminalOptionMatchesQuery(opt, 'deh')).toBe(true);
    expect(terminalOptionMatchesQuery(opt, 'euro')).toBe(true);
    expect(terminalOptionMatchesQuery(opt, 'xyz')).toBe(false);
  });
});

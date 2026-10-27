import { describe, expect, it } from 'vitest';
import { resolveManifestPortName, type Port } from './crew.models';

function port(name: string, code = ''): Port {
  return { name, code, country: '', terminals: [] };
}

describe('resolveManifestPortName', () => {
  const ports: Port[] = [
    port('La Spezia', 'ITSPE'),
    port('Hamburg', 'DEHAM'),
    port('Klaipeda', 'LTKLJ'),
    port('Bremerhaven', 'DEBRV'),
  ];

  it('maps HAMBURG to Hamburg without touching La Spezia', () => {
    expect(resolveManifestPortName('HAMBURG', ports)).toBe('Hamburg');
  });

  it('does not map KLAIPEDA to La Spezia via short "la" substring', () => {
    expect(resolveManifestPortName('KLAIPEDA', ports)).toBe('Klaipeda');
  });

  it('keeps unknown city unmatched (empty) when Klaipeda is absent', () => {
    const withoutKlaipeda = ports.filter((p) => p.name !== 'Klaipeda');
    expect(resolveManifestPortName('KLAIPEDA', withoutKlaipeda)).toBe('');
  });

  it('still matches BREMERHAVEN / BREMER prefix to Bremerhaven', () => {
    expect(resolveManifestPortName('BREMERHAVEN', ports)).toBe('Bremerhaven');
    expect(resolveManifestPortName('BREMER', ports)).toBe('Bremerhaven');
  });

  it('matches SPEZIA inside La Spezia by contains', () => {
    expect(resolveManifestPortName('SPEZIA', ports)).toBe('La Spezia');
  });
});

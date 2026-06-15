export interface DgPackingGroupEntry {
  roman: string;
  label: string;
  summary: string;
}

const PACKING_GROUPS: Record<'I' | 'II' | 'III', DgPackingGroupEntry> = {
  I: {
    roman: 'I',
    label: 'Packing Group I',
    summary: 'Substances presenting high danger.',
  },
  II: {
    roman: 'II',
    label: 'Packing Group II',
    summary: 'Substances presenting medium danger.',
  },
  III: {
    roman: 'III',
    label: 'Packing Group III',
    summary: 'Substances presenting low danger.',
  },
};

export function normalizeDgPackingGroupKey(raw: string): 'I' | 'II' | 'III' | null {
  const value = raw.trim().toUpperCase().replace(/^PG\s*/i, '');
  if (!value || value === '--' || value === '—' || value === '-') return null;
  if (value === 'I' || value === '1') return 'I';
  if (value === 'II' || value === '2') return 'II';
  if (value === 'III' || value === '3') return 'III';
  return null;
}

export function lookupDgPackingGroup(raw: string): DgPackingGroupEntry | undefined {
  const key = normalizeDgPackingGroupKey(raw);
  return key ? PACKING_GROUPS[key] : undefined;
}

export function formatDgPackingGroupReference(): string {
  return (['I', 'II', 'III'] as const)
    .map((key) => `${PACKING_GROUPS[key].label}\n${PACKING_GROUPS[key].summary}`)
    .join('\n\n');
}

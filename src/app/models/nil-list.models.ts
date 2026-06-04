export const NIL_LIST_PAGE_HEIGHT_PT = 842;

/** Default phrase slots (pdf.js baseline Y) from NIL List.pdf. */
export const NIL_LIST_PHRASE_SLOT_BASELINE_Y: readonly number[] = [254, 281, 309, 336];

export const NIL_LIST_PHRASE_ROW_STEP = 27;

export const DEFAULT_NIL_LIST_PHRASE_TEXTS = [
  'THERE ARE NO PASSENGERS ON BOARD.',
  'THERE ARE NO ANIMALS AND BIRDS ON BOARD.',
  'THERE ARE NO ARMS AND AMMUNITIONS ON BOARD.',
  'THERE ARE NO STOWAWAYS ON BOARD.',
] as const;

export interface NilListPhrase {
  id: string;
  text: string;
  enabled: boolean;
}

export interface NilListFormSettings {
  phrases: NilListPhrase[];
}

export function createNilListPhrase(text: string, enabled = true): NilListPhrase {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    enabled,
  };
}

export function createDefaultNilListForm(): NilListFormSettings {
  return {
    phrases: DEFAULT_NIL_LIST_PHRASE_TEXTS.map((text) => createNilListPhrase(text, true)),
  };
}

/** Baseline Y for the Nth printed phrase (0 = first line, compact — no gaps). */
export function nilListCompactPhraseBaselineY(compactIndex: number): number {
  const first = NIL_LIST_PHRASE_SLOT_BASELINE_Y[0];
  return first + compactIndex * NIL_LIST_PHRASE_ROW_STEP;
}

export function normalizeNilListForm(
  raw: Partial<NilListFormSettings> | undefined,
): NilListFormSettings {
  const defaults = createDefaultNilListForm();
  const list = Array.isArray(raw?.phrases) ? raw.phrases : [];
  if (!list.length) {
    return defaults;
  }
  const phrases = list
    .map((p) => ({
      id: (p?.id ?? '').trim() || crypto.randomUUID(),
      text: (p?.text ?? '').trim(),
      enabled: p?.enabled !== false,
    }))
    .filter((p) => p.text.length > 0);
  return { phrases: phrases.length ? phrases : defaults.phrases };
}

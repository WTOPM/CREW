export const DEFAULT_NIL_LIST_PHRASE_TEXTS = [
  'THERE ARE NO PASSENGERS ON BOARD.',
  'THERE ARE NO ANIMALS AND BIRDS ON BOARD.',
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

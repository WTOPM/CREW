export const CREW_MONEY_LIST_PAGE_HEIGHT_PT = 842;

export const CREW_MONEY_LIST_MAX_CREW_ROWS = 20;

export interface CrewMoneyListCrewAmounts {
  usd: string;
  euro: string;
  others: string;
}

export interface CrewMoneyListFormSettings {
  byCrewId: Record<string, CrewMoneyListCrewAmounts>;
}

export function createDefaultCrewMoneyListForm(): CrewMoneyListFormSettings {
  return { byCrewId: {} };
}

export function normalizeCrewMoneyListForm(
  raw: Partial<CrewMoneyListFormSettings> | undefined,
): CrewMoneyListFormSettings {
  const byCrewId: Record<string, CrewMoneyListCrewAmounts> = {};
  const src = raw?.byCrewId ?? {};
  for (const [id, amounts] of Object.entries(src)) {
    if (!id.trim()) continue;
    byCrewId[id] = {
      usd: (amounts?.usd ?? '').trim(),
      euro: (amounts?.euro ?? '').trim(),
      others: (amounts?.others ?? '').trim(),
    };
  }
  return { byCrewId };
}

export function crewMoneyListAmountsFor(
  form: CrewMoneyListFormSettings,
  crewId: string,
): CrewMoneyListCrewAmounts {
  return form.byCrewId[crewId] ?? { usd: '', euro: '', others: '' };
}

export const CASH_ADVANCE_PAGE_HEIGHT_PT = 842;

/** Pre-printed on Cash Advance — empty.pdf (do not overlay unless changed in settings). */
export const CASH_ADVANCE_TEMPLATE_TITLE = 'Payroll of Christmas Bonus from the Owners';

export const CASH_ADVANCE_MAX_CREW_ROWS = 20;

export interface CashAdvanceCrewAmounts {
  usd: string;
  eur: string;
}

export interface CashAdvanceFormSettings {
  /** Header line (e.g. payroll title). */
  title: string;
  /** Empty → ship date of arrival (display format). */
  payrollDate: string;
  /** Amounts keyed by crew member id. */
  byCrewId: Record<string, CashAdvanceCrewAmounts>;
}

export function createDefaultCashAdvanceForm(): CashAdvanceFormSettings {
  return {
    title: 'Payroll of Christmas Bonus from the Owners',
    payrollDate: '',
    byCrewId: {},
  };
}

export function normalizeCashAdvanceForm(
  raw: Partial<CashAdvanceFormSettings> | undefined,
): CashAdvanceFormSettings {
  const defaults = createDefaultCashAdvanceForm();
  const byCrewId: Record<string, CashAdvanceCrewAmounts> = {};
  const src = raw?.byCrewId ?? {};
  for (const [id, amounts] of Object.entries(src)) {
    if (!id.trim()) continue;
    byCrewId[id] = {
      usd: (amounts?.usd ?? '').trim(),
      eur: (amounts?.eur ?? '').trim(),
    };
  }
  return {
    title: (raw?.title ?? defaults.title).trim() || defaults.title,
    payrollDate: (raw?.payrollDate ?? '').trim(),
    byCrewId,
  };
}

export function cashAdvanceAmountsFor(
  form: CashAdvanceFormSettings,
  crewId: string,
): CashAdvanceCrewAmounts {
  return form.byCrewId[crewId] ?? { usd: '', eur: '' };
}

/** Sum numeric crew amounts for the TOTAL row (empty string if none entered). */
export function sumCashAdvanceCurrency(amounts: readonly string[]): string {
  let sum = 0;
  let hasAny = false;
  for (const raw of amounts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const n = Number.parseFloat(trimmed.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) {
      sum += n;
      hasAny = true;
    }
  }
  if (!hasAny) return '';
  return Number.isInteger(sum) ? String(sum) : String(Math.round(sum * 100) / 100);
}

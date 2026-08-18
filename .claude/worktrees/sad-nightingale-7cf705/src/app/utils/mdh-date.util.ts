import { formatBirthDateShort, formatDisplayDate } from './date.util';

/** MDH header date: dd.MM.yy */
export function formatMdhShortDate(value: string | undefined | null): string {
  return formatBirthDateShort(value);
}

/** MDH port-call row date: dd.MM.yyyy */
export function formatMdhPortDate(value: string | undefined | null): string {
  return formatDisplayDate(value);
}

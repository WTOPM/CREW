/** Format keyboard time entry as HH:MM (auto-insert colon after hours). */
export function formatTimeInput(raw: string, previous = ''): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';

  const prevDigits = previous.replace(/\D/g, '');
  const typingForward = digits.length > prevDigits.length;

  if (digits.length <= 2) {
    if (digits.length === 2 && typingForward && !raw.trim().endsWith(':')) {
      return `${digits}:`;
    }
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

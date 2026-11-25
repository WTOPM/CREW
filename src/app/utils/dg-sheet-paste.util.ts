/** Parse Excel / sheet clipboard text into a row→column matrix. */
export function parseClipboardTsv(text: string): string[][] {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const trimmed = normalized.replace(/\n$/, '');
  if (!trimmed) return [];
  return trimmed.split('\n').map((line) => line.split('\t'));
}

/**
 * Map a pasted matrix onto a selection starting at (r0,c0).
 * - Multi-cell selection: only cells inside the selection are filled.
 * - Single-cell selection: fill down/right within the grid like Excel.
 */
export function mapPasteTargets(
  matrix: string[][],
  selection: { r0: number; r1: number; c0: number; c1: number },
  gridMax: { maxR: number; maxC: number },
): Array<{ r: number; c: number; value: string }> {
  if (!matrix.length) return [];
  const single = selection.r0 === selection.r1 && selection.c0 === selection.c1;
  const out: Array<{ r: number; c: number; value: string }> = [];

  for (let i = 0; i < matrix.length; i++) {
    const cols = matrix[i] ?? [];
    const width = Math.max(cols.length, 1);
    for (let j = 0; j < width; j++) {
      const r = selection.r0 + i;
      const c = selection.c0 + j;
      if (single) {
        if (r > gridMax.maxR || c > gridMax.maxC) continue;
      } else if (r > selection.r1 || c > selection.c1) {
        continue;
      }
      out.push({ r, c, value: cols[j] ?? '' });
    }
  }
  return out;
}

/** Set an input value so Angular `ngModel` / `(input)` handlers see the change. */
export function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Write clipboard text into a VIEW-mode DG table cell when it has an editable input. */
export function applyPasteToSheetTd(td: HTMLElement, value: string): boolean {
  const input = td.querySelector(
    [
      'input.dg-cell-input:not([readonly])',
      'textarea.dg-cell-input:not([readonly])',
      'input.cts__input:not([readonly])',
      'input.rcs__input:not([readonly])',
      '.ref-choice-suggest input:not([readonly])',
    ].join(', '),
  ) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!input || input.disabled || input.readOnly) return false;
  setNativeInputValue(input, value.trim());
  return true;
}

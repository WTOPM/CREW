import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { formatDisplayDate, parsePastedDateToIso, adjustDisplayDateSegment } from '../../utils/date.util';
import {
  EN_MONTHS,
  EN_WEEKDAYS,
  buildMonthGrid,
  partsFromIso,
  todayIsoLocal,
} from '../../utils/date-calendar.util';
import { isoFromPartialDayInput, preparePartialDateOnFocus } from '../../utils/partial-date.util';
import { ToastService } from '../../services/toast.service';

export type DatePickerSize = 'sm' | 'md' | 'lg';

/** Editable digit positions in the fixed "DD.MM.YYYY" mask (dots at 2 and 5). */
const MASK_DIGIT_POS = [0, 1, 3, 4, 6, 7, 8, 9];

function digitAtOrAfter(p: number): number {
  for (const e of MASK_DIGIT_POS) if (e >= p) return e;
  return 9;
}
function prevDigitPos(p: number): number {
  let r = 0;
  for (const e of MASK_DIGIT_POS) {
    if (e < p) r = e;
    else break;
  }
  return r;
}

function clampDaySegment(s: string): string {
  const dd = Math.min(31, Math.max(1, parseInt(s.slice(0, 2), 10) || 1));
  return String(dd).padStart(2, '0') + s.slice(2);
}
function clampMonthSegment(s: string): string {
  const mm = Math.min(12, Math.max(1, parseInt(s.slice(3, 5), 10) || 1));
  return s.slice(0, 3) + String(mm).padStart(2, '0') + s.slice(5);
}

/** Strictly validate a "DD.MM.YYYY" mask string and return ISO, or null. */
function isoFromMask(text: string): string | null {
  const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== +yyyy || d.getMonth() + 1 !== +mm || d.getDate() !== +dd) return null;
  return iso;
}

@Component({
  selector: 'app-date-picker',
  imports: [FormsModule, NgStyle],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
})
export class DatePickerComponent implements OnDestroy {
  readonly value = input('');
  readonly size = input<DatePickerSize>('md');
  readonly valueChange = output<string>();
  /** Fires when a full date is committed (blur after entry, calendar pick, Today). */
  readonly committed = output<string>();

  protected readonly weekdays = EN_WEEKDAYS;
  protected readonly copied = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly toast = inject(ToastService);
  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly open = signal(false);
  protected readonly popupStyle = signal<Record<string, string>>({});
  protected readonly text = signal('');
  /** True while the field is being edited — pauses external text syncing. */
  private readonly focused = signal(false);
  private readonly viewYear = signal(new Date().getFullYear());
  private readonly viewMonth = signal(new Date().getMonth());
  private copyPressTimer: ReturnType<typeof setTimeout> | null = null;
  private pastePressTimer: ReturnType<typeof setTimeout> | null = null;
  private copiedFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private copyPressOrigin: { x: number; y: number } | null = null;
  private pastePressOrigin: { x: number; y: number } | null = null;
  private static readonly COPY_HOLD_MS = 500;
  private static readonly COPY_MOVE_TOLERANCE_PX = 6;

  protected readonly monthTitle = computed(
    () => `${EN_MONTHS[this.viewMonth()]} ${this.viewYear()}`,
  );

  protected readonly cells = computed(() =>
    buildMonthGrid(this.viewYear(), this.viewMonth(), this.value()),
  );

  constructor() {
    effect(() => {
      const value = this.value();
      // Don't overwrite what the user is typing; resync happens on blur.
      if (!this.focused()) {
        this.text.set(formatDisplayDate(value) || '');
      }
      const parts = partsFromIso(value);
      if (parts) {
        this.viewYear.set(parts.year);
        this.viewMonth.set(parts.monthIndex);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearCopyPressTimer();
    this.clearPastePressTimer();
    if (this.copiedFeedbackTimer != null) clearTimeout(this.copiedFeedbackTimer);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    this.syncViewToValue();
    this.open.set(true);
    queueMicrotask(() => this.positionPopup());
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onFocus(): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    this.focused.set(true);

    const isEmpty = !this.value() || !/^\d{4}-\d{2}-\d{2}$/.test(this.value());
    if (isEmpty) {
      const { text, iso } = preparePartialDateOnFocus('');
      this.text.set(text);
      if (iso !== this.value()) {
        this.valueChange.emit(iso);
      }
      queueMicrotask(() => {
        el.value = text;
        this.selectSegment('day');
      });
      return;
    }

    const text = formatDisplayDate(this.value());
    this.text.set(text);
    queueMicrotask(() => {
      el.value = text;
    });
  }

  protected onInputSelect(): void {
    if (!this.focused()) return;
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    queueMicrotask(() => {
      const pos = el.selectionStart ?? 0;
      const { start, end } = this.segmentBounds(pos);
      el.setSelectionRange(start, end);
    });
  }

  protected onBlur(): void {
    this.onCopyPressEnd();
    this.focused.set(false);
    const el = this.fieldRef()?.nativeElement;
    const current = this.ensureMaskText(el?.value ?? this.text());
    const clamped = clampMonthSegment(clampDaySegment(current));
    const iso = isoFromMask(clamped);
    if (iso) {
      if (iso !== this.value()) this.valueChange.emit(iso);
      this.text.set(formatDisplayDate(iso));
      this.committed.emit(iso);
    } else {
      this.text.set(formatDisplayDate(this.value()) || '');
    }
  }

  /**
   * Segmented keyboard entry for the "DD.MM.YYYY" mask: each digit overtypes the
   * caret position and advances to the next digit, skipping the dots.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    const key = event.key;
    const pos = el.selectionStart ?? 0;

    if (key >= '0' && key <= '9') {
      event.preventDefault();
      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? selStart;
      const selLen = selEnd - selStart;
      let s = this.ensureMaskText(el.value);

      if (selLen >= 2) {
        const seg = this.segmentBounds(selStart);
        if (selStart >= seg.start && selEnd <= seg.end) {
          const writePos = selLen === seg.end - seg.start ? seg.start : selStart;
          s = s.slice(0, writePos) + key + s.slice(writePos + 1);
          if (writePos <= 1) s = clampDaySegment(s);
          else if (writePos >= 3 && writePos <= 4) s = clampMonthSegment(s);
          el.value = s;
          this.text.set(s);
          this.emitFromMask(s);

          const nextPos = writePos + 1;
          if (nextPos < seg.end) {
            el.setSelectionRange(nextPos, nextPos + 1);
          } else if (seg.start === 0) {
            this.selectSegment('month');
          } else if (seg.start === 3) {
            this.selectSegment('year');
          } else {
            this.finishEntry(s);
          }
          return;
        }
      }

      const writePos = digitAtOrAfter(selStart);
      s = s.slice(0, writePos) + key + s.slice(writePos + 1);
      if (writePos <= 1) s = clampDaySegment(s);
      else if (writePos >= 3 && writePos <= 4) s = clampMonthSegment(s);
      const nextCaret = this.nextCaretAfter(writePos);
      if (nextCaret === null) {
        this.finishEntry(s);
      } else {
        this.writeMask(s, nextCaret);
        this.emitFromMask(s);
      }
      return;
    }

    if (key === 'ArrowLeft') {
      event.preventDefault();
      const seg = this.segmentBounds(pos);
      if (seg.start >= 6) this.selectSegment('month');
      else this.selectSegment('day');
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      const seg = this.segmentBounds(pos);
      if (seg.start === 0) this.selectSegment('month');
      else this.selectSegment('year');
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const delta = key === 'ArrowUp' ? 1 : -1;
      const seg = this.segmentBounds(pos);
      const which: 'day' | 'month' | 'year' =
        seg.start === 0 ? 'day' : seg.start === 3 ? 'month' : 'year';
      const current = clampMonthSegment(clampDaySegment(this.ensureMaskText(el.value)));
      const next = adjustDisplayDateSegment(current, which, delta);
      if (!next) return;
      el.value = next;
      this.text.set(next);
      this.emitFromMask(next);
      queueMicrotask(() => this.selectSegment(which));
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      this.selectDigit(prevDigitPos(pos));
      return;
    }
    if (key === 'Home') {
      event.preventDefault();
      this.selectDigit(0);
      return;
    }
    if (key === 'End') {
      event.preventDefault();
      this.selectDigit(9);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      this.close();
      el.blur();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'v') {
      return;
    }
    // Let navigation / shortcuts through; block letters, dots, spaces, etc.
    if (key === 'Tab' || key === 'Escape' || event.ctrlKey || event.metaKey) {
      return;
    }
    if (
      key.startsWith('Arrow') ||
      key === 'Backspace' ||
      key === 'Delete' ||
      key === 'Home' ||
      key === 'End' ||
      key === 'Enter'
    ) {
      return;
    }
    event.preventDefault();
  }

  /** Current input as a valid mask string, or a freshly prefilled one. */
  private ensureMaskText(v: string): string {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return v;
    const val = this.value();
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDisplayDate(val);
    return preparePartialDateOnFocus('').text;
  }

  private segmentBounds(pos: number): { start: number; end: number } {
    if (pos <= 2) return { start: 0, end: 2 };
    if (pos <= 5) return { start: 3, end: 5 };
    return { start: 6, end: 10 };
  }

  private selectSegment(which: 'day' | 'month' | 'year' | number): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    let start: number;
    let end: number;
    if (which === 'day') {
      start = 0;
      end = 2;
    } else if (which === 'month') {
      start = 3;
      end = 5;
    } else if (which === 'year') {
      start = 6;
      end = 10;
    } else {
      ({ start, end } = this.segmentBounds(which));
    }
    el.setSelectionRange(start, end);
  }

  /** Set the input value + highlight the digit at `caret` (imperative; no caret jumps). */
  private nextCaretAfter(writePos: number): number | null {
    const seg = this.segmentBounds(writePos);
    const nextPos = writePos + 1;
    if (nextPos < seg.end) return nextPos;
    if (seg.start === 0) return 3;
    if (seg.start === 3) return 6;
    return null;
  }

  private finishEntry(text: string): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    const clamped = clampMonthSegment(clampDaySegment(text));
    el.value = clamped;
    this.text.set(clamped);
    this.emitFromMask(clamped);
    queueMicrotask(() => el.blur());
  }

  private writeMask(text: string, caret: number): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    el.value = text;
    this.text.set(text);
    const c = Math.max(0, Math.min(9, caret));
    el.setSelectionRange(c, c + 1);
  }

  private selectDigit(pos: number): void {
    const el = this.fieldRef()?.nativeElement;
    if (el) el.setSelectionRange(pos, pos + 1);
  }

  private emitFromMask(text: string): void {
    const iso = isoFromMask(text);
    if (!iso) return;
    if (iso !== this.value()) this.valueChange.emit(iso);
    const parts = partsFromIso(iso);
    if (parts) {
      this.viewYear.set(parts.year);
      this.viewMonth.set(parts.monthIndex);
    }
  }

  protected onTextChange(raw: string): void {
    const iso = isoFromPartialDayInput(raw, this.value());
    this.text.set(formatDisplayDate(iso) || raw);
    if (iso) {
      this.valueChange.emit(iso);
      const parts = partsFromIso(iso);
      if (parts) {
        this.viewYear.set(parts.year);
        this.viewMonth.set(parts.monthIndex);
      }
    }
  }

  protected prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  protected selectIso(iso: string): void {
    if (!iso) return;
    this.valueChange.emit(iso);
    this.committed.emit(iso);
    this.text.set(formatDisplayDate(iso));
    this.close();
  }

  protected selectToday(): void {
    this.selectIso(todayIsoLocal());
  }

  protected clear(): void {
    this.valueChange.emit('');
    this.committed.emit('');
    this.text.set('');
    this.close();
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const raw = event.clipboardData?.getData('text/plain') ?? '';
    this.applyPastedText(raw, false);
  }

  protected onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onCopyPressStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button === 2) {
      this.clearCopyPressTimer();
      this.clearPastePressTimer();
      this.pastePressOrigin = { x: event.clientX, y: event.clientY };
      this.pastePressTimer = setTimeout(() => {
        this.pastePressTimer = null;
        this.pastePressOrigin = null;
        void this.pasteFromClipboard(true);
      }, DatePickerComponent.COPY_HOLD_MS);
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.clearCopyPressTimer();
    this.copyPressOrigin = { x: event.clientX, y: event.clientY };
    this.copyPressTimer = setTimeout(() => {
      this.copyPressTimer = null;
      this.copyPressOrigin = null;
      void this.copyDisplayedDate();
    }, DatePickerComponent.COPY_HOLD_MS);
  }

  protected onCopyPressMove(event: PointerEvent): void {
    if (this.pastePressTimer && this.pastePressOrigin) {
      const dx = event.clientX - this.pastePressOrigin.x;
      const dy = event.clientY - this.pastePressOrigin.y;
      if (Math.hypot(dx, dy) > DatePickerComponent.COPY_MOVE_TOLERANCE_PX) {
        this.onCopyPressEnd();
      }
      return;
    }
    if (!this.copyPressTimer || !this.copyPressOrigin) return;
    const dx = event.clientX - this.copyPressOrigin.x;
    const dy = event.clientY - this.copyPressOrigin.y;
    if (Math.hypot(dx, dy) > DatePickerComponent.COPY_MOVE_TOLERANCE_PX) {
      this.onCopyPressEnd();
    }
  }

  protected onCopyPressEnd(): void {
    this.clearCopyPressTimer();
    this.clearPastePressTimer();
    this.copyPressOrigin = null;
    this.pastePressOrigin = null;
  }

  private clearPastePressTimer(): void {
    if (this.pastePressTimer == null) return;
    clearTimeout(this.pastePressTimer);
    this.pastePressTimer = null;
  }

  private async pasteFromClipboard(showToast: boolean): Promise<void> {
    let raw = '';
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      return;
    }
    this.applyPastedText(raw, showToast);
  }

  private applyPastedText(raw: string, showToast: boolean): void {
    const iso = parsePastedDateToIso(raw);
    if (!iso) return;

    const mask = formatDisplayDate(iso);
    if (!mask || !isoFromMask(mask)) return;

    const el = this.fieldRef()?.nativeElement;
    if (el) el.value = mask;
    this.text.set(mask);
    if (iso !== this.value()) this.valueChange.emit(iso);
    this.committed.emit(iso);

    const parts = partsFromIso(iso);
    if (parts) {
      this.viewYear.set(parts.year);
      this.viewMonth.set(parts.monthIndex);
    }

    if (showToast) {
      this.flashCopiedFeedback();
      this.toast.show(`Pasted: ${mask}`, 'success', 1800);
    }

    queueMicrotask(() => el?.blur());
  }

  private clearCopyPressTimer(): void {
    if (this.copyPressTimer == null) return;
    clearTimeout(this.copyPressTimer);
    this.copyPressTimer = null;
  }

  private displayTextForCopy(): string {
    const fromValue = formatDisplayDate(this.value());
    if (fromValue && isoFromMask(fromValue)) return fromValue;

    const el = this.fieldRef()?.nativeElement;
    const fromInput = this.ensureMaskText(el?.value ?? this.text());
    if (isoFromMask(fromInput)) return fromInput;

    return '';
  }

  private async copyDisplayedDate(): Promise<void> {
    const display = this.displayTextForCopy();
    if (!display) return;

    try {
      await navigator.clipboard.writeText(display);
    } catch {
      const el = document.createElement('textarea');
      el.value = display;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }

    this.flashCopiedFeedback();
    this.toast.show(`Copied: ${display}`, 'success', 1800);
  }

  private flashCopiedFeedback(): void {
    this.copied.set(true);
    if (this.copiedFeedbackTimer != null) clearTimeout(this.copiedFeedbackTimer);
    this.copiedFeedbackTimer = setTimeout(() => {
      this.copied.set(false);
      this.copiedFeedbackTimer = null;
    }, 550);
  }

  private popupWidth(): number {
    switch (this.size()) {
      case 'lg':
        return 352;
      case 'sm':
        return 272;
      default:
        return 320;
    }
  }

  private positionPopup(): void {
    const row = this.host.nativeElement.querySelector('.date-picker-row');
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const width = this.popupWidth();
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, rect.right - width);
    }
    left = Math.max(8, left);

    const popup = this.host.nativeElement.querySelector('.date-picker-popup') as HTMLElement | null;
    const height =
      popup?.offsetHeight ??
      (this.size() === 'lg' ? 360 : this.size() === 'sm' ? 268 : 330);

    const gap = 6;
    const margin = 8;
    const below = window.innerHeight - rect.bottom;
    let top: number;
    if (below >= height + gap) {
      top = rect.bottom + gap;
    } else if (rect.top >= height + gap) {
      top = rect.top - height - gap;
    } else {
      top = Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - height - margin));
    }

    this.popupStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `calc(100dvh - ${top + margin}px)`,
      overflowY: 'auto',
    });
  }

  private syncViewToValue(): void {
    const parts = partsFromIso(this.value());
    if (parts) {
      this.viewYear.set(parts.year);
      this.viewMonth.set(parts.monthIndex);
      return;
    }
    const now = new Date();
    this.viewYear.set(now.getFullYear());
    this.viewMonth.set(now.getMonth());
  }
}

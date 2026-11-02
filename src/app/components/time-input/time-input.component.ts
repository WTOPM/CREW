import { Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TIME_EMPTY_MASK,
  adjustTimeMaskSegment,
  clampHoursSegment,
  clampMinutesSegment,
  clearTimeMaskByBackspace,
  digitAtOrAfterTime,
  ensureTimeMaskText,
  isTimeMaskEmpty,
  prepareTimeOnFocus,
  timeFromMask,
  timeSegmentBounds,
} from '../../utils/time-input.util';

@Component({
  selector: 'app-time-input',
  imports: [FormsModule],
  host: {
    '[class.time-input-host--lg]': 'size() === "lg"',
  },
  template: `
    <input
      #field
      class="time-input"
      [class.time-input--empty]="showingEmptyMask()"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [placeholder]="emptyPlaceholder"
      maxlength="5"
      [ngModel]="text()"
      (ngModelChange)="onTextChange($event)"
      (focus)="onFocus()"
      (blur)="onBlur()"
      (mouseup)="onInputSelect()"
      (keydown)="onKeydown($event)"
    />
  `,
  styles: `
    .time-input {
      width: 100%;
      min-width: 0;
      padding: 0.35rem 0.45rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.8rem;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }

    .time-input--empty {
      color: #94a3b8;
    }

    .time-input:focus {
      outline: 2px solid var(--accent-soft);
      border-color: var(--accent);
      color: inherit;
    }

    :host(.time-input-host--lg) .time-input {
      padding: 0.55rem 0.65rem;
      border-radius: 8px;
      font-size: 1.05rem;
      font-weight: 500;
    }

    :host(.eta-sched-time) .time-input {
      color: #047857;
      font-weight: 600;
    }

    :host(.eta-sched-time.time-input-host--lg) .time-input {
      font-weight: 600;
    }
  `,
})
export class TimeInputComponent {
  readonly value = input('');
  readonly size = input<'md' | 'lg'>('md');
  readonly valueChange = output<string>();

  protected readonly emptyPlaceholder = TIME_EMPTY_MASK;

  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');
  protected readonly text = signal('');
  private readonly focused = signal(false);

  constructor() {
    effect(() => {
      const value = this.value();
      if (!this.focused()) {
        this.text.set(value && /^\d{2}:\d{2}$/.test(value) ? value : TIME_EMPTY_MASK);
      }
    });
  }

  protected showingEmptyMask(): boolean {
    return !this.value() || !/^\d{2}:\d{2}$/.test(this.value());
  }

  protected onFocus(): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    this.focused.set(true);

    const isEmpty = !this.value() || !/^\d{2}:\d{2}$/.test(this.value());
    if (isEmpty) {
      const { text, value } = prepareTimeOnFocus('');
      this.text.set(text);
      if (value !== this.value()) {
        this.valueChange.emit(value);
      }
      queueMicrotask(() => {
        el.value = text;
        this.selectSegment('hours');
      });
      return;
    }

    const text = this.value();
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
      const { start, end } = timeSegmentBounds(pos);
      el.setSelectionRange(start, end);
    });
  }

  protected onBlur(): void {
    this.focused.set(false);
    const el = this.fieldRef()?.nativeElement;
    const raw = (el?.value ?? this.text()).trim();
    if (!raw || isTimeMaskEmpty(raw)) {
      this.text.set(TIME_EMPTY_MASK);
      if (this.value()) this.valueChange.emit('');
      return;
    }
    const current = ensureTimeMaskText(raw, this.value());
    if (!/^\d{2}:\d{2}$/.test(current)) {
      // Incomplete clear — restore last committed value (or empty mask).
      this.text.set(
        this.value() && /^\d{2}:\d{2}$/.test(this.value()) ? this.value() : TIME_EMPTY_MASK,
      );
      return;
    }
    const clamped = clampMinutesSegment(clampHoursSegment(current));
    const normalized = timeFromMask(clamped);
    if (normalized) {
      if (normalized !== this.value()) this.valueChange.emit(normalized);
      this.text.set(normalized);
    } else {
      this.text.set(
        this.value() && /^\d{2}:\d{2}$/.test(this.value()) ? this.value() : TIME_EMPTY_MASK,
      );
    }
  }

  protected onTextChange(raw: string): void {
    const mask = ensureTimeMaskText(raw, this.value());
    if (isTimeMaskEmpty(mask)) {
      this.text.set(TIME_EMPTY_MASK);
      if (this.value()) this.valueChange.emit('');
      return;
    }
    const normalized = timeFromMask(mask);
    if (normalized) {
      this.text.set(normalized);
      if (normalized !== this.value()) this.valueChange.emit(normalized);
    } else {
      this.text.set(mask);
    }
  }

  /** Segmented keyboard entry for "HH:MM": 2-digit segments; blur after minutes. */
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
      let s = ensureTimeMaskText(el.value, this.value());

      if (selLen >= 2) {
        const seg = timeSegmentBounds(selStart);
        if (selStart >= seg.start && selEnd <= seg.end) {
          const writePos = selLen === seg.end - seg.start ? seg.start : selStart;
          s = s.slice(0, writePos) + key + s.slice(writePos + 1);
          if (writePos <= 1) s = clampHoursSegment(s);
          else s = clampMinutesSegment(s);
          el.value = s;
          this.text.set(s);
          this.emitFromMask(s);

          const nextPos = writePos + 1;
          if (nextPos < seg.end) {
            el.setSelectionRange(nextPos, nextPos + 1);
          } else if (seg.start === 0) {
            this.selectSegment('minutes');
          } else {
            this.finishEntry(s);
          }
          return;
        }
      }

      const writePos = digitAtOrAfterTime(selStart);
      s = s.slice(0, writePos) + key + s.slice(writePos + 1);
      if (writePos <= 1) s = clampHoursSegment(s);
      else s = clampMinutesSegment(s);
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
      this.selectSegment('hours');
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      this.selectSegment('minutes');
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const delta = key === 'ArrowUp' ? 1 : -1;
      const seg = timeSegmentBounds(pos);
      const which: 'hours' | 'minutes' = seg.start === 0 ? 'hours' : 'minutes';
      this.nudgeSegment(which, delta);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      const current = ensureTimeMaskText(el.value, this.value());
      const cleared = clearTimeMaskByBackspace(current);
      if (cleared.select === 'empty') {
        el.value = TIME_EMPTY_MASK;
        this.text.set(TIME_EMPTY_MASK);
        if (this.value()) this.valueChange.emit('');
        queueMicrotask(() => this.selectSegment('hours'));
        return;
      }
      el.value = cleared.text;
      this.text.set(cleared.text);
      // Partial clear is not a valid HH:MM — clear committed value until complete again.
      if (this.value()) this.valueChange.emit('');
      const select = cleared.select;
      queueMicrotask(() => this.selectSegment(select));
      return;
    }
    if (key === 'Home') {
      event.preventDefault();
      this.selectDigit(0);
      return;
    }
    if (key === 'End') {
      event.preventDefault();
      this.selectDigit(4);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      el.blur();
      return;
    }
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

  private nudgeSegment(which: 'hours' | 'minutes', delta: number): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    const base = ensureTimeMaskText(el.value || this.text(), this.value());
    if (!timeFromMask(base)) {
      // Empty / partial — seed from 00:00 only for arrow nudge, don't persist until blur-complete.
      const seeded = which === 'hours' ? '00:00' : '00:00';
      const next = adjustTimeMaskSegment(seeded, which, delta);
      if (!next) {
        queueMicrotask(() => this.selectSegment(which));
        return;
      }
      el.value = next;
      this.text.set(next);
      this.emitFromMask(next);
      queueMicrotask(() => this.selectSegment(which));
      return;
    }
    const current = clampMinutesSegment(clampHoursSegment(base));
    const next = adjustTimeMaskSegment(current, which, delta);
    if (!next || next === current) {
      queueMicrotask(() => this.selectSegment(which));
      return;
    }
    el.value = next;
    this.text.set(next);
    this.emitFromMask(next);
    queueMicrotask(() => this.selectSegment(which));
  }

  private nextCaretAfter(writePos: number): number | null {
    const seg = timeSegmentBounds(writePos);
    const nextPos = writePos + 1;
    if (nextPos < seg.end) return nextPos;
    if (seg.start === 0) return 3;
    return null;
  }

  private finishEntry(text: string): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    if (!timeFromMask(text)) {
      el.value = text;
      this.text.set(text);
      return;
    }
    el.value = text;
    this.text.set(text);
    this.emitFromMask(text);
    queueMicrotask(() => el.blur());
  }

  private selectSegment(which: 'hours' | 'minutes' | number): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    let start: number;
    let end: number;
    if (which === 'hours') {
      start = 0;
      end = 2;
    } else if (which === 'minutes') {
      start = 3;
      end = 5;
    } else {
      ({ start, end } = timeSegmentBounds(which));
    }
    el.setSelectionRange(start, end);
  }

  private writeMask(text: string, caret: number): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;
    el.value = text;
    this.text.set(text);
    const c = Math.max(0, Math.min(4, caret));
    el.setSelectionRange(c, c + 1);
  }

  private selectDigit(pos: number): void {
    const el = this.fieldRef()?.nativeElement;
    if (el) el.setSelectionRange(pos, pos + 1);
  }

  private emitFromMask(text: string): void {
    const normalized = timeFromMask(text);
    if (!normalized) return;
    if (normalized !== this.value()) this.valueChange.emit(normalized);
  }
}

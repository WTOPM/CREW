import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  clampHoursSegment,
  clampMinutesSegment,
  digitAtOrAfterTime,
  ensureTimeMaskText,
  prepareTimeOnFocus,
  prevTimeDigitPos,
  timeFromMask,
  timeSegmentBounds,
} from '../../utils/time-input.util';

@Component({
  selector: 'app-time-input',
  imports: [FormsModule],
  template: `
    <input
      #field
      class="time-input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="HH:MM"
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

    .time-input:focus {
      outline: 2px solid var(--accent-soft);
      border-color: var(--accent);
    }
  `,
})
export class TimeInputComponent {
  readonly value = input('');
  readonly valueChange = output<string>();

  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');
  protected readonly text = signal('');
  private readonly focused = signal(false);

  constructor() {
    effect(() => {
      const value = this.value();
      if (!this.focused()) {
        this.text.set(value && /^\d{2}:\d{2}$/.test(value) ? value : '');
      }
    });
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
    const current = ensureTimeMaskText(el?.value ?? this.text(), this.value());
    const clamped = clampMinutesSegment(clampHoursSegment(current));
    const normalized = timeFromMask(clamped);
    if (normalized) {
      if (normalized !== this.value()) this.valueChange.emit(normalized);
      this.text.set(normalized);
    } else {
      this.text.set(this.value() || '');
    }
  }

  protected onTextChange(raw: string): void {
    const normalized = timeFromMask(ensureTimeMaskText(raw, this.value()));
    if (normalized) {
      this.text.set(normalized);
      if (normalized !== this.value()) this.valueChange.emit(normalized);
    } else {
      this.text.set(raw);
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
      const seg = timeSegmentBounds(pos);
      if (pos <= seg.start) {
        if (seg.start === 3) this.selectSegment('hours');
      } else {
        this.selectSegment(seg.start);
      }
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      const seg = timeSegmentBounds(pos);
      if (pos >= seg.end - 1) {
        if (seg.start === 0) this.selectSegment('minutes');
      } else {
        this.selectSegment(seg.end - 1);
      }
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      this.selectDigit(prevTimeDigitPos(pos));
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
    if (key === 'Tab' || key === 'Escape' || key.length > 1 || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
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

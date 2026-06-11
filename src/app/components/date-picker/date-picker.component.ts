import {
  Component,
  ElementRef,
  HostListener,
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
import { formatDisplayDate } from '../../utils/date.util';
import {
  EN_MONTHS,
  EN_WEEKDAYS,
  buildMonthGrid,
  partsFromIso,
  todayIsoLocal,
} from '../../utils/date-calendar.util';
import { isoFromPartialDayInput, preparePartialDateOnFocus } from '../../utils/partial-date.util';

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
  template: `
    <div
      class="date-picker"
      [class.date-picker--sm]="size() === 'sm'"
      [class.date-picker--lg]="size() === 'lg'"
    >
      <div class="date-picker-row">
        <input
          #field
          class="date-picker-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="DD.MM.YYYY"
          maxlength="10"
          [ngModel]="text()"
          (ngModelChange)="onTextChange($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (mouseup)="onInputSelect()"
          (keydown)="onKeydown($event)"
          (keydown.escape)="close()"
        />
        <button
          type="button"
          class="date-picker-btn"
          aria-label="Open calendar"
          [attr.aria-expanded]="open()"
          (click)="toggle($event)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12.5 6H4.5v11.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5V8ZM8 11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-8 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
            />
          </svg>
        </button>
      </div>

      @if (open()) {
        <div class="date-picker-popup" role="dialog" aria-label="Choose date" [ngStyle]="popupStyle()">
          <div class="cal-head">
            <button type="button" class="cal-nav" (click)="prevMonth()" aria-label="Previous month">‹</button>
            <div class="cal-title">{{ monthTitle() }}</div>
            <button type="button" class="cal-nav" (click)="nextMonth()" aria-label="Next month">›</button>
          </div>
          <div class="cal-weekdays">
            @for (wd of weekdays; track wd) {
              <span>{{ wd }}</span>
            }
          </div>
          <div class="cal-grid">
            @for (cell of cells(); track cell.key) {
              <button
                type="button"
                class="cal-day"
                [class.cal-day--outside]="!cell.inMonth"
                [class.cal-day--today]="cell.isToday"
                [class.cal-day--selected]="cell.isSelected"
                (click)="selectIso(cell.iso)"
              >
                {{ cell.day }}
              </button>
            }
          </div>
          <div class="cal-foot">
            <button type="button" class="cal-foot-btn" (click)="selectToday()">Today</button>
            <button type="button" class="cal-foot-btn cal-foot-btn--muted" (click)="clear()">Clear</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .date-picker {
      position: relative;
      width: 100%;
    }

    .date-picker-row {
      display: flex;
      align-items: stretch;
      gap: 0.35rem;
    }

    .date-picker-input {
      flex: 1;
      min-width: 0;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
      font-size: 0.95rem;
      background: #fff;
    }

    .date-picker-input:focus {
      outline: 2px solid var(--accent-soft);
      border-color: var(--accent);
    }

    .date-picker-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 2.5rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--accent-soft);
      color: var(--accent);
      cursor: pointer;
    }

    .date-picker-btn:hover {
      background: #bae6fd;
    }

    .date-picker--sm .date-picker-input {
      padding: 0.35rem 0.45rem;
      font-size: 0.8rem;
      border-radius: 4px;
    }

    .date-picker--sm .date-picker-btn {
      width: 2rem;
      border-radius: 4px;
    }

    .date-picker--sm .date-picker-btn svg {
      width: 16px;
      height: 16px;
    }

    .date-picker--lg .date-picker-input {
      min-height: 2.65rem;
      padding: 0.6rem 0.75rem;
      font-size: 1.05rem;
      font-weight: 500;
    }

    .date-picker--lg .date-picker-btn {
      width: 2.85rem;
      min-height: 2.65rem;
    }

    .date-picker--lg .date-picker-btn svg {
      width: 22px;
      height: 22px;
    }

    .date-picker-popup {
      z-index: 2000;
      min-width: 20rem;
      padding: 0.85rem;
      border: 1px solid #93c5fd;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
    }

    .date-picker--lg .date-picker-popup {
      min-width: 22rem;
      padding: 1rem;
    }

    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .cal-title {
      font-weight: 700;
      font-size: 1rem;
      color: #0f172a;
      text-align: center;
      flex: 1;
    }

    .date-picker--lg .cal-title {
      font-size: 1.1rem;
    }

    .cal-nav {
      width: 2.25rem;
      height: 2.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #f8fafc;
      font-size: 1.35rem;
      line-height: 1;
      cursor: pointer;
      color: var(--accent);
    }

    .cal-nav:hover {
      background: var(--accent-soft);
    }

    .cal-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.2rem;
      margin-bottom: 0.35rem;
      text-align: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }

    .date-picker--lg .cal-weekdays {
      font-size: 0.78rem;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.2rem;
    }

    .cal-day {
      aspect-ratio: 1;
      min-height: 2rem;
      border: 1px solid transparent;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      color: #0f172a;
    }

    .date-picker--lg .cal-day {
      min-height: 2.35rem;
      font-size: 1rem;
    }

    .cal-day:hover {
      background: var(--accent-soft);
      border-color: #93c5fd;
    }

    .cal-day--outside {
      color: #94a3b8;
      background: #fff;
    }

    .cal-day--today {
      border-color: var(--accent);
    }

    .cal-day--selected {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .cal-day--selected:hover {
      background: #0284c7;
    }

    .cal-foot {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.65rem;
      border-top: 1px solid var(--border);
    }

    .cal-foot-btn {
      flex: 1;
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .cal-foot-btn:hover {
      background: #bae6fd;
    }

    .cal-foot-btn--muted {
      border-color: var(--border);
      background: #f8fafc;
      color: #64748b;
    }
  `,
})
export class DatePickerComponent {
  readonly value = input('');
  readonly size = input<DatePickerSize>('md');
  readonly valueChange = output<string>();

  protected readonly weekdays = EN_WEEKDAYS;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly open = signal(false);
  protected readonly popupStyle = signal<Record<string, string>>({});
  protected readonly text = signal('');
  /** True while the field is being edited — pauses external text syncing. */
  private readonly focused = signal(false);
  private readonly viewYear = signal(new Date().getFullYear());
  private readonly viewMonth = signal(new Date().getMonth());

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
    this.focused.set(false);
    const el = this.fieldRef()?.nativeElement;
    const current = this.ensureMaskText(el?.value ?? this.text());
    const clamped = clampMonthSegment(clampDaySegment(current));
    const iso = isoFromMask(clamped);
    if (iso) {
      if (iso !== this.value()) this.valueChange.emit(iso);
      this.text.set(formatDisplayDate(iso));
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
      if (pos <= seg.start) {
        if (seg.start === 3) this.selectSegment('day');
        else if (seg.start === 6) this.selectSegment('month');
      } else {
        this.selectSegment(seg.start);
      }
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      const seg = this.segmentBounds(pos);
      if (pos >= seg.end - 1) {
        if (seg.start === 0) this.selectSegment('month');
        else if (seg.start === 3) this.selectSegment('year');
      } else {
        this.selectSegment(seg.end - 1);
      }
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
    // Let navigation / shortcuts through; block letters, dots, spaces, etc.
    if (key === 'Tab' || key === 'Escape' || key.length > 1 || event.ctrlKey || event.metaKey) {
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
    this.text.set(formatDisplayDate(iso));
    this.close();
  }

  protected selectToday(): void {
    this.selectIso(todayIsoLocal());
  }

  protected clear(): void {
    this.valueChange.emit('');
    this.text.set('');
    this.close();
  }

  private positionPopup(): void {
    const row = this.host.nativeElement.querySelector('.date-picker-row');
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const minW = this.size() === 'lg' ? 352 : this.size() === 'sm' ? 280 : 320;
    const width = Math.max(rect.width, minW);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const estimatedHeight = this.size() === 'lg' ? 360 : 330;
    const below = window.innerHeight - rect.bottom;
    const top =
      below >= estimatedHeight + 8 ? rect.bottom + 6 : Math.max(8, rect.top - estimatedHeight - 6);
    this.popupStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${Math.max(8, left)}px`,
      width: `${width}px`,
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

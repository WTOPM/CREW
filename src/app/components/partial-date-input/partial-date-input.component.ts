import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDisplayDate } from '../../utils/date.util';
import { isoFromPartialDayInput, preparePartialDateOnFocus } from '../../utils/partial-date.util';

@Component({
  selector: 'app-partial-date-input',
  imports: [FormsModule],
  template: `
    <input
      #field
      class="partial-date-input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [ngModel]="text"
      (ngModelChange)="onTextChange($event)"
      (focus)="onFocus()"
      placeholder="DD.MM.YYYY"
      maxlength="10"
    />
  `,
  styles: `
    .partial-date-input {
      width: 100%;
      min-width: 6.5rem;
      padding: 0.35rem 0.45rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.8rem;
      box-sizing: border-box;
    }
  `,
})
export class PartialDateInputComponent {
  readonly value = input('');
  readonly valueChange = output<string>();

  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');
  protected text = '';

  constructor() {
    effect(() => {
      this.text = formatDisplayDate(this.value()) || '';
    });
  }

  protected onFocus(): void {
    const el = this.fieldRef()?.nativeElement;
    if (!el) return;

    const { text, iso } = preparePartialDateOnFocus(this.value());
    this.text = text;
    if (iso !== this.value()) {
      this.valueChange.emit(iso);
    }

    setTimeout(() => el.setSelectionRange(0, 2), 0);
  }

  protected onTextChange(raw: string): void {
    const iso = isoFromPartialDayInput(raw, this.value());
    this.text = formatDisplayDate(iso) || raw;
    if (iso) {
      this.valueChange.emit(iso);
    }
  }
}

import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatTimeInput } from '../../utils/time-input.util';

@Component({
  selector: 'app-time-input',
  imports: [FormsModule],
  template: `
    <input
      class="time-input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [ngModel]="display()"
      (ngModelChange)="onChange($event)"
      placeholder="HH:MM"
      maxlength="5"
    />
  `,
  styles: `
    .time-input {
      width: 100%;
      min-width: 4.5rem;
      padding: 0.35rem 0.45rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.8rem;
      box-sizing: border-box;
    }
  `,
})
export class TimeInputComponent {
  readonly value = input('');
  readonly valueChange = output<string>();

  private lastFormatted = '';

  constructor() {
    effect(() => {
      this.lastFormatted = this.value();
    });
  }

  protected display(): string {
    return this.value();
  }

  protected onChange(raw: string): void {
    const formatted = formatTimeInput(raw, this.lastFormatted);
    this.lastFormatted = formatted;
    this.valueChange.emit(formatted);
  }
}

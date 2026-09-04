import { Component, input, output } from '@angular/core';
import { DatePickerComponent } from '../date-picker/date-picker.component';

/** Compact date field with English calendar (Port of Call table). */
@Component({
  selector: 'app-partial-date-input',
  imports: [DatePickerComponent],
  template: `
    <app-date-picker
      size="sm"
      [value]="value()"
      (valueChange)="valueChange.emit($event)"
      (committed)="committed.emit($event)"
    />
  `,
})
export class PartialDateInputComponent {
  readonly value = input('');
  readonly valueChange = output<string>();
  /** Prefer this for persist/toast — fires on blur / calendar pick, not every digit. */
  readonly committed = output<string>();
}

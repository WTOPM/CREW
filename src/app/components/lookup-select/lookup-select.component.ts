import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lookup-select',
  imports: [FormsModule],
  template: `
    <select
      class="lookup-select"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    >
      <option value="">— select —</option>
      @for (opt of options(); track opt) {
        <option [value]="opt">{{ opt }}</option>
      }
    </select>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .lookup-select {
      width: 100%;
    }
  `,
})
export class LookupSelectComponent {
  readonly value = input('');
  readonly options = input<string[]>([]);
  readonly valueChange = output<string>();
}

import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lookup-select',
  imports: [FormsModule],
  template: `
    <input
      class="lookup-select"
      type="text"
      autocomplete="off"
      [attr.list]="listId"
      placeholder="Type or pick…"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    />
    <datalist [id]="listId">
      @for (opt of options(); track opt) {
        <option [value]="opt"></option>
      }
    </datalist>
  `,
  styles: `
    .lookup-select {
      width: 100%;
    }
  `,
})
export class LookupSelectComponent {
  private static seq = 0;
  protected readonly listId = `lookup-list-${++LookupSelectComponent.seq}`;

  readonly value = input('');
  readonly options = input<string[]>([]);
  readonly valueChange = output<string>();
}

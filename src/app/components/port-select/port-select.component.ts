import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Port, portLabel } from '../../models/crew.models';

@Component({
  selector: 'app-port-select',
  imports: [FormsModule],
  template: `
    <input
      class="port-select"
      type="text"
      autocomplete="off"
      [attr.list]="listId"
      placeholder="Type or pick port…"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    />
    <datalist [id]="listId">
      @for (p of ports(); track p.name) {
        <option [value]="p.name" [label]="label(p)"></option>
      }
    </datalist>
  `,
  styles: `
    .port-select {
      width: 100%;
    }
  `,
})
export class PortSelectComponent {
  private static seq = 0;
  protected readonly listId = `port-list-${++PortSelectComponent.seq}`;

  readonly value = input('');
  readonly ports = input<Port[]>([]);
  readonly valueChange = output<string>();

  protected label = portLabel;
}

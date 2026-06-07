import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Port, portLabel } from '../../models/crew.models';

@Component({
  selector: 'app-port-select',
  imports: [FormsModule],
  template: `
    <select
      class="port-select"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    >
      <option value="">— select port —</option>
      @for (p of ports(); track p.name) {
        <option [value]="p.name">{{ label(p) }}</option>
      }
    </select>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .port-select {
      width: 100%;
    }
  `,
})
export class PortSelectComponent {
  readonly value = input('');
  readonly ports = input<Port[]>([]);
  readonly valueChange = output<string>();

  protected label = portLabel;
}

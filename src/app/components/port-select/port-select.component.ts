import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Port, portLabel } from '../../models/crew.models';

@Component({
  selector: 'app-port-select',
  imports: [FormsModule],
  template: `
    <select class="port-select" [ngModel]="value()" (ngModelChange)="valueChange.emit($event)">
      <option value="">— выберите —</option>
      @for (p of ports(); track p.name) {
        <option [value]="p.name">{{ label(p) }}</option>
      }
      @if (value() && !hasPort(value())) {
        <option [value]="value()">{{ value() }}</option>
      }
    </select>
  `,
  styles: `
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

  protected hasPort(name: string): boolean {
    return this.ports().some((p) => p.name === name);
  }
}

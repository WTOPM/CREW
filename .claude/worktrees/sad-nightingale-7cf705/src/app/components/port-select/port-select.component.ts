import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Port, portLabel } from '../../models/crew.models';

@Component({
  selector: 'app-port-select',
  imports: [FormsModule],
  template: `
    <select
      class="port-select"
      [class.port-select--compact]="compact()"
      [title]="compact() ? compactTitle() : ''"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    >
      <option value="">{{ compact() ? '—' : '— select port —' }}</option>
      @for (p of ports(); track p.name) {
        <option [value]="p.name">{{ compact() ? portCodeLabel(p) : label(p) }}</option>
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

    .port-select--compact {
      font-size: 0.73rem;
      font-weight: 600;
      text-align: center;
      padding: 0.1rem 0.14rem;
      letter-spacing: 0.01em;
    }
  `,
})
export class PortSelectComponent {
  readonly value = input('');
  readonly ports = input<Port[]>([]);
  readonly compact = input(false);
  readonly valueChange = output<string>();

  protected label = portLabel;

  protected portCodeLabel(port: Port): string {
    return port.code?.trim() || port.name;
  }

  protected compactTitle(): string {
    const v = this.value().trim();
    if (!v) return '';
    const port = this.ports().find((p) => p.name === v);
    return port ? portLabel(port) : v;
  }
}

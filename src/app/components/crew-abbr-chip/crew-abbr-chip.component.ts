import { Component, computed, input } from '@angular/core';
import { CREW_LIST_FIELD_ABBREVIATIONS_BY_ABBR } from '../../models/document-overlay.models';
import { PAX_LIST_FIELD_ABBREVIATIONS_BY_ABBR } from '../../models/passenger.models';

@Component({
  selector: 'app-crew-abbr-chip',
  template: `
    @if (colors(); as c) {
      <span
        class="crew-abbr-chip"
        [style.--chip-top]="c.top"
        [style.--chip-bottom]="c.bottom"
        [style.--chip-edge]="c.edge"
        [attr.title]="c.label"
      >
        {{ abbr() }}
      </span>
    } @else {
      <span class="crew-abbr-chip crew-abbr-chip--unknown">{{ abbr() }}</span>
    }
  `,
  styles: `
    .crew-abbr-chip {
      --chip-top: #64748b;
      --chip-bottom: #475569;
      --chip-edge: #334155;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      min-width: 1.55rem;
      height: 1.35rem;
      padding: 0 0.32rem;
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1;
      color: #fff;
      text-shadow: 0 1px 0 rgb(0 0 0 / 28%);
      background: linear-gradient(180deg, var(--chip-top) 0%, var(--chip-bottom) 100%);
      border: 1px solid var(--chip-edge);
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 34%),
        inset 0 -1px 0 rgb(0 0 0 / 16%),
        0 1px 0 var(--chip-edge),
        0 2px 4px rgb(15 23 42 / 12%);
      vertical-align: middle;
    }

    .crew-abbr-chip--unknown {
      background: #94a3b8;
      border-color: #64748b;
      box-shadow: none;
    }
  `,
})
export class CrewAbbrChipComponent {
  readonly abbr = input.required<string>();

  protected readonly colors = computed(
    () =>
      CREW_LIST_FIELD_ABBREVIATIONS_BY_ABBR[this.abbr()] ??
      PAX_LIST_FIELD_ABBREVIATIONS_BY_ABBR[this.abbr()] ??
      null,
  );
}

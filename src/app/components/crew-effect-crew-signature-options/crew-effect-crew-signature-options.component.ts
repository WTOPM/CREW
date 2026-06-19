import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CrewEffectStampOptions,
  CrewSignatureRowTweak,
  DocumentOverlayId,
} from '../../models/document-overlay.models';
import { formatCrewListName } from '../../models/crew.models';
import { passengersToCrewRows } from '../../utils/passenger-pdf.util';
import {
  CREW_EFFECT_SIGNATURE_FORM_CONFIG,
  crewEffectSignatureBase,
  resolveCrewSignatureBox,
  type CrewEffectOverlayId,
} from '../../utils/crew-effect-signature.util';
import { StorageService } from '../../services/storage.service';

const STEP_OFFSET = 1;
const STEP_SIZE = 2;

@Component({
  selector: 'app-crew-effect-crew-signature-options',
  host: {
    '[class.ce-crew-sig-host--embedded]': 'embedded()',
  },
  imports: [FormsModule],
  templateUrl: './crew-effect-crew-signature-options.component.html',
  styleUrl: './crew-effect-crew-signature-options.component.css',
})
export class CrewEffectCrewSignatureOptionsComponent {
  private readonly storage = inject(StorageService);

  readonly documentId = input.required<DocumentOverlayId>();
  readonly appendPassengers = input(false);
  readonly embedded = input(false);
  readonly selectedRow = input(0);
  readonly selectedRowChange = output<number>();

  protected readonly overlayId = computed((): CrewEffectOverlayId => {
    const id = this.documentId();
    if (id === 'crewEffect02' || id === 'crewEffect03') return id;
    return 'crewEffect';
  });

  protected readonly options = computed((): CrewEffectStampOptions => {
    const id = this.overlayId();
    return this.storage.documentOverlay()[id];
  });

  protected readonly maxRows = computed(
    () => CREW_EFFECT_SIGNATURE_FORM_CONFIG[this.overlayId()].rowCount,
  );

  protected readonly listRows = computed(() => {
    const max = this.maxRows();
    const crew = this.storage.activeCrewArrival().slice(0, max);
    if (!this.appendPassengers()) return crew;
    const remaining = max - crew.length;
    if (remaining <= 0) return crew;
    const passengers = passengersToCrewRows(this.storage.activePassengersArrival()).slice(
      0,
      remaining,
    );
    return [...crew, ...passengers];
  });

  protected readonly rowLabels = computed(() =>
    this.listRows().map((m, i) => ({
      index: i,
      label: `${i + 1} — ${formatCrewListName(m)}`,
      hasSignature: !!m.hasSignature,
    })),
  );

  protected readonly selectedTweak = computed((): CrewSignatureRowTweak => {
    const key = String(this.selectedRow());
    return this.options().crewSignatureByRow?.[key] ?? {};
  });

  protected readonly resolvedBoxPreview = computed(() => {
    const id = this.overlayId();
    const form = CREW_EFFECT_SIGNATURE_FORM_CONFIG[id];
    const base = crewEffectSignatureBase(this.options(), id);
    const row = this.selectedRow();
    return resolveCrewSignatureBox(
      base,
      form.rowY(0),
      form.rowY(row),
      this.selectedTweak(),
    );
  });

  protected onUseCrewSignaturesChange(value: boolean): void {
    this.patch({ useCrewSignatures: value });
  }

  protected onRowChange(index: number): void {
    this.selectedRowChange.emit(index);
  }

  protected nudge(field: 'offsetX' | 'offsetY', delta: number): void {
    const tweak = { ...this.selectedTweak() };
    tweak[field] = (tweak[field] ?? 0) + delta;
    this.patchRowTweak(tweak);
  }

  protected resize(field: 'width' | 'height', delta: number): void {
    const id = this.overlayId();
    const base = crewEffectSignatureBase(this.options(), id);
    const tweak = { ...this.selectedTweak() };
    const current = tweak[field] ?? base[field];
    tweak[field] = Math.max(4, current + delta);
    this.patchRowTweak(tweak);
  }

  protected setTweakField(field: keyof CrewSignatureRowTweak, raw: string): void {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    const tweak = { ...this.selectedTweak(), [field]: num };
    this.patchRowTweak(tweak);
  }

  protected resetRow(): void {
    const key = String(this.selectedRow());
    const byRow = { ...(this.options().crewSignatureByRow ?? {}) };
    delete byRow[key];
    this.patch({ crewSignatureByRow: byRow });
  }

  protected resetAllRows(): void {
    this.patch({ crewSignatureByRow: {}, crewSignatureBase: undefined });
  }

  protected readonly stepOffset = STEP_OFFSET;
  protected readonly stepSize = STEP_SIZE;

  private patch(partial: Partial<CrewEffectStampOptions>): void {
    this.storage.updateDocumentOverlay(this.overlayId(), partial, 'saved');
  }

  private patchRowTweak(tweak: CrewSignatureRowTweak): void {
    const key = String(this.selectedRow());
    const byRow = { ...(this.options().crewSignatureByRow ?? {}), [key]: tweak };
    this.patch({ crewSignatureByRow: byRow });
  }
}

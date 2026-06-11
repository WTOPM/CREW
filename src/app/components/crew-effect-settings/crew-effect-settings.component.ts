import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrewEffectDocId } from '../../models/crew.models';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-crew-effect-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './crew-effect-settings.component.html',
  styleUrl: './crew-effect-settings.component.css',
})
export class CrewEffectSettingsComponent {
  private readonly storage = inject(StorageService);

  readonly docId = input<CrewEffectDocId>('crewEffect');

  protected readonly isGermany = computed(() => this.docId() === 'crewEffect02');

  protected readonly form01 = computed(() => this.storage.crewEffectForm());
  protected readonly form02 = computed(() => this.storage.crewEffectForm02());

  protected readonly stampDocumentId = computed((): DocumentOverlayId =>
    this.docId() === 'crewEffect02' ? 'crewEffect02' : 'crewEffect',
  );

  protected onNilToggle01(
    field: 'nilCigarettes' | 'nilSpirits' | 'nilWines',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm('crewEffect', { [field]: value }, 'saved');
  }

  protected onNilToggle02(
    field: 'nilCigarettes' | 'nilCigars' | 'nilSpirits' | 'nilWeapons' | 'nilAmmunition',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm('crewEffect02', { [field]: value }, 'saved');
  }

  protected onOthersChange(value: string): void {
    this.storage.updateCrewEffectForm(this.docId(), { others: value });
  }
}

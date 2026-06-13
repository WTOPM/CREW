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

  protected readonly isForm02 = computed(() => this.docId() === 'crewEffect02');
  protected readonly isGermany = computed(() => this.docId() === 'crewEffect03');

  protected readonly form01 = computed(() => this.storage.crewEffectForm());
  protected readonly form02 = computed(() => this.storage.crewEffectForm02());
  protected readonly form03 = computed(() => this.storage.crewEffectForm03());

  protected readonly stampDocumentId = computed((): DocumentOverlayId => {
    const id = this.docId();
    if (id === 'crewEffect03') return 'crewEffect03';
    if (id === 'crewEffect02') return 'crewEffect02';
    return 'crewEffect';
  });

  protected onNilToggle01(
    field: 'nilCigarettes' | 'nilSpirits' | 'nilWines',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm('crewEffect', { [field]: value }, 'saved');
  }

  protected onNilToggle02(
    field: 'nilCigarettes' | 'nilTobaccoCigars' | 'nilSpirits' | 'nilBeer',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm('crewEffect02', { [field]: value }, 'saved');
  }

  protected onNilToggle03(
    field: 'nilCigarettes' | 'nilCigars' | 'nilSpirits' | 'nilWeapons' | 'nilAmmunition',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm('crewEffect03', { [field]: value }, 'saved');
  }

  protected onOthersChange(value: string): void {
    this.storage.updateCrewEffectForm(this.docId(), { others: value });
  }

  protected appendPassengers = computed(() => {
    if (this.isGermany()) return this.form03().appendPassengers;
    if (this.isForm02()) return this.form02().appendPassengers;
    return this.form01().appendPassengers;
  });

  protected onAppendPassengersChange(value: boolean): void {
    this.storage.updateCrewEffectForm(this.docId(), { appendPassengers: value }, 'saved');
  }

  protected othersValue(): string {
    if (this.isGermany()) return this.form03().others;
    if (this.isForm02()) return this.form02().others;
    return this.form01().others;
  }
}

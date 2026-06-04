import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

  protected form = this.storage.crewEffectForm;

  protected onNilToggle(
    field: 'nilCigarettes' | 'nilSpirits' | 'nilWines',
    value: boolean,
  ): void {
    this.storage.updateCrewEffectForm({ [field]: value }, 'saved');
  }

  protected onOthersChange(value: string): void {
    this.storage.updateCrewEffectForm({ others: value });
  }
}

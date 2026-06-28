import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EtaArchiveModalsComponent } from '../../components/eta-archive-modals/eta-archive-modals.component';
import { EtaSpeedKnInputDirective } from '../../directives/eta-speed-kn-input.directive';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { TimeInputComponent } from '../../components/time-input/time-input.component';
import { EtaScenario, normalizeUtcOffsetHours, stepUtcOffsetHours } from '../../models/eta.models';
import { EtaStore } from '../../services/eta.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import {
  formatSpeedKnotsDisplay,
  sanitizeSpeedKnotsInput,
  speedKnotsToTenths,
  tenthsToSpeedKnots,
} from '../../utils/eta-speed-input.util';
import {
  calculateEta,
  durationPartsFromHours,
  ETA_FIELD_TOOLTIPS,
  etaLegEndParts,
  etaWallClockParts,
  formatUtcOffsetLabel,
  scenarioHint,
  scenarioLabel,
  scenarioTooltip,
} from '../../utils/eta-calculator.util';

@Component({
  selector: 'app-eta',
  imports: [
    RouterLink,
    FormsModule,
    DecimalPipe,
    PortSelectComponent,
    DatePickerComponent,
    TimeInputComponent,
    EtaArchiveModalsComponent,
    EtaSpeedKnInputDirective,
  ],
  templateUrl: './eta.component.html',
  styleUrl: './eta.component.css',
})
export class EtaComponent {
  private readonly storage = inject(StorageService);
  private readonly etaStore = inject(EtaStore);
  private readonly toast = inject(ToastService);

  protected readonly ports = this.storage.ports;
  protected readonly etaLibrary = this.storage.etaLibrary;
  protected readonly draft = computed(() => this.etaLibrary().draft);
  protected readonly calculation = computed(() => calculateEta(this.draft()));
  protected readonly showSaveModal = signal(false);
  protected readonly showLoadModal = signal(false);
  private readonly utcOffsetEdit = signal<{
    field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours';
    text: string;
  } | null>(null);
  private readonly legSpeedEdit = signal<{ legId: string; text: string } | null>(null);

  protected readonly etaTips = ETA_FIELD_TOOLTIPS;

  protected setFromPort(value: string): void {
    this.etaStore.setDraftField('fromPort', value);
  }

  protected setToPort(value: string): void {
    this.etaStore.setDraftField('toPort', value);
  }

  protected setScenario(scenario: EtaScenario): void {
    this.etaStore.setScenario(scenario);
  }

  protected setDepartureDate(value: string): void {
    this.etaStore.setDraftField('departureDate', value);
  }

  protected setDepartureTime(value: string): void {
    this.etaStore.setDraftField('departureTime', value);
  }

  protected setArrivalDate(value: string): void {
    this.etaStore.setDraftField('arrivalDate', value);
  }

  protected setArrivalTime(value: string): void {
    this.etaStore.setDraftField('arrivalTime', value);
  }

  protected utcOffsetModel(field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours'): string {
    const edit = this.utcOffsetEdit();
    if (edit?.field === field) return edit.text;
    return this.offsetInput(this.draft()[field]);
  }

  protected onUtcOffsetFocus(
    field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours',
    event: FocusEvent,
  ): void {
    const text = this.offsetInput(this.draft()[field]);
    this.utcOffsetEdit.set({ field, text });
    (event.target as HTMLInputElement).select();
  }

  protected onUtcOffsetMouseDown(event: MouseEvent): void {
    const el = event.target as HTMLInputElement;
    if (document.activeElement !== el) {
      event.preventDefault();
      el.focus();
      el.select();
    }
  }

  protected onUtcOffsetChange(
    field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours',
    text: string,
  ): void {
    this.utcOffsetEdit.set({ field, text });
  }

  protected onUtcOffsetBlur(field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours'): void {
    this.commitUtcOffsetField(field);
  }

  protected onUtcOffsetEnter(
    field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours',
    event: Event,
  ): void {
    event.preventDefault();
    this.commitUtcOffsetField(field);
    (event.target as HTMLInputElement).blur();
  }

  protected onUtcOffsetKeydown(
    field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours',
    event: KeyboardEvent,
  ): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();

    const fallback = this.draft()[field];
    const edit = this.utcOffsetEdit();
    let current = fallback;
    if (edit?.field === field) {
      const trimmed = edit.text.trim();
      if (trimmed && trimmed !== '+' && trimmed !== '-') {
        current = normalizeUtcOffsetHours(trimmed, fallback);
      }
    }

    const delta = event.key === 'ArrowUp' ? 1 : -1;
    const next = stepUtcOffsetHours(current, delta);
    this.etaStore.setDraftField(field, next);
    const text = this.offsetInput(next);
    this.utcOffsetEdit.set({ field, text });

    const el = event.target as HTMLInputElement;
    queueMicrotask(() => el.select());
  }

  private commitUtcOffsetField(field: 'departureUtcOffsetHours' | 'arrivalUtcOffsetHours'): void {
    const edit = this.utcOffsetEdit();
    if (edit?.field !== field) {
      this.utcOffsetEdit.set(null);
      return;
    }
    this.utcOffsetEdit.set(null);

    const trimmed = edit.text.trim();
    if (trimmed === '+' || trimmed === '-') return;
    if (!trimmed) {
      this.etaStore.setDraftField(field, 0);
      return;
    }
    const formatted = trimmed.startsWith('-')
      ? trimmed
      : trimmed.startsWith('+')
        ? trimmed
        : `+${trimmed}`;
    const current = this.draft()[field];
    this.etaStore.setDraftField(field, normalizeUtcOffsetHours(formatted, current));
  }

  protected offsetInput(hours: number): string {
    if (!hours) return '0';
    return hours > 0 ? `+${hours}` : String(hours);
  }

  protected departureOffsetLabel(): string {
    return formatUtcOffsetLabel(this.draft().departureUtcOffsetHours);
  }

  protected arrivalOffsetLabel(): string {
    return formatUtcOffsetLabel(this.draft().arrivalUtcOffsetHours);
  }

  protected departureScheduleParts() {
    return etaWallClockParts(
      this.calculation().departureUtcMs,
      this.draft().departureUtcOffsetHours,
    );
  }

  protected arrivalScheduleParts() {
    return etaWallClockParts(this.calculation().arrivalUtcMs, this.draft().arrivalUtcOffsetHours);
  }

  protected isDepartureEditable(): boolean {
    return this.draft().scenario !== 'meetEtaBySpeed';
  }

  protected isArrivalEditable(): boolean {
    return this.draft().scenario !== 'planEta';
  }

  protected isSpeedEditable(): boolean {
    return this.draft().scenario !== 'meetEtaByDeparture';
  }

  protected legSpeedDisplay(legIndex: number): string {
    const leg = this.calculation().legs[legIndex];
    if (!this.isSpeedEditable()) {
      const speed = leg?.effectiveSpeedKnots ?? this.calculation().requiredSpeedKnots;
      return speed != null && speed > 0 ? formatSpeedKnotsDisplay(speed) : '';
    }
    return this.legSpeedInput(this.draft().legs[legIndex]?.id ?? '', legIndex);
  }

  protected legSpeedInput(legId: string, legIndex: number): string {
    const edit = this.legSpeedEdit();
    if (edit?.legId === legId) return edit.text;
    return formatSpeedKnotsDisplay(this.draft().legs[legIndex]?.speedKnots ?? 0);
  }

  protected onLegSpeedChange(legId: string, raw: string): void {
    const { text, value } = sanitizeSpeedKnotsInput(raw);
    const speedKnots = value != null ? tenthsToSpeedKnots(speedKnotsToTenths(value)) : 0;
    this.legSpeedEdit.set({ legId, text });
    this.etaStore.updateLeg(legId, { speedKnots });
  }

  protected onLegSpeedBlur(legId: string): void {
    if (this.legSpeedEdit()?.legId === legId) {
      this.legSpeedEdit.set(null);
    }
  }

  protected addLeg(): void {
    this.etaStore.addLeg();
  }

  protected removeLeg(legId: string): void {
    this.etaStore.removeLeg(legId);
  }

  protected onLegDistance(legId: string, raw: string): void {
    const distanceNm = parseFloat(raw);
    this.etaStore.updateLeg(legId, { distanceNm: isFinite(distanceNm) ? distanceNm : 0 });
  }

  protected onLegToLabel(legId: string, value: string): void {
    this.etaStore.updateLeg(legId, { toLabel: value });
  }

  protected isLastLeg(index: number): boolean {
    return index === this.draft().legs.length - 1;
  }

  protected newPlan(): void {
    this.etaStore.newDraft();
    this.toast.show('New voyage started', 'info');
  }

  protected startSave(): void {
    this.showLoadModal.set(false);
    this.showSaveModal.set(true);
  }

  protected openLoad(): void {
    this.showSaveModal.set(false);
    this.showLoadModal.set(true);
  }

  protected legDurationParts(legIndex: number) {
    const leg = this.calculation().legs[legIndex];
    return durationPartsFromHours(leg?.durationHours ?? -1);
  }

  protected legEtaParts(legIndex: number) {
    const leg = this.calculation().legs[legIndex];
    const offset =
      legIndex === this.draft().legs.length - 1
        ? this.draft().arrivalUtcOffsetHours
        : this.draft().departureUtcOffsetHours;
    return etaLegEndParts(leg?.arrivalAtLegEndUtcMs ?? null, offset);
  }

  protected legEtaLabel(legIndex: number): string {
    return this.calculation().legs[legIndex]?.arrivalAtLegEndShortLabel ?? '—';
  }

  protected legEtaTitle(legIndex: number): string {
    return this.calculation().legs[legIndex]?.arrivalAtLegEndLabel ?? '';
  }

  protected scenarioLabel = scenarioLabel;
  protected scenarioHint = scenarioHint;
  protected scenarioTooltip = scenarioTooltip;

  protected trackLegId(_index: number, leg: { id: string }): string {
    return leg.id;
  }
}

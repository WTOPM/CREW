import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import type { EtaWaypointGpsEntry } from '../../models/eta.models';
import { EtaStore } from '../../services/eta.store';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import {
  decimalToEtaGpsDmsDraft,
  emptyEtaGpsDmsDraft,
  formatEtaGpsShort,
  isEtaGpsDmsPartComplete,
  padEtaGpsDmsPart,
  sanitizeEtaGpsDmsPart,
  stepEtaGpsDmsPart,
  tryBuildEtaGpsCoordsFromDms,
  type EtaGpsDmsDraft,
} from '../../utils/eta-gps.util';

type EditDraft = {
  id: string | null;
  name: string;
  lat: EtaGpsDmsDraft;
  lon: EtaGpsDmsDraft;
};

type WpGpsIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

@Component({
  selector: 'app-eta-waypoints-modal',
  imports: [FormsModule, DragDropModule, ClickOutsideDirective],
  templateUrl: './eta-waypoints-modal.component.html',
  styleUrl: './eta-waypoints-modal.component.css',
})
export class EtaWaypointsModalComponent {
  readonly open = input(false);
  readonly close = output<void>();

  private readonly storage = inject(StorageService);
  private readonly etaStore = inject(EtaStore);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly waypoints = computed(() => this.storage.etaLibrary().waypoints ?? []);

  protected readonly editing = signal<EditDraft | null>(null);

  protected readonly editWorking = linkedSignal(() => {
    const e = this.editing();
    return e ? { ...e, lat: { ...e.lat }, lon: { ...e.lon } } : null;
  });

  protected formatCoords(w: EtaWaypointGpsEntry): string {
    return formatEtaGpsShort({ lat: w.lat, lon: w.lon });
  }

  protected onClose(): void {
    this.editing.set(null);
    this.close.emit();
  }

  protected startAdd(): void {
    this.editing.set({
      id: null,
      name: '',
      lat: emptyEtaGpsDmsDraft('lat'),
      lon: emptyEtaGpsDmsDraft('lon'),
    });
    queueMicrotask(() => this.focusDmsField(0));
  }

  protected startEdit(w: EtaWaypointGpsEntry): void {
    this.editing.set({
      id: w.id,
      name: w.name,
      lat: decimalToEtaGpsDmsDraft(w.lat, 'lat'),
      lon: decimalToEtaGpsDmsDraft(w.lon, 'lon'),
    });
    queueMicrotask(() => this.focusDmsField(0));
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected onNameChange(value: string): void {
    const cur = this.editWorking();
    if (!cur) return;
    this.editWorking.set({ ...cur, name: value });
  }

  protected onDmsPart(axis: 'lat' | 'lon', part: 'deg' | 'min' | 'sec', raw: string): void {
    const cur = this.editWorking();
    if (!cur) return;
    const cleaned = sanitizeEtaGpsDmsPart(raw, part, axis);
    const next = { ...cur[axis], [part]: cleaned };
    this.editWorking.set({ ...cur, [axis]: next });
    if (this.isDmsPartComplete(cleaned, part, axis)) {
      const idx = this.dmsFieldIdx(axis, part);
      queueMicrotask(() => this.focusDmsField(((idx + 1) % 8) as WpGpsIdx));
    }
  }

  /** Select whole value on focus so typing replaces padded 00 / 000. */
  protected onDmsFocus(event: FocusEvent): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    queueMicrotask(() => {
      if (document.activeElement === input) input.select();
    });
  }

  protected onDmsBlur(axis: 'lat' | 'lon', part: 'deg' | 'min' | 'sec'): void {
    const cur = this.editWorking();
    if (!cur) return;
    const padded = {
      ...cur[axis],
      [part]: padEtaGpsDmsPart(cur[axis][part], part, axis),
    };
    this.editWorking.set({ ...cur, [axis]: padded });
  }

  protected toggleHemi(axis: 'lat' | 'lon'): void {
    const cur = this.editWorking();
    if (!cur) return;
    if (axis === 'lat') {
      this.editWorking.set({
        ...cur,
        lat: { ...cur.lat, hemi: cur.lat.hemi === 'N' ? 'S' : 'N' },
      });
      return;
    }
    this.editWorking.set({
      ...cur,
      lon: { ...cur.lon, hemi: cur.lon.hemi === 'E' ? 'W' : 'E' },
    });
  }

  /** Tab cycles 8 DMS controls; ↑/↓ step values (and N/E). */
  protected onDmsKeydown(event: KeyboardEvent): void {
    const el = (event.target as HTMLElement | null)?.closest('[data-wp-gps-idx]') as HTMLElement | null;
    if (!el) return;
    const idx = Number(el.getAttribute('data-wp-gps-idx'));
    if (!Number.isInteger(idx) || idx < 0 || idx > 7) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      const next = (idx + (event.shiftKey ? 7 : 1)) % 8;
      this.focusDmsField(next as WpGpsIdx);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.stepDmsField(idx as WpGpsIdx, event.key === 'ArrowUp' ? 1 : -1);
    }
  }

  private focusDmsField(idx: WpGpsIdx): void {
    const node = document.querySelector(`[data-wp-gps-idx="${idx}"]`) as HTMLElement | null;
    node?.focus();
    if (node instanceof HTMLInputElement) {
      queueMicrotask(() => {
        if (document.activeElement === node) node.select();
      });
    }
  }

  private dmsFieldIdx(axis: 'lat' | 'lon', part: 'deg' | 'min' | 'sec'): WpGpsIdx {
    if (axis === 'lat') {
      if (part === 'deg') return 0;
      if (part === 'min') return 1;
      return 2;
    }
    if (part === 'deg') return 4;
    if (part === 'min') return 5;
    return 6;
  }

  private isDmsPartComplete(
    value: string,
    part: 'deg' | 'min' | 'sec',
    axis: 'lat' | 'lon',
  ): boolean {
    return isEtaGpsDmsPartComplete(value, part, axis);
  }

  private stepDmsField(idx: WpGpsIdx, delta: number): void {
    const cur = this.editWorking();
    if (!cur) return;

    if (idx === 3) {
      this.editWorking.set({
        ...cur,
        lat: { ...cur.lat, hemi: cur.lat.hemi === 'N' ? 'S' : 'N' },
      });
      return;
    }
    if (idx === 7) {
      this.editWorking.set({
        ...cur,
        lon: { ...cur.lon, hemi: cur.lon.hemi === 'E' ? 'W' : 'E' },
      });
      return;
    }

    const map: Record<number, { axis: 'lat' | 'lon'; part: 'deg' | 'min' | 'sec' }> = {
      0: { axis: 'lat', part: 'deg' },
      1: { axis: 'lat', part: 'min' },
      2: { axis: 'lat', part: 'sec' },
      4: { axis: 'lon', part: 'deg' },
      5: { axis: 'lon', part: 'min' },
      6: { axis: 'lon', part: 'sec' },
    };
    const field = map[idx];
    if (!field) return;
    const nextAxis = stepEtaGpsDmsPart(cur[field.axis], field.part, field.axis, delta);
    this.editWorking.set({ ...cur, [field.axis]: nextAxis });
  }

  protected saveEdit(): void {
    const cur = this.editWorking();
    if (!cur) return;
    const built = tryBuildEtaGpsCoordsFromDms(cur.lat, cur.lon);
    if (!built) {
      this.toast.showError('Invalid GPS (lat ±90, lon ±180; minutes 0–59; .xx 00–99)');
      return;
    }
    const result = this.etaStore.saveWaypointEntry({
      id: cur.id ?? undefined,
      name: cur.name,
      lat: built.lat,
      lon: built.lon,
    });
    if (!result.ok) {
      this.toast.showError(result.error);
      return;
    }
    this.toast.show(cur.id ? 'Waypoint updated' : 'Waypoint added', 'success');
    this.editing.set(null);
  }

  protected async deleteWaypoint(w: EtaWaypointGpsEntry, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirmDialog.confirm({
      title: 'Delete GPS waypoint',
      message: `Remove "${w.name}" from the shared catalog?\nRoutes using this name will lose these coordinates.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    this.etaStore.deleteWaypointEntry(w.id);
    if (this.editing()?.id === w.id) this.editing.set(null);
    this.toast.show(`Deleted "${w.name}"`, 'info');
  }

  protected onDrop(event: CdkDragDrop<EtaWaypointGpsEntry[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.etaStore.reorderWaypoints(event.previousIndex, event.currentIndex);
  }
}

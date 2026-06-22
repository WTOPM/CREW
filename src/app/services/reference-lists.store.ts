// Feature store for user-managed reference lists: ports (+ terminals), ranks,
// nationalities. These are suggestion lists edited in Settings; deletions are permanent
// (see CLAUDE.md). State is shared via AppStateStore — this store only owns the
// reference-list slice of selectors + mutations.

import { Injectable, computed, inject } from '@angular/core';
import { mergePorts, mergeUniqueList, normalizePortTerminals } from '../models/crew.models';
import { ToastService } from './toast.service';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class ReferenceListsStore {
  private readonly state = inject(AppStateStore);
  private readonly toast = inject(ToastService);
  private readonly data = this.state.data;

  readonly ports = computed(() => this.data().ports);
  readonly ranks = computed(() => this.data().ranks);
  readonly nationalities = computed(() => this.data().nationalities);

  addPort(name: string, code: string, country = ''): void {
    const n = name.trim();
    if (!n) return;
    this.data.update((d) => ({
      ...d,
      ports: mergePorts(d.ports, { name: n, code: code.trim(), country: country.trim() }),
    }));
    void this.state.persist('silent');
    this.toast.showPortAdded();
  }

  removePort(name: string): void {
    this.data.update((d) => ({ ...d, ports: d.ports.filter((p) => p.name !== name) }));
    void this.state.persist('silent');
    this.toast.showPortDeleted();
  }

  addPortTerminal(portName: string, abbrev: string, name: string): void {
    const a = abbrev.trim();
    const n = name.trim();
    if (!a && !n) return;
    this.data.update((d) => ({
      ...d,
      ports: d.ports.map((p) => {
        if (p.name !== portName) return p;
        const terminals = normalizePortTerminals([...(p.terminals ?? []), { abbrev: a, name: n }]);
        return { ...p, terminals };
      }),
    }));
    void this.state.persist('silent');
  }

  removePortTerminal(portName: string, terminalIndex: number): void {
    this.data.update((d) => ({
      ...d,
      ports: d.ports.map((p) => {
        if (p.name !== portName) return p;
        const terminals = (p.terminals ?? []).filter((_, i) => i !== terminalIndex);
        return { ...p, terminals };
      }),
    }));
    void this.state.persist('silent');
  }

  reorderPorts(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const ports = [...d.ports];
      const [moved] = ports.splice(previousIndex, 1);
      ports.splice(currentIndex, 0, moved);
      return { ...d, ports };
    });
    void this.state.persist('saved');
  }

  addRank(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, ranks: mergeUniqueList(d.ranks, v) }));
    void this.state.persist('silent');
    this.toast.showRankAdded();
  }

  removeRank(name: string): void {
    this.data.update((d) => ({ ...d, ranks: d.ranks.filter((r) => r !== name) }));
    void this.state.persist('silent');
    this.toast.showRankDeleted();
  }

  reorderRanks(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const ranks = [...d.ranks];
      const [moved] = ranks.splice(previousIndex, 1);
      ranks.splice(currentIndex, 0, moved);
      return { ...d, ranks };
    });
    void this.state.persist('saved');
  }

  addNationality(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, nationalities: mergeUniqueList(d.nationalities, v) }));
    void this.state.persist('silent');
    this.toast.showNationalityAdded();
  }

  removeNationality(name: string): void {
    this.data.update((d) => ({ ...d, nationalities: d.nationalities.filter((n) => n !== name) }));
    void this.state.persist('silent');
    this.toast.showNationalityDeleted();
  }

  reorderNationalities(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const nationalities = [...d.nationalities];
      const [moved] = nationalities.splice(previousIndex, 1);
      nationalities.splice(currentIndex, 0, moved);
      return { ...d, nationalities };
    });
    void this.state.persist('saved');
  }
}

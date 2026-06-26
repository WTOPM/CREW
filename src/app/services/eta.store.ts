import { Injectable, inject } from '@angular/core';
import {
  cloneEtaPlan,
  createDefaultEtaPlan,
  createEtaLeg,
  normalizeEtaLibrary,
  type EtaLeg,
  type EtaLibrarySettings,
  type EtaPlan,
  type EtaScenario,
} from '../models/eta.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class EtaStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  private touchDraft(draft: EtaPlan): EtaPlan {
    return { ...draft, updatedAt: new Date().toISOString() };
  }

  private updateLibrary(mutator: (lib: EtaLibrarySettings) => EtaLibrarySettings, notify: 'silent' | 'saved' = 'silent'): void {
    this.data.update((d) => ({
      ...d,
      etaLibrary: mutator(normalizeEtaLibrary(d.etaLibrary)),
    }));
    void this.state.persist(notify);
  }

  updateDraft(partial: Partial<EtaPlan>, notify: 'silent' | 'saved' = 'silent'): void {
    this.updateLibrary((lib) => ({
      ...lib,
      draft: this.touchDraft({ ...lib.draft, ...partial }),
    }), notify);
  }

  setDraftField<K extends keyof EtaPlan>(field: K, value: EtaPlan[K]): void {
    this.updateDraft({ [field]: value } as Partial<EtaPlan>);
  }

  setScenario(scenario: EtaScenario): void {
    this.updateDraft({ scenario });
  }

  addLeg(): void {
    this.updateLibrary((lib) => ({
      ...lib,
      draft: this.touchDraft({
        ...lib.draft,
        legs: [...lib.draft.legs, createEtaLeg()],
      }),
    }));
  }

  removeLeg(legId: string): void {
    this.updateLibrary((lib) => {
      const legs = lib.draft.legs.filter((l) => l.id !== legId);
      return {
        ...lib,
        draft: this.touchDraft({
          ...lib.draft,
          legs: legs.length ? legs : [createEtaLeg()],
        }),
      };
    });
  }

  updateLeg(legId: string, partial: Partial<Pick<EtaLeg, 'distanceNm' | 'speedKnots' | 'toLabel'>>): void {
    this.updateLibrary((lib) => ({
      ...lib,
      draft: this.touchDraft({
        ...lib.draft,
        legs: lib.draft.legs.map((leg) =>
          leg.id === legId ? { ...leg, ...partial } : leg,
        ),
      }),
    }));
  }

  newDraft(): void {
    this.updateLibrary((lib) => ({
      ...lib,
      draft: createDefaultEtaPlan(),
      activePlanId: null,
    }), 'saved');
  }

  /** Always saves current draft as a new library entry. */
  saveAs(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.updateLibrary((lib) => {
      const now = new Date().toISOString();
      const saved: EtaPlan = {
        ...cloneEtaPlan(lib.draft),
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...lib,
        plans: [...lib.plans, saved],
        activePlanId: null,
      };
    }, 'saved');
  }

  /** Loads a saved plan into the editor (new draft id — edits won't overwrite the saved copy). */
  loadPlan(planId: string): void {
    this.updateLibrary((lib) => {
      const plan = lib.plans.find((p) => p.id === planId);
      if (!plan) return lib;
      const draft = cloneEtaPlan(plan);
      draft.id = crypto.randomUUID();
      draft.name = '';
      return {
        ...lib,
        draft: this.touchDraft(draft),
        activePlanId: null,
      };
    }, 'silent');
  }

  deletePlan(planId: string): void {
    this.updateLibrary((lib) => ({
      ...lib,
      plans: lib.plans.filter((p) => p.id !== planId),
      activePlanId: lib.activePlanId === planId ? null : lib.activePlanId,
    }), 'saved');
  }
}

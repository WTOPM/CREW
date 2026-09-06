// Feature store for the small per-document form domains: cash advance, crew money list,
// narcotic list, port-of-call settings, ship stores, crew effect, nil list, ship money,
// and port-call history. Each is a small slice of form state edited in its settings modal.
//
// State is shared via AppStateStore. Read selectors (cashAdvanceForm, narcoticListForm,
// …) stay on StorageService for backward compatibility; this store owns the mutations.

import { Injectable, inject } from '@angular/core';
import {
  AppData,
  PortCallHistoryEntry,
  createEmptyPortCallEntry,
  normalizePortSecLvl,
  type CrewEffectDocId,
  type ShipStoresDocId,
  crewEffectFormField,
  normalizeShipStoresDocId,
  shipStoresFormField,
} from '../models/crew.models';
import { ToastService } from './toast.service';
import {
  normalizeCrewEffectForm,
  normalizeCrewEffectForm02,
  normalizeCrewEffectForm03,
  type CrewEffectForm02Settings,
  type CrewEffectForm03Settings,
  type CrewEffectFormSettings,
} from '../models/crew-effect.models';
import { createNilListPhrase, normalizeNilListForm } from '../models/nil-list.models';
import { createShipMoneyEntry, normalizeShipMoneyForm } from '../models/ship-money.models';
import {
  normalizeShipStoresForm,
  normalizeShipStoresForm02,
  normalizeShipStoresForm03,
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
  type ShipStoresFormSettings,
  type ShipStoresRow,
} from '../models/ship-stores.models';
import {
  normalizeCashAdvanceForm,
  type CashAdvanceFormSettings,
} from '../models/cash-advance.models';
import { normalizeCrewMoneyListForm } from '../models/crew-money-list.models';
import {
  createNarcoticMedicineEntry,
  normalizeNarcoticListForm,
  type NarcoticMedicineEntry,
} from '../models/narcotic-list.models';
import { normalizePortOfCallSettings } from './app-data-normalizer';
import {
  buildShipStoresCopy,
  readEffectiveShipStoresForm,
  type ShipStoresCopyStats,
} from '../utils/ship-stores-sync.util';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class FormsStore {
  private readonly toast = inject(ToastService);
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  updateCashAdvanceForm(partial: Partial<CashAdvanceFormSettings>): void {
    this.data.update((d) => ({
      ...d,
      cashAdvanceForm: normalizeCashAdvanceForm({ ...d.cashAdvanceForm, ...partial }),
    }));
    void this.state.persist('silent');
  }

  updateCashAdvanceCrewAmount(crewId: string, partial: { usd?: string; eur?: string }): void {
    this.data.update((d) => {
      const form = normalizeCashAdvanceForm(d.cashAdvanceForm);
      const prev = form.byCrewId[crewId] ?? { usd: '', eur: '' };
      return {
        ...d,
        cashAdvanceForm: normalizeCashAdvanceForm({
          ...form,
          byCrewId: { ...form.byCrewId, [crewId]: { ...prev, ...partial } },
        }),
      };
    });
    void this.state.persist('silent');
  }

  updateCrewMoneyListCrewAmount(
    crewId: string,
    partial: { usd?: string; euro?: string; others?: string },
  ): void {
    this.data.update((d) => {
      const form = normalizeCrewMoneyListForm(d.crewMoneyListForm);
      const prev = form.byCrewId[crewId] ?? { usd: '', euro: '', others: '' };
      return {
        ...d,
        crewMoneyListForm: normalizeCrewMoneyListForm({
          ...form,
          byCrewId: { ...form.byCrewId, [crewId]: { ...prev, ...partial } },
        }),
      };
    });
    void this.state.persist('silent');
  }

  updateNarcoticListEntry(id: string, partial: Partial<Omit<NarcoticMedicineEntry, 'id'>>): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      const entries = form.entries.map((e) => (e.id === id ? { ...e, ...partial } : e));
      return { ...d, narcoticListForm: { entries } };
    });
    void this.state.persist('silent');
  }

  addNarcoticListEntry(partial?: Partial<Omit<NarcoticMedicineEntry, 'id'>>): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      return {
        ...d,
        narcoticListForm: normalizeNarcoticListForm({
          entries: [...form.entries, createNarcoticMedicineEntry(partial)],
        }),
      };
    });
    void this.state.persist('silent');
  }

  removeNarcoticListEntry(id: string): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      return {
        ...d,
        narcoticListForm: normalizeNarcoticListForm({
          entries: form.entries.filter((e) => e.id !== id),
        }),
      };
    });
    void this.state.persist('silent');
  }

  updatePortOfCallSettings(partial: Partial<AppData['portOfCall']>): void {
    this.data.update((d) => ({
      ...d,
      portOfCall: normalizePortOfCallSettings({ ...d.portOfCall, ...partial }),
    }));
    void this.state.persist('silent');
  }

  updateShipStoresSettingsDocId(docId: ShipStoresDocId): void {
    this.data.update((d) => ({
      ...d,
      shipStoresSettingsDocId: normalizeShipStoresDocId(docId),
    }));
    void this.state.persist('silent');
  }

  updateShipStoresPlaceOfStorage(docId: ShipStoresDocId, placeOfStorage: string): void {
    this.patchShipStoresForm(docId, { placeOfStorage });
  }

  /**
   * Copy articles + place of storage from one Ship Stores variant to another.
   * Overlapping row range only; overflow articles are skipped (see stats).
   * Clears target HTML overlay article cells so PDF/editor follow synced rows.
   */
  copyShipStoresForm(from: ShipStoresDocId, to: ShipStoresDocId): ShipStoresCopyStats | null {
    if (from === to) return null;
    let stats: ShipStoresCopyStats | null = null;
    this.data.update((d) => {
      const source = readEffectiveShipStoresForm(d, from);
      const targetHasHtmlCells = to === 'shipStores' || to === 'shipStores02';
      const existingCv = targetHasHtmlCells
        ? (d.documentOverlay[to] as { cellValues?: Record<string, string> }).cellValues
        : undefined;
      const built = buildShipStoresCopy(source, from, to, existingCv);
      stats = built.stats;
      const field = shipStoresFormField(to);
      if (!targetHasHtmlCells) {
        return { ...d, [field]: built.form };
      }
      return {
        ...d,
        [field]: built.form,
        documentOverlay: {
          ...d.documentOverlay,
          [to]: {
            ...d.documentOverlay[to],
            cellValues: built.cellValues,
          },
        },
      };
    });
    void this.state.persist('silent');
    return stats;
  }

  updateCrewEffectForm(
    docId: CrewEffectDocId,
    partial:
      | Partial<CrewEffectFormSettings>
      | Partial<CrewEffectForm02Settings>
      | Partial<CrewEffectForm03Settings>,
    notify?: 'silent' | 'saved',
  ): void {
    const field = crewEffectFormField(docId);
    const normalize = this.crewEffectNormalize(docId);
    this.data.update((d) => ({
      ...d,
      [field]: normalize({ ...d[field], ...partial }),
    }));
    const resolved =
      notify ??
      (docId === 'crewEffect03'
        ? 'nilCigars' in partial ||
          'nilWeapons' in partial ||
          'nilAmmunition' in partial ||
          partial.nilCigarettes !== undefined ||
          partial.nilSpirits !== undefined
          ? 'saved'
          : 'silent'
        : docId === 'crewEffect02'
          ? partial.nilCigarettes !== undefined ||
            partial.nilSpirits !== undefined ||
            'nilBeer' in partial ||
            'nilTobaccoCigars' in partial
            ? 'saved'
            : 'silent'
          : partial.nilCigarettes !== undefined ||
              partial.nilSpirits !== undefined ||
              ('nilWines' in partial && partial.nilWines !== undefined)
            ? 'saved'
            : 'silent');
    void this.state.persist(resolved);
  }

  updateNilListPhrase(id: string, partial: { text?: string; enabled?: boolean }): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.map((p) => (p.id === id ? { ...p, ...partial } : p));
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    const notify = partial.enabled !== undefined && partial.text === undefined ? 'saved' : 'silent';
    void this.state.persist(notify);
  }

  addNilListPhrase(text: string, enabled = true): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      return {
        ...d,
        nilListForm: normalizeNilListForm({
          phrases: [...form.phrases, createNilListPhrase(text, enabled)],
        }),
      };
    });
    void this.state.persist('silent');
  }

  removeNilListPhrase(id: string): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.filter((p) => p.id !== id);
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    void this.state.persist('silent');
  }

  updateShipMoneyEntry(id: string, partial: { amount?: string; currency?: string }): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.map((e) => (e.id === id ? { ...e, ...partial } : e));
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.state.persist('silent');
  }

  addShipMoneyEntry(amount: string, currency: string): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      return {
        ...d,
        shipMoneyForm: normalizeShipMoneyForm({
          entries: [...form.entries, createShipMoneyEntry(amount, currency)],
        }),
      };
    });
    void this.state.persist('silent');
  }

  removeShipMoneyEntry(id: string): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.filter((e) => e.id !== id);
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.state.persist('silent');
  }

  private crewEffectNormalize(
    docId: CrewEffectDocId,
  ):
    | typeof normalizeCrewEffectForm
    | typeof normalizeCrewEffectForm02
    | typeof normalizeCrewEffectForm03 {
    if (docId === 'crewEffect03') return normalizeCrewEffectForm03;
    if (docId === 'crewEffect02') return normalizeCrewEffectForm02;
    return normalizeCrewEffectForm;
  }

  private shipStoresRowCount(docId: ShipStoresDocId): number {
    if (docId === 'shipStores03') return SHIP_STORES_03_ROW_COUNT;
    if (docId === 'shipStores02') return SHIP_STORES_02_ROW_COUNT;
    return SHIP_STORES_ROW_COUNT;
  }

  private shipStoresNormalize(
    docId: ShipStoresDocId,
  ):
    | typeof normalizeShipStoresForm
    | typeof normalizeShipStoresForm02
    | typeof normalizeShipStoresForm03 {
    if (docId === 'shipStores03') return normalizeShipStoresForm03;
    if (docId === 'shipStores02') return normalizeShipStoresForm02;
    return normalizeShipStoresForm;
  }

  updateShipStoresRow(
    docId: ShipStoresDocId,
    rowIndex: number,
    partial: Partial<ShipStoresRow>,
  ): void {
    const rowCount = this.shipStoresRowCount(docId);
    if (rowIndex < 0 || rowIndex >= rowCount) return;
    const field = shipStoresFormField(docId);
    this.data.update((d) => {
      const normalize = this.shipStoresNormalize(docId);
      const form = normalize(d[field]);
      const rows = form.rows.map((r, i) => (i === rowIndex ? { ...r, ...partial } : r));
      return { ...d, [field]: normalize({ ...form, rows }) };
    });
    void this.state.persist('silent');
  }

  reorderShipStoresRows(
    docId: ShipStoresDocId,
    previousIndex: number,
    currentIndex: number,
  ): void {
    if (previousIndex === currentIndex) return;
    const rowCount = this.shipStoresRowCount(docId);
    if (
      previousIndex < 0 ||
      previousIndex >= rowCount ||
      currentIndex < 0 ||
      currentIndex >= rowCount
    ) {
      return;
    }
    const field = shipStoresFormField(docId);
    this.data.update((d) => {
      const normalize = this.shipStoresNormalize(docId);
      const form = normalize(d[field]);
      const rows = [...form.rows];
      const [moved] = rows.splice(previousIndex, 1);
      rows.splice(currentIndex, 0, moved);
      return { ...d, [field]: normalize({ ...form, rows }) };
    });
    void this.state.persist('silent');
  }

  private patchShipStoresForm(
    docId: ShipStoresDocId,
    partial: Partial<ShipStoresFormSettings>,
  ): void {
    const field = shipStoresFormField(docId);
    const normalize = this.shipStoresNormalize(docId);
    this.data.update((d) => ({
      ...d,
      [field]: normalize({ ...d[field], ...partial }),
    }));
    void this.state.persist('silent');
  }

  addPortCallEntry(entry?: Partial<PortCallHistoryEntry>): PortCallHistoryEntry {
    const newEntry = { ...createEmptyPortCallEntry(), ...entry };
    this.data.update((d) => ({ ...d, portCallHistory: [newEntry, ...d.portCallHistory] }));
    void this.state.persist('silent');
    this.toast.showPortAdded();
    return newEntry;
  }

  updatePortCallEntry(
    id: string,
    partial: Partial<PortCallHistoryEntry>,
    notify?: 'silent' | 'saved',
    savedMessage?: string,
  ): void {
    const current = this.data().portCallHistory.find((e) => e.id === id);
    if (!current) return;
    const keys = Object.keys(partial) as (keyof PortCallHistoryEntry)[];
    const changed = keys.some((key) => {
      const nextVal = partial[key];
      if (key === 'secLvl' && nextVal != null) {
        return current.secLvl !== normalizePortSecLvl(String(nextVal));
      }
      return current[key] !== nextVal;
    });
    if (!changed) return;

    this.data.update((d) => ({
      ...d,
      portCallHistory: d.portCallHistory.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...partial };
        if (partial.secLvl != null) next.secLvl = normalizePortSecLvl(partial.secLvl);
        return next;
      }),
    }));
    const resolved =
      notify ??
      (partial.portName != null || partial.arrivalDate != null || partial.departureDate != null
        ? 'saved'
        : 'silent');
    void this.state.persist(resolved, savedMessage);
  }

  removePortCallEntry(id: string): void {
    this.data.update((d) => ({
      ...d,
      portCallHistory: d.portCallHistory.filter((e) => e.id !== id),
    }));
    void this.state.persist('silent');
    this.toast.showPortDeleted();
  }
}

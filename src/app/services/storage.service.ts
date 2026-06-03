import { Injectable, inject, signal, computed } from '@angular/core';
import {
  AppData,
  CrewMember,
  DEFAULT_NATIONALITIES,
  DEFAULT_PORTS,
  DEFAULT_RANKS,
  Port,
  PortCallHistoryEntry,
  createDefaultCrewArrSettings,
  createDefaultPortOfCallSettings,
  createEmptyCrewMember,
  createEmptyPortCallEntry,
  createEmptyShip,
  mergePorts,
  mergeUniqueList,
  migrateCrewMember,
  migratePortsRaw,
  resolvePortRef,
  sortCrewByRank,
} from '../models/crew.models';
import { ToastService } from './toast.service';
import { SEED_SHIP, SEED_VERSION, createSeedCrew } from '../data/default-crew.seed';
import { SEED_PORT_CALL_HISTORY } from '../data/default-port-call.seed';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';

const STORAGE_KEY = 'crew-app-data';

const DEFAULT_DATA: AppData = {
  ship: { ...SEED_SHIP },
  crew: createSeedCrew(),
  crewArr: createDefaultCrewArrSettings(),
  ports: [...DEFAULT_PORTS],
  ranks: [...DEFAULT_RANKS],
  nationalities: [...DEFAULT_NATIONALITIES],
  portCallHistory: SEED_PORT_CALL_HISTORY.map((e) => ({ ...e })),
  portOfCall: createDefaultPortOfCallSettings(),
  seedVersion: SEED_VERSION,
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly toast = inject(ToastService);
  private readonly data = signal<AppData>(this.loadInitial());

  readonly ship = computed(() => this.data().ship);
  readonly crewArr = computed(() => this.data().crewArr);
  readonly ports = computed(() => this.data().ports);
  readonly ranks = computed(() => this.data().ranks);
  readonly nationalities = computed(() => this.data().nationalities);
  readonly portCallHistory = computed(() => this.data().portCallHistory);
  readonly portOfCall = computed(() => this.data().portOfCall);
  readonly activeCrew = computed(() => this.data().crew.filter((m) => !m.archived));
  readonly archivedCrew = computed(() =>
    sortCrewByRank(
      this.data().crew.filter((m) => m.archived),
      this.data().ranks,
    ),
  );
  readonly allCrew = computed(() => this.data().crew);

  private loadInitial(): AppData {
    return {
      ...DEFAULT_DATA,
      crew: [...DEFAULT_DATA.crew],
      ports: [...DEFAULT_DATA.ports],
      ranks: [...DEFAULT_DATA.ranks],
      nationalities: [...DEFAULT_DATA.nationalities],
      portCallHistory: [...DEFAULT_DATA.portCallHistory],
      portOfCall: { ...DEFAULT_DATA.portOfCall },
      crewArr: { ...DEFAULT_DATA.crewArr },
    };
  }

  async init(): Promise<void> {
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      if (loaded) {
        const normalized = this.normalize(loaded);
        this.data.set(normalized);
        if ((loaded.seedVersion ?? 0) < SEED_VERSION) {
          await this.persist('silent');
        }
        return;
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const normalized = this.normalize(parsed);
        this.data.set(normalized);
        if ((parsed.seedVersion ?? 0) < SEED_VERSION) {
          await this.persist('silent');
        }
      } catch {
        this.data.set(this.loadInitial());
      }
    } else {
      await this.persist('silent');
    }
  }

  private normalize(raw: Partial<AppData> & { ports?: unknown }): AppData {
    const ship = { ...createEmptyShip(), ...SEED_SHIP, ...raw.ship };
    let crew = (raw.crew ?? []).map((m) => this.normalizeMember(m, raw.ports));
    if ((raw.seedVersion ?? 0) < 3) {
      Object.assign(ship, SEED_SHIP);
      crew = createSeedCrew();
    }
    const crewArr = { ...createDefaultCrewArrSettings(), ...raw.crewArr };
    let ports = migratePortsRaw(raw.ports);
    ports = mergePorts(
      ports,
      ship.portOfCall,
      ship.lastPortOfCall,
      ship.nextPortOfCall,
      ship.homeport,
      ...crew.map((c) => c.joiningPort),
    );
    ship.portOfCall = resolvePortRef(ship.portOfCall, ports)?.name ?? ship.portOfCall;
    ship.lastPortOfCall = resolvePortRef(ship.lastPortOfCall, ports)?.name ?? ship.lastPortOfCall;
    ship.nextPortOfCall = resolvePortRef(ship.nextPortOfCall, ports)?.name ?? ship.nextPortOfCall;
    crew = crew.map((m) => ({
      ...m,
      joiningPort: resolvePortRef(m.joiningPort, ports)?.name ?? m.joiningPort,
    }));
    const ranks = mergeUniqueList(
      raw.ranks ?? DEFAULT_RANKS,
      ...crew.map((c) => c.rank),
    );
    const nationalities = mergeUniqueList(
      raw.nationalities ?? DEFAULT_NATIONALITIES,
      ship.nationality,
      ...crew.map((c) => c.nationality),
    );
    const portCallHistory = this.normalizePortCallHistory(raw, ports);
    ports = mergePorts(ports, ...portCallHistory.map((e) => e.portName));
    const portOfCall = this.normalizePortOfCallSettings(raw.portOfCall);
    return {
      ship,
      crew,
      crewArr,
      ports,
      ranks: mergeUniqueList(ranks),
      nationalities: mergeUniqueList(nationalities),
      portCallHistory,
      portOfCall,
      seedVersion: SEED_VERSION,
    };
  }

  private normalizePortCallHistory(
    raw: Partial<AppData>,
    ports: Port[],
  ): PortCallHistoryEntry[] {
    let history: PortCallHistoryEntry[];
    if (raw.portCallHistory?.length) {
      history = raw.portCallHistory.map((entry) => ({
        ...createEmptyPortCallEntry(),
        ...entry,
        id: entry.id || crypto.randomUUID(),
      }));
    } else if ((raw.seedVersion ?? 0) < 6) {
      history = SEED_PORT_CALL_HISTORY.map((e) => ({ ...e }));
    } else {
      history = [];
    }

    return history.map((entry) => ({
      ...entry,
      portName: resolvePortRef(entry.portName, ports)?.name ?? entry.portName,
    }));
  }

  private normalizePortOfCallSettings(raw: Partial<AppData['portOfCall']> | undefined): AppData['portOfCall'] {
    const defaults = createDefaultPortOfCallSettings();
    const count = raw?.pdfRowCount ?? defaults.pdfRowCount;
    return {
      pdfRowCount: Math.min(POC_MAX_ROW_COUNT, Math.max(POC_MIN_ROW_COUNT, count)),
    };
  }

  private normalizeMember(
    raw: Partial<CrewMember> & { familyNameGivenNames?: string },
    portsRaw?: unknown,
  ): CrewMember {
    const ports = migratePortsRaw(portsRaw);
    const member = migrateCrewMember(raw);
    if (member.joiningPort) {
      member.joiningPort = resolvePortRef(member.joiningPort, ports)?.name ?? member.joiningPort;
    }
    return member;
  }

  private async persist(notify: 'silent' | 'saved' | 'debounced' = 'debounced'): Promise<void> {
    const payload = { ...this.data(), seedVersion: SEED_VERSION };
    const electron = window.electronAPI;
    if (electron) {
      await electron.writeData(payload);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    if (notify === 'saved') this.toast.showSaved();
    if (notify === 'debounced') this.toast.debouncedSaved();
  }

  updateShip(partial: Partial<AppData['ship']>): void {
    this.data.update((d) => {
      const ship = { ...d.ship, ...partial };
      const ports = mergePorts(
        d.ports,
        ship.portOfCall,
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.homeport,
      );
      const nationalities = mergeUniqueList(d.nationalities, ship.nationality);
      return { ...d, ship, ports, nationalities };
    });
    void this.persist('debounced');
  }

  updateCrewArr(partial: Partial<AppData['crewArr']>, notify: 'silent' | 'saved' = 'saved'): void {
    this.data.update((d) => ({ ...d, crewArr: { ...d.crewArr, ...partial } }));
    void this.persist(notify);
  }

  addPort(name: string, code: string, country = ''): void {
    const n = name.trim();
    if (!n) return;
    this.data.update((d) => ({
      ...d,
      ports: mergePorts(d.ports, { name: n, code: code.trim(), country: country.trim() }),
    }));
    void this.persist('silent');
    this.toast.showPortAdded();
  }

  removePort(name: string): void {
    this.data.update((d) => ({ ...d, ports: d.ports.filter((p) => p.name !== name) }));
    void this.persist('silent');
    this.toast.showPortDeleted();
  }

  addRank(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, ranks: mergeUniqueList(d.ranks, v) }));
    void this.persist('silent');
    this.toast.showRankAdded();
  }

  removeRank(name: string): void {
    this.data.update((d) => ({ ...d, ranks: d.ranks.filter((r) => r !== name) }));
    void this.persist('silent');
    this.toast.showRankDeleted();
  }

  addNationality(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, nationalities: mergeUniqueList(d.nationalities, v) }));
    void this.persist('silent');
    this.toast.showNationalityAdded();
  }

  removeNationality(name: string): void {
    this.data.update((d) => ({ ...d, nationalities: d.nationalities.filter((n) => n !== name) }));
    void this.persist('silent');
    this.toast.showNationalityDeleted();
  }

  updatePortOfCallSettings(partial: Partial<AppData['portOfCall']>): void {
    this.data.update((d) => ({
      ...d,
      portOfCall: this.normalizePortOfCallSettings({ ...d.portOfCall, ...partial }),
    }));
    void this.persist('saved');
  }

  addPortCallEntry(entry?: Partial<PortCallHistoryEntry>): PortCallHistoryEntry {
    const newEntry = { ...createEmptyPortCallEntry(), ...entry };
    this.data.update((d) => {
      const ports = mergePorts(d.ports, newEntry.portName);
      return { ...d, portCallHistory: [newEntry, ...d.portCallHistory], ports };
    });
    void this.persist('silent');
    this.toast.showPortAdded();
    return newEntry;
  }

  updatePortCallEntry(id: string, partial: Partial<PortCallHistoryEntry>): void {
    this.data.update((d) => {
      const portCallHistory = d.portCallHistory.map((e) => (e.id === id ? { ...e, ...partial } : e));
      const updated = portCallHistory.find((e) => e.id === id);
      const ports = mergePorts(d.ports, updated?.portName);
      return { ...d, portCallHistory, ports };
    });
    void this.persist('saved');
  }

  removePortCallEntry(id: string): void {
    this.data.update((d) => ({
      ...d,
      portCallHistory: d.portCallHistory.filter((e) => e.id !== id),
    }));
    void this.persist('silent');
    this.toast.showPortDeleted();
  }

  addCrewMember(member?: Partial<CrewMember>): CrewMember {
    const newMember = { ...createEmptyCrewMember(), ...member, archived: false };
    this.data.update((d) => {
      const ports = mergePorts(d.ports, newMember.joiningPort);
      const ranks = mergeUniqueList(d.ranks, newMember.rank);
      const nationalities = mergeUniqueList(d.nationalities, newMember.nationality);
      return { ...d, crew: [...d.crew, newMember], ports, ranks, nationalities };
    });
    void this.persist('silent');
    return newMember;
  }

  updateCrewMember(
    id: string,
    partial: Partial<CrewMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => {
      const crew = d.crew.map((m) => (m.id === id ? { ...m, ...partial } : m));
      const updated = crew.find((m) => m.id === id);
      const ports = mergePorts(d.ports, updated?.joiningPort);
      const ranks = mergeUniqueList(d.ranks, updated?.rank);
      const nationalities = mergeUniqueList(d.nationalities, updated?.nationality);
      return { ...d, crew, ports, ranks, nationalities };
    });
    void this.persist(notify);
  }

  archiveCrewMember(id: string): void {
    this.updateCrewMember(id, { archived: true }, 'silent');
  }

  restoreCrewMember(id: string): void {
    this.updateCrewMember(id, { archived: false }, 'silent');
  }

  removeCrewMember(id: string): void {
    this.data.update((d) => ({ ...d, crew: d.crew.filter((m) => m.id !== id) }));
    void this.persist('silent');
  }

  reorderActiveCrew(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    this.data.update((d) => {
      const active = d.crew.filter((m) => !m.archived);
      const archived = d.crew.filter((m) => m.archived);
      const reordered = [...active];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return { ...d, crew: [...reordered, ...archived] };
    });
    void this.persist('debounced');
  }

  replaceAll(data: AppData): void {
    this.data.set(this.normalize(data));
    void this.persist('saved');
  }

  async getDataPath(): Promise<string | null> {
    return (await window.electronAPI?.getDataPath()) ?? null;
  }

  async exportData(): Promise<void> {
    const blob = new Blob([JSON.stringify(this.data(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crew-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<void> {
    const text = await file.text();
    const parsed = JSON.parse(text) as AppData;
    this.replaceAll(parsed);
  }
}

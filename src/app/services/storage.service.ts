import { Injectable, inject, signal, computed } from '@angular/core';
import {
  AppData,
  CrewMember,
  DEFAULT_PORTS,
  DEFAULT_RANKS,
  Port,
  createDefaultCrewArrSettings,
  createEmptyCrewMember,
  createEmptyShip,
  mergePorts,
  mergeUniqueList,
  migrateCrewMember,
  migratePortsRaw,
  resolvePortRef,
} from '../models/crew.models';
import { ToastService } from './toast.service';
import { SEED_SHIP, SEED_VERSION, createSeedCrew } from '../data/default-crew.seed';

const STORAGE_KEY = 'crew-app-data';

const DEFAULT_DATA: AppData = {
  ship: { ...SEED_SHIP },
  crew: createSeedCrew(),
  crewArr: createDefaultCrewArrSettings(),
  ports: [...DEFAULT_PORTS],
  ranks: [...DEFAULT_RANKS],
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
  readonly activeCrew = computed(() => this.data().crew.filter((m) => !m.archived));
  readonly archivedCrew = computed(() => this.data().crew.filter((m) => m.archived));
  readonly allCrew = computed(() => this.data().crew);

  private loadInitial(): AppData {
    return {
      ...DEFAULT_DATA,
      crew: [...DEFAULT_DATA.crew],
      ports: [...DEFAULT_DATA.ports],
      ranks: [...DEFAULT_DATA.ranks],
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
    return {
      ship,
      crew,
      crewArr,
      ports,
      ranks: mergeUniqueList(ranks),
      seedVersion: SEED_VERSION,
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
      return { ...d, ship, ports };
    });
    void this.persist('debounced');
  }

  updateCrewArr(partial: Partial<AppData['crewArr']>): void {
    this.data.update((d) => ({ ...d, crewArr: { ...d.crewArr, ...partial } }));
    void this.persist('saved');
  }

  addPort(name: string, code: string): void {
    const n = name.trim();
    if (!n) return;
    this.data.update((d) => ({
      ...d,
      ports: mergePorts(d.ports, { name: n, code: code.trim() }),
    }));
    void this.persist('saved');
  }

  removePort(name: string): void {
    this.data.update((d) => ({ ...d, ports: d.ports.filter((p) => p.name !== name) }));
    void this.persist('saved');
  }

  addRank(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, ranks: mergeUniqueList(d.ranks, v) }));
    void this.persist('saved');
  }

  removeRank(name: string): void {
    this.data.update((d) => ({ ...d, ranks: d.ranks.filter((r) => r !== name) }));
    void this.persist('saved');
  }

  addCrewMember(member?: Partial<CrewMember>): CrewMember {
    const newMember = { ...createEmptyCrewMember(), ...member, archived: false };
    this.data.update((d) => {
      const ports = mergePorts(d.ports, newMember.joiningPort);
      const ranks = mergeUniqueList(d.ranks, newMember.rank);
      return { ...d, crew: [...d.crew, newMember], ports, ranks };
    });
    void this.persist('silent');
    return newMember;
  }

  updateCrewMember(id: string, partial: Partial<CrewMember>): void {
    this.data.update((d) => {
      const crew = d.crew.map((m) => (m.id === id ? { ...m, ...partial } : m));
      const updated = crew.find((m) => m.id === id);
      const ports = mergePorts(d.ports, updated?.joiningPort);
      const ranks = mergeUniqueList(d.ranks, updated?.rank);
      return { ...d, crew, ports, ranks };
    });
    void this.persist('saved');
  }

  archiveCrewMember(id: string): void {
    this.updateCrewMember(id, { archived: true });
  }

  restoreCrewMember(id: string): void {
    this.updateCrewMember(id, { archived: false });
  }

  removeCrewMember(id: string): void {
    this.data.update((d) => ({ ...d, crew: d.crew.filter((m) => m.id !== id) }));
    void this.persist('saved');
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

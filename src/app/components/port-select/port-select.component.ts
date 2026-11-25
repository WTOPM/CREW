import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Port, PortTerminal, portLabel } from '../../models/crew.models';

export type PortSelectMode = 'ports' | 'terminals';

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface TerminalOption {
  portName: string;
  portCode: string;
  abbrev: string;
  terminalName: string;
}

interface TerminalSection {
  portName: string;
  portCode: string;
  items: TerminalOption[];
}

/** Match port name / LOCODE (and optional free text) against a typeahead query. */
export function portMatchesQuery(port: Port, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const name = (port.name ?? '').trim().toLowerCase();
  const code = (port.code ?? '').trim().toLowerCase();
  return (
    code.startsWith(q) ||
    name.startsWith(q) ||
    name.includes(q) ||
    code.includes(q)
  );
}

/** Match terminal row (abbrev / name / parent port) against a typeahead query. */
export function terminalOptionMatchesQuery(opt: TerminalOption, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const abbrev = opt.abbrev.trim().toLowerCase();
  const termName = opt.terminalName.trim().toLowerCase();
  const portName = opt.portName.trim().toLowerCase();
  const portCode = opt.portCode.trim().toLowerCase();
  return (
    abbrev.startsWith(q) ||
    portCode.startsWith(q) ||
    portName.startsWith(q) ||
    abbrev.includes(q) ||
    termName.includes(q) ||
    portName.includes(q) ||
    portCode.includes(q)
  );
}

@Component({
  selector: 'app-port-select',
  templateUrl: './port-select.component.html',
  styleUrl: './port-select.component.css',
})
export class PortSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * `ports` — pick a port (POL/POD).
   * `terminals` — pick a terminal abbrev; also emits `portChange` with the parent port.
   */
  readonly mode = input<PortSelectMode>('ports');
  /** Port name (ports mode) or terminal abbrev (terminals mode). */
  readonly value = input('');
  readonly ports = input<Port[]>([]);
  readonly compact = input(false);
  readonly valueChange = output<string>();
  /** Parent port name when a terminal is chosen (terminals mode only). */
  readonly portChange = output<string>();

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly filterField = viewChild<ElementRef<HTMLInputElement>>('filterField');

  protected readonly open = signal(false);
  protected readonly panelPos = signal<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: 280 });
  /** Typeahead text while the panel is open. */
  protected readonly query = signal('');

  protected readonly isTerminalsMode = computed(() => this.mode() === 'terminals');

  protected readonly terminalOptions = computed((): TerminalOption[] => {
    const out: TerminalOption[] = [];
    for (const p of this.ports()) {
      for (const t of this.portTerminals(p)) {
        out.push({
          portName: p.name,
          portCode: this.portCodeLabel(p),
          abbrev: this.terminalAbbrev(t),
          terminalName: t.name?.trim() ?? '',
        });
      }
    }
    return out;
  });

  /** Port codes that have at least one terminal (section headers in terminals mode). */
  protected readonly terminalSections = computed((): TerminalSection[] => {
    const map = new Map<string, TerminalSection>();
    for (const opt of this.terminalOptions()) {
      let section = map.get(opt.portName);
      if (!section) {
        section = { portName: opt.portName, portCode: opt.portCode, items: [] };
        map.set(opt.portName, section);
      }
      section.items.push(opt);
    }
    return [...map.values()];
  });

  protected readonly filteredPorts = computed(() => {
    const q = this.query();
    return this.ports().filter((p) => portMatchesQuery(p, q));
  });

  protected readonly filteredTerminalSections = computed((): TerminalSection[] => {
    const q = this.query();
    if (!q.trim()) return this.terminalSections();
    const out: TerminalSection[] = [];
    for (const section of this.terminalSections()) {
      const items = section.items.filter((t) => terminalOptionMatchesQuery(t, q));
      if (!items.length) continue;
      out.push({ ...section, items });
    }
    return out;
  });

  protected readonly displayLabel = computed(() => {
    const v = this.value().trim();
    if (!v) {
      if (this.compact()) return '—';
      return this.isTerminalsMode() ? '— select terminal —' : '— select port —';
    }
    if (this.isTerminalsMode()) {
      return v.toUpperCase();
    }
    const port = this.ports().find((p) => p.name === v);
    if (this.compact()) return port ? this.portCodeLabel(port) : v;
    return port ? portLabel(port) : v;
  });

  constructor() {
    const onScroll = (): void => {
      if (this.open()) this.repositionPanel();
    };
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, true);
      const el = this.panel()?.nativeElement;
      if (el?.isConnected && el.parentElement === document.body) {
        el.remove();
      }
    });
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocMouseDown(event: MouseEvent): void {
    if (!this.open()) return;
    const t = event.target as Node | null;
    if (t && this.host.nativeElement.contains(t)) return;
    if (t && this.panel()?.nativeElement.contains(t)) return;
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.open()) this.repositionPanel();
  }

  protected portCodeLabel(port: Port): string {
    return port.code?.trim() || port.name;
  }

  protected portTerminals(port: Port): PortTerminal[] {
    return (port.terminals ?? []).filter((t) => t.abbrev?.trim() || t.name?.trim());
  }

  protected terminalAbbrev(terminal: PortTerminal): string {
    return (terminal.abbrev?.trim() || terminal.name.trim()).toUpperCase();
  }

  protected isPortSelected(port: Port): boolean {
    return !this.isTerminalsMode() && this.value().trim() === port.name;
  }

  protected isTerminalSelected(abbrev: string): boolean {
    return (
      this.isTerminalsMode() &&
      this.value().trim().toUpperCase() === abbrev.trim().toUpperCase()
    );
  }

  protected onQueryInput(event: Event): void {
    const el = event.target as HTMLInputElement | null;
    this.query.set(el?.value ?? '');
  }

  protected onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePanel();
      this.trigger()?.nativeElement.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.pickFirstMatch();
    }
  }

  protected toggle(): void {
    if (this.open()) this.closePanel();
    else this.openPanel();
  }

  protected pickPort(portName: string, event: MouseEvent): void {
    event.preventDefault();
    this.valueChange.emit(portName);
    this.closePanel();
  }

  protected pickTerminal(portName: string, abbrev: string, event: MouseEvent): void {
    event.preventDefault();
    this.valueChange.emit(abbrev);
    this.portChange.emit(portName);
    this.closePanel();
  }

  protected clear(event: MouseEvent): void {
    event.preventDefault();
    this.valueChange.emit('');
    if (this.isTerminalsMode()) this.portChange.emit('');
    this.closePanel();
  }

  private pickFirstMatch(): void {
    if (this.isTerminalsMode()) {
      const first = this.filteredTerminalSections()[0]?.items[0];
      if (!first) return;
      this.valueChange.emit(first.abbrev);
      this.portChange.emit(first.portName);
      this.closePanel();
      return;
    }
    const first = this.filteredPorts()[0];
    if (!first) return;
    this.valueChange.emit(first.name);
    this.closePanel();
  }

  private openPanel(): void {
    this.query.set('');
    this.open.set(true);
    queueMicrotask(() => {
      this.attachPanelToBody();
      this.repositionPanel();
      this.filterField()?.nativeElement.focus();
      this.filterField()?.nativeElement.select();
    });
  }

  private closePanel(): void {
    this.open.set(false);
    this.query.set('');
  }

  private attachPanelToBody(): void {
    const el = this.panel()?.nativeElement;
    if (!el) return;
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  }

  private repositionPanel(): void {
    const btn = this.trigger()?.nativeElement;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const gap = 4;
    const preferBelow = window.innerHeight - rect.bottom - gap;
    const preferAbove = rect.top - gap;
    const maxH = 320;
    const openUp = preferBelow < 160 && preferAbove > preferBelow;
    const available = openUp ? preferAbove : preferBelow;
    const maxHeight = Math.max(140, Math.min(maxH, available));
    const top = openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap;
    const width = Math.max(rect.width, this.compact() ? 168 : 240);
    this.panelPos.set({ top, left: rect.left, width, maxHeight });
  }
}

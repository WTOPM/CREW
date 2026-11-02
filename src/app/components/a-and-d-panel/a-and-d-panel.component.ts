import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { AAndDFilenameModalComponent } from '../a-and-d-filename-modal/a-and-d-filename-modal.component';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import {
  AD_ACTION_DEFS,
  AD_MAX_TERMINALS,
  AD_PALETTE_GROUPS,
  buildAdFileNameFromPattern,
  normalizeAdActionDisplaySort,
  normalizeAdBlockDefaults,
  normalizeAdFileNamePattern,
  normalizeAdWorkspace,
  adActionDef,
  adKindForDrop,
  adPaletteGroupOfKind,
  createAdAction,
  createAdTerminal,
  createEmptyAdDraft,
  isAdPilotAction,
  isAdTugAction,
  type AdAction,
  type AdActionDisplaySort,
  type AdActionKind,
  type AdActionTone,
  type AdBlockDefaults,
  type AdFileNamePattern,
  type AdPaletteGroupId,
  type AdPilotBlockDefaults,
  type AdReportDraft,
  type AdTerminal,
  type AdTugBlockDefaults,
  type AdYn,
} from '../../models/a-and-d.models';
import { portCode, type CrewMember } from '../../models/crew.models';
import { AdStore } from '../../services/ad.store';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { sortAdActionsForDisplay } from '../../utils/ad-action-display-sort.util';
import { base64ToUint8, uint8ToBase64 } from '../../utils/base64.util';
import { registerPendingEditCommit } from '../../utils/commit-pending-dom-edits.util';
import { openExcelBytes } from '../../utils/excel-open.util';
import {
  buildAdReportXlsxBytes,
  parseAdReportFromXlsxBytes,
} from '../../utils/a-and-d-excel.util';

function splitAdDateTime(value: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})?(?:T(\d{2}:\d{2}))?/.exec((value ?? '').trim());
  return { date: m?.[1] ?? '', time: m?.[2] ?? '' };
}

function joinAdDateTime(date: string, time: string): string {
  const d = date.trim();
  const t = time.trim();
  if (d && t) return `${d}T${t}`;
  if (d) return `${d}T`;
  if (t) return `T${t}`;
  return '';
}

function adDateTimeMissing(value: string): boolean {
  const { date, time } = splitAdDateTime(value);
  return !date || !time;
}

function suggestMasterName(crew: readonly CrewMember[]): string {
  const active = crew.filter((m) => !m.archived && (m.onArrivalList || m.onDepartureList));
  const master = active.find((m) => /\bmaster\b|\bcaptain\b/i.test(m.rank));
  if (!master) return '';
  const family = master.familyName.trim().toUpperCase();
  const given = master.givenNames.trim();
  const initial = given ? `${given.charAt(0).toUpperCase()}.` : '';
  return [family, initial].filter(Boolean).join(' ');
}

interface AdPathSegment {
  label: string;
  openPath: string;
  isRoot: boolean;
}

function joinAdPath(folder: string, fileName: string): string {
  const dir = folder.replace(/[\\/]+$/, '');
  const sep = dir.includes('/') && !dir.includes('\\') ? '/' : '\\';
  return `${dir}${sep}${fileName}`;
}

function dirnameAdPath(filePath: string): string {
  const p = filePath.replace(/[\\/]+$/, '');
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i >= 0 ? p.slice(0, i) : '';
}

function basenameAdPath(filePath: string): string {
  const p = filePath.replace(/[\\/]+$/, '');
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** Folder-only crumbs (same style as FUEL Excel path). */
function parseAdFolderSegments(raw: string): AdPathSegment[] {
  const p = String(raw ?? '').trim();
  if (!p) return [];
  const sep = p.includes('\\') ? '\\' : '/';
  const segs: AdPathSegment[] = [];
  let rest = p;
  let acc = '';

  if (/^[A-Za-z]:[\\/]?/.test(p)) {
    const root = p.slice(0, 2);
    acc = root + sep;
    segs.push({ label: root, openPath: acc, isRoot: true });
    rest = p.slice(2).replace(/^[\\/]+/, '');
  } else if (p.startsWith('\\\\') || p.startsWith('//')) {
    const bits = p.replace(/^[/\\]+/, '').split(/[/\\]/).filter(Boolean);
    if (!bits.length) return [];
    acc = sep + sep + bits[0];
    segs.push({ label: '\\\\' + bits[0], openPath: acc, isRoot: true });
    rest = bits.slice(1).join(sep);
  }

  for (const part of rest.split(/[/\\]/).filter(Boolean)) {
    acc = acc ? (acc.endsWith('\\') || acc.endsWith('/') ? acc + part : acc + sep + part) : part;
    segs.push({ label: part, openPath: acc, isRoot: false });
  }
  return segs;
}

type AdTerminalEditDraft = {
  code: string;
  layBy: boolean;
  shoreGangway: AdYn;
  shoreGangwayShift: AdYn;
  hatchCoverQty: string;
  draftArrival: string;
  draftDeparture: string;
  boatmenWaitMins: string;
  miscRemarks: string;
};

@Component({
  selector: 'app-a-and-d-panel',
  imports: [
    FormsModule,
    ClickOutsideDirective,
    DatePickerComponent,
    TimeInputComponent,
    AAndDFilenameModalComponent,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
  ],
  templateUrl: './a-and-d-panel.component.html',
  styleUrl: './a-and-d-panel.component.css',
})
export class AAndDPanelComponent {
  private readonly storage = inject(StorageService);
  private readonly adStore = inject(AdStore);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);
  /** Snapshot once at construct — folder / draft / defaults from last session. */
  private readonly restored = normalizeAdWorkspace(this.storage.adWorkspace());
  /** Fingerprint of modal fields at open — commit only when changed. */
  private editDraftFinger = '';

  protected readonly paletteGroups = AD_PALETTE_GROUPS;
  protected readonly maxTerminals = AD_MAX_TERMINALS;
  protected readonly busy = signal(false);
  /** Shown on the full-screen busy overlay (Save / Open / Refresh). */
  protected readonly busyLabel = signal('');
  protected readonly dragGroup = signal<AdPaletteGroupId | null>(null);
  /** Applied to newly dropped blocks / terminals (existing cards keep their own values). */
  protected readonly blockDefaults = signal<AdBlockDefaults>(
    normalizeAdBlockDefaults(this.restored.blockDefaults),
  );
  /** Palette chip defaults popover (`river`…`tug`). */
  protected readonly settingsOpen = signal<AdPaletteGroupId | null>(null);
  /** Custom combo lists (datalist cannot toggle closed on 2nd arrow click). */
  protected readonly portComboOpen = signal(false);
  protected readonly terminalComboOpen = signal(false);
  /** Typeahead text only — selected value must not hide the rest of Settings ports. */
  protected readonly portComboFilter = signal('');
  protected readonly terminalComboFilter = signal('');
  /** Right-click terminal card → centered edit modal. */
  protected readonly editingTerminalId = signal<string | null>(null);
  protected readonly editDraft = signal<AdTerminalEditDraft | null>(null);
  /** While dragging over a terminal “+” slot — Arrival (in) or Departure (out). */
  protected readonly dropHover = signal<{
    terminalId: string;
    tone: AdActionTone;
  } | null>(null);
  /** True while a terminal row is being reordered via CDK drag. */
  protected readonly terminalReordering = signal(false);
  /** Working folder (Electron). File picked from dropdown inside it. */
  protected readonly folderPath = signal(this.restored.folderPath);
  /** Selected .xlsx name in folderPath (empty = new unsaved draft). */
  protected readonly selectedFile = signal(this.restored.selectedFile);
  /** .xlsx/.xlsm names in the current folder. */
  protected readonly folderFiles = signal<string[]>([]);
  /** Auto Excel name pattern (blocks + delimiter). */
  protected readonly fileNamePattern = signal<AdFileNamePattern>(
    normalizeAdFileNamePattern(this.restored.fileNamePattern),
  );
  /** UI-only block order inside terminals (Excel write unchanged). */
  protected readonly actionDisplaySort = signal<AdActionDisplaySort>(
    normalizeAdActionDisplaySort(this.restored.actionDisplaySort),
  );
  /** Auto-name builder popup. */
  protected readonly fileNameModalOpen = signal(false);
  protected readonly hasElectron =
    !!window.electronAPI?.pickDirectory && !!window.electronAPI?.writeFileBase64;

  protected readonly draft = signal<AdReportDraft>(this.hydrateDraft(this.restored));

  protected readonly terminalCount = computed(() => this.draft().terminals.length);
  protected readonly pathSegments = computed(() => parseAdFolderSegments(this.folderPath()));
  protected readonly filePath = computed(() => {
    const folder = this.folderPath().trim();
    const file = this.selectedFile().trim();
    return folder && file ? joinAdPath(folder, file) : '';
  });
  protected readonly fileLabel = computed(() => this.selectedFile().trim() || 'New document');
  /** True when an Excel file from the folder is selected/open. */
  protected readonly hasOpenFile = computed(() => !!this.selectedFile().trim());

  constructor() {
    let persistReady = false;
    void Promise.resolve().then(() => {
      persistReady = true;
      void this.refreshFolderFiles();
    });
    // Mirror to AppData RAM so Quit can flush — never touch the shared folder here.
    effect(() => {
      const folderPath = this.folderPath();
      const selectedFile = this.selectedFile();
      const draft = this.draft();
      const blockDefaults = this.blockDefaults();
      const fileNamePattern = this.fileNamePattern();
      const actionDisplaySort = this.actionDisplaySort();
      if (!persistReady) return;
      untracked(() =>
        this.adStore.saveWorkspace({
          folderPath,
          selectedFile,
          draft,
          blockDefaults,
          fileNamePattern,
          actionDisplaySort,
        }),
      );
    });
    // Quit/Save flush runs before destroy — push modal + workspace into AppData sync.
    const unregisterCommit = registerPendingEditCommit(() => {
      if (this.editDraft()) this.commitTerminalEdit();
      this.syncWorkspaceToStore(false);
    });
    this.destroyRef.onDestroy(() => {
      unregisterCommit();
      if (this.editDraft()) this.commitTerminalEdit();
      this.syncWorkspaceToStore(false);
    });
  }

  /** Push current signals into AppData; optionally flush the shared/local data file. */
  private syncWorkspaceToStore(flushDisk = false): void {
    this.adStore.saveWorkspace({
      folderPath: this.folderPath(),
      selectedFile: this.selectedFile(),
      draft: this.draft(),
      blockDefaults: this.blockDefaults(),
      fileNamePattern: this.fileNamePattern(),
      actionDisplaySort: this.actionDisplaySort(),
    });
    if (flushDisk) void this.adStore.flushToDisk('silent');
  }

  protected setActionDisplaySort(mode: AdActionDisplaySort): void {
    this.actionDisplaySort.set(normalizeAdActionDisplaySort(mode));
  }

  protected openFileNameModal(): void {
    this.fileNameModalOpen.set(true);
  }

  protected closeFileNameModal(): void {
    this.fileNameModalOpen.set(false);
  }

  protected saveFileNamePattern(pattern: AdFileNamePattern): void {
    this.fileNamePattern.set(normalizeAdFileNamePattern(pattern));
    this.fileNameModalOpen.set(false);
    this.toast.showSaved('Auto name pattern saved');
  }

  /** Restore last draft from AppData, or seed a blank one. */
  private hydrateDraft(ws = this.restored): AdReportDraft {
    const hasWork =
      !!ws.draft.portCallId.trim() ||
      !!ws.draft.portCode.trim() ||
      ws.draft.terminals.some(
        (t) =>
          !!t.code.trim() ||
          t.layBy ||
          t.actions.length > 0 ||
          !!t.remarks.hatchCoverQty.trim() ||
          !!t.remarks.draftArrival.trim() ||
          !!t.remarks.draftDeparture.trim() ||
          !!t.remarks.miscRemarks.trim(),
      );
    return this.withProgramShip(hasWork ? ws.draft : this.buildSeed());
  }

  protected isPilot = isAdPilotAction;
  protected isTug = isAdTugAction;
  protected defOf = adActionDef;
  protected groupOf = adPaletteGroupOfKind;
  protected datePart = (v: string) => splitAdDateTime(v).date;
  protected timePart = (v: string) => splitAdDateTime(v).time;
  protected isBlank = (v: string | number | null | undefined) =>
    v == null || String(v).trim() === '';
  protected isDateTimeMissing = adDateTimeMissing;

  /** Display order only — never rewrites stored `term.actions` / Excel layout. */
  protected sortedActions(term: AdTerminal): AdAction[] {
    return sortAdActionsForDisplay(term.actions, this.actionDisplaySort());
  }

  private actionDateTimeField(
    action: AdAction,
    field: 'onboarding' | 'disembarkment' | 'start' | 'end',
  ): string {
    if (field === 'onboarding' || field === 'disembarkment') {
      return isAdPilotAction(action) ? action[field] : '';
    }
    return isAdTugAction(action) ? action[field] : '';
  }

  protected setActionDate(
    terminalId: string,
    kind: AdActionKind,
    field: 'onboarding' | 'disembarkment' | 'start' | 'end',
    date: string,
  ): void {
    const term = this.draft().terminals.find((t) => t.id === terminalId);
    const action = term?.actions.find((a) => a.kind === kind);
    if (!action) return;
    const time = splitAdDateTime(this.actionDateTimeField(action, field)).time;
    this.patchAction(terminalId, kind, { [field]: joinAdDateTime(date, time) });
  }

  protected setActionTime(
    terminalId: string,
    kind: AdActionKind,
    field: 'onboarding' | 'disembarkment' | 'start' | 'end',
    time: string,
  ): void {
    const term = this.draft().terminals.find((t) => t.id === terminalId);
    const action = term?.actions.find((a) => a.kind === kind);
    if (!action) return;
    const date = splitAdDateTime(this.actionDateTimeField(action, field)).date;
    this.patchAction(terminalId, kind, { [field]: joinAdDateTime(date, time) });
  }

  private vesselFromProgram(): string {
    const name = this.storage.ship().name?.trim() ?? '';
    if (!name) return '';
    return name.toUpperCase().startsWith('M/V') ? name : `M/V ${name}`;
  }

  private masterFromProgram(): string {
    return suggestMasterName(this.storage.activeCrewArrival());
  }

  /** Vessel / Master always come from ship + crew in the app (not edited in A&D). */
  private withProgramShip(draft: AdReportDraft): AdReportDraft {
    return {
      ...draft,
      vessel: this.vesselFromProgram(),
      master: this.masterFromProgram(),
    };
  }

  private buildSeed(): AdReportDraft {
    const ship = this.storage.ship();
    const ports = this.storage.ports();
    return this.withProgramShip(
      createEmptyAdDraft({
        portCode: portCode(ship.portOfCall, ports),
        terminals: [createAdTerminal('', this.blockDefaults())],
      }),
    );
  }

  /** Port codes from Settings — free text still allowed in the input. */
  protected readonly portCodeOptions = computed(() => {
    const seen = new Set<string>();
    const out: { code: string; label: string }[] = [];
    for (const p of this.storage.ports()) {
      const code = (p.code ?? '').trim().toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const name = (p.name ?? '').trim();
      out.push({ code, label: name ? `${code} · ${name}` : code });
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  });

  protected readonly filteredPortCodeOptions = computed(() => {
    const q = this.portComboFilter().trim().toUpperCase();
    const all = this.portCodeOptions();
    if (!q) return all;
    return all.filter((p) => p.code.includes(q) || p.label.toUpperCase().includes(q));
  });

  /** Terminal abbrevs for the A&D draft port code — free text still allowed. */
  protected readonly terminalCodeOptions = computed(() => {
    const adPortCode = this.draft().portCode.trim().toUpperCase();
    if (!adPortCode) return [] as { code: string; label: string }[];
    const port = this.storage
      .ports()
      .find((p) => (p.code ?? '').trim().toUpperCase() === adPortCode);
    const seen = new Set<string>();
    const out: { code: string; label: string }[] = [];
    for (const t of port?.terminals ?? []) {
      const code = (t.abbrev ?? '').trim().toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const name = (t.name ?? '').trim();
      out.push({ code, label: name ? `${code} · ${name}` : code });
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  });

  protected readonly filteredTerminalCodeOptions = computed(() => {
    const q = this.terminalComboFilter().trim().toUpperCase();
    const all = this.terminalCodeOptions();
    if (!q) return all;
    return all.filter((t) => t.code.includes(q) || t.label.toUpperCase().includes(q));
  });

  protected updateHeader<K extends 'portCallId' | 'portCode'>(key: K, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected openPortCombo(): void {
    this.portComboFilter.set('');
    this.terminalComboOpen.set(false);
    this.portComboOpen.set(true);
  }

  protected updatePortCode(value: string): void {
    const next = (value ?? '').toUpperCase();
    this.updateHeader('portCode', next);
    this.portComboFilter.set(next);
    this.terminalComboOpen.set(false);
    this.portComboOpen.set(true);
  }

  protected togglePortCombo(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.terminalComboOpen.set(false);
    this.portComboOpen.update((open) => {
      if (open) return false;
      this.portComboFilter.set('');
      return true;
    });
  }

  protected selectPortCode(code: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.updateHeader('portCode', code.toUpperCase());
    this.portComboFilter.set('');
    this.portComboOpen.set(false);
  }

  /** Enter / click outside — keep typed port code and close the list. */
  protected confirmPortCombo(event?: Event): void {
    event?.preventDefault();
    if (!this.portComboOpen()) return;
    const code = this.draft().portCode.trim().toUpperCase();
    this.updateHeader('portCode', code);
    this.portComboFilter.set('');
    this.portComboOpen.set(false);
    this.blurComboTarget(event);
  }

  protected openTerminalCombo(): void {
    this.terminalComboFilter.set('');
    this.portComboOpen.set(false);
    this.terminalComboOpen.set(true);
  }

  protected toggleTerminalCombo(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.portComboOpen.set(false);
    this.terminalComboOpen.update((open) => {
      if (open) return false;
      this.terminalComboFilter.set('');
      return true;
    });
  }

  protected selectTerminalCode(code: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.patchEditDraft({ code: code.toUpperCase() });
    this.terminalComboFilter.set('');
    this.terminalComboOpen.set(false);
  }

  /** Enter / click outside — keep typed terminal code and close the list. */
  protected confirmTerminalCombo(event?: Event): void {
    event?.preventDefault();
    if (!this.terminalComboOpen()) return;
    const ed = this.editDraft();
    if (ed) {
      this.patchEditDraft({ code: (ed.code ?? '').trim().toUpperCase() });
    }
    this.terminalComboFilter.set('');
    this.terminalComboOpen.set(false);
    this.blurComboTarget(event);
  }

  private blurComboTarget(event?: Event): void {
    const fromEvent = event?.target;
    if (fromEvent instanceof HTMLElement) {
      fromEvent.blur();
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }

  protected onTerminalCodeTyped(value: string): void {
    const next = (value ?? '').toUpperCase();
    this.patchEditDraft({ code: next });
    this.terminalComboFilter.set(next);
    this.portComboOpen.set(false);
    this.terminalComboOpen.set(true);
  }

  protected addTerminal(): void {
    if (this.draft().terminals.length >= AD_MAX_TERMINALS) {
      this.toast.showError(`Max ${AD_MAX_TERMINALS} terminals`);
      return;
    }
    this.draft.update((d) => ({
      ...d,
      terminals: [...d.terminals, createAdTerminal('', this.blockDefaults())],
    }));
  }

  protected async removeTerminal(id: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    const term = this.draft().terminals.find((t) => t.id === id);
    if (!term) return;
    if (term.actions.length > 0) {
      const label = term.code.trim() || 'this terminal';
      const n = term.actions.length;
      const ok = await this.confirmDialog.confirm({
        title: 'Delete terminal?',
        message:
          `“${label}” has ${n} block${n === 1 ? '' : 's'}.\n\n` +
          'Delete the terminal and all its blocks?',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
        variant: 'danger',
      });
      if (ok !== true) return;
    }
    if (this.editingTerminalId() === id) this.closeTerminalEdit();
    this.draft.update((d) => {
      const next = d.terminals.filter((t) => t.id !== id);
      return {
        ...d,
        terminals: next.length ? next : [createAdTerminal('', this.blockDefaults())],
      };
    });
  }

  private closeCombos(): void {
    this.portComboOpen.set(false);
    this.terminalComboOpen.set(false);
    this.portComboFilter.set('');
    this.terminalComboFilter.set('');
  }

  protected openTerminalEdit(term: AdTerminal, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeSettings();
    this.closeCombos();
    const ed: AdTerminalEditDraft = {
      code: term.code,
      layBy: term.layBy,
      shoreGangway: term.remarks.shoreGangway,
      shoreGangwayShift: term.remarks.shoreGangwayShift,
      hatchCoverQty: term.remarks.hatchCoverQty,
      draftArrival: term.remarks.draftArrival,
      draftDeparture: term.remarks.draftDeparture,
      boatmenWaitMins: term.remarks.boatmenWaitMins,
      miscRemarks: term.remarks.miscRemarks,
    };
    this.editingTerminalId.set(term.id);
    this.editDraft.set(ed);
    this.editDraftFinger = JSON.stringify(ed);
  }

  protected closeTerminalEdit(): void {
    this.commitTerminalEdit();
    this.editingTerminalId.set(null);
    this.editDraft.set(null);
    this.editDraftFinger = '';
    this.closeCombos();
  }

  /** Close on press outside (mousedown / RMB) — not mouseup, so text-select drag out stays open. */
  protected onTerminalBackdropPress(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.closeTerminalEdit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.fileNameModalOpen()) {
      this.closeFileNameModal();
      return;
    }
    if (this.portComboOpen() || this.terminalComboOpen()) {
      this.closeCombos();
      return;
    }
    if (this.editDraft()) {
      this.closeTerminalEdit();
      return;
    }
    this.closeSettings();
  }

  protected patchEditDraft(patch: Partial<AdTerminalEditDraft>): void {
    // Modal stays local — apply to draft only on close (weak LAN / no per-keystroke persist).
    this.editDraft.update((cur) => (cur ? { ...cur, ...patch } : cur));
  }

  protected nudgeDraft(field: 'draftArrival' | 'draftDeparture', delta: number): void {
    const ed = this.editDraft();
    if (!ed) return;
    this.patchEditDraft({ [field]: this.nudgeDecimal(ed[field], delta, 1) });
  }

  protected nudgeHatch(delta: number): void {
    const ed = this.editDraft();
    if (!ed) return;
    this.patchEditDraft({ hatchCoverQty: this.nudgeInteger(ed.hatchCoverQty, delta) });
  }

  protected onDraftKeydown(
    event: KeyboardEvent,
    field: 'draftArrival' | 'draftDeparture',
  ): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.nudgeDraft(field, 0.1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.nudgeDraft(field, -0.1);
    }
  }

  protected onHatchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.nudgeHatch(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.nudgeHatch(-1);
    }
  }

  private nudgeDecimal(raw: string, delta: number, decimals: number): string {
    const n = Number(String(raw ?? '').trim().replace(',', '.'));
    const base = Number.isFinite(n) ? n : 0;
    const factor = 10 ** decimals;
    const next = Math.round((base + delta) * factor) / factor;
    const clamped = next < 0 ? 0 : next;
    return clamped.toFixed(decimals);
  }

  private nudgeInteger(raw: string, delta: number): string {
    const n = Number(String(raw ?? '').trim().replace(',', '.'));
    const base = Number.isFinite(n) ? Math.floor(n) : 0;
    const next = Math.max(0, base + delta);
    return String(next);
  }

  private commitTerminalEdit(): void {
    const id = this.editingTerminalId();
    const ed = this.editDraft();
    if (!id || !ed) return;
    if (JSON.stringify(ed) === this.editDraftFinger) return;
    const code = ed.code.trim().toUpperCase();
    const remarksPatch = {
      shoreGangway: ed.shoreGangway,
      shoreGangwayShift: ed.shoreGangwayShift,
      hatchCoverQty: ed.hatchCoverQty.trim(),
      draftArrival: ed.draftArrival.trim(),
      draftDeparture: ed.draftDeparture.trim(),
      boatmenWaitMins: ed.boatmenWaitMins.trim() || '0',
      miscRemarks: ed.miscRemarks.trim(),
    };
    this.draft.update((d) => ({
      ...d,
      terminals: d.terminals.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          code,
          layBy: ed.layBy,
          remarks: { ...t.remarks, ...remarksPatch },
        };
      }),
    }));
    // Keep “new terminal” defaults in sync with last edit.
    this.blockDefaults.update((d) =>
      normalizeAdBlockDefaults({
        ...d,
        terminal: { ...d.terminal, ...remarksPatch },
      }),
    );
    this.editDraftFinger = JSON.stringify(ed);
  }

  protected toggleSettings(target: AdPaletteGroupId, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.settingsOpen.update((cur) => (cur === target ? null : target));
  }

  /** LMB outside this chip — close its defaults popover. */
  protected onBlockSettingsOutside(groupId: AdPaletteGroupId): void {
    if (this.settingsOpen() === groupId) this.closeSettings();
  }

  protected closeSettings(): void {
    this.settingsOpen.set(null);
    this.closeCombos();
  }

  protected pilotDefaults(group: AdPaletteGroupId): AdPilotBlockDefaults {
    const d = this.blockDefaults();
    if (group === 'harbour') return d.harbour;
    if (group === 'anchorage') return d.anchorage;
    return d.river;
  }

  protected patchPilotDefaults(
    group: AdPaletteGroupId,
    patch: Partial<AdPilotBlockDefaults>,
  ): void {
    const key = group === 'harbour' || group === 'anchorage' ? group : 'river';
    this.blockDefaults.update((d) =>
      normalizeAdBlockDefaults({ ...d, [key]: { ...d[key], ...patch } }),
    );
  }

  protected patchTugDefaults(patch: Partial<AdTugBlockDefaults>): void {
    this.blockDefaults.update((d) =>
      normalizeAdBlockDefaults({ ...d, tug: { ...d.tug, ...patch } }),
    );
  }

  protected onPaletteDragStart(groupId: AdPaletteGroupId, event: DragEvent): void {
    this.dragGroup.set(groupId);
    this.dropHover.set(null);
    event.dataTransfer?.setData('text/plain', groupId);
    event.dataTransfer?.setData('text/ad-group', groupId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  protected onPaletteDragEnd(): void {
    this.dragGroup.set(null);
    this.dropHover.set(null);
  }

  protected onTerminalCdkDragStarted(): void {
    this.dragGroup.set(null);
    this.dropHover.set(null);
    this.terminalReordering.set(true);
  }

  protected onTerminalCdkDragEnded(): void {
    this.terminalReordering.set(false);
  }

  /** Live CDK reorder — list animates while the row follows the pointer. */
  protected onTerminalCdkDrop(event: CdkDragDrop<AdTerminal[]>): void {
    this.terminalReordering.set(false);
    if (event.previousIndex === event.currentIndex) return;
    this.draft.update((d) => {
      const terminals = [...d.terminals];
      moveItemInArray(terminals, event.previousIndex, event.currentIndex);
      return { ...d, terminals };
    });
  }

  /** Excel allows one of each action kind per terminal column (8 max). */
  protected canAddMore(term: AdTerminal): boolean {
    return term.actions.length < AD_ACTION_DEFS.length;
  }

  /** True when this terminal already has that direction for the dragged group. */
  protected halfIsTaken(term: AdTerminal, tone: AdActionTone): boolean {
    const groupId = this.dragGroup();
    if (!groupId) return false;
    const kind = adKindForDrop(groupId, tone);
    return term.actions.some((a) => a.kind === kind);
  }

  protected halfIsHot(term: AdTerminal, tone: AdActionTone): boolean {
    const h = this.dropHover();
    if (!h || h.terminalId !== term.id || h.tone !== tone) return false;
    return !this.halfIsTaken(term, tone);
  }

  protected onAddSlotDragOver(term: AdTerminal, event: DragEvent): void {
    if (this.terminalReordering() || !this.dragGroup()) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tone: AdActionTone = event.clientY < rect.top + rect.height / 2 ? 'in' : 'out';
    const taken = this.halfIsTaken(term, tone);
    if (event.dataTransfer) event.dataTransfer.dropEffect = taken ? 'none' : 'copy';
    this.dropHover.set({ terminalId: term.id, tone });
  }

  protected onAddSlotDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const cur = event.currentTarget as Node | null;
    if (cur && related && cur.contains(related)) return;
    this.dropHover.set(null);
  }

  protected onAddSlotDrop(term: AdTerminal, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const raw =
      event.dataTransfer?.getData('text/ad-group') ||
      event.dataTransfer?.getData('text/plain') ||
      this.dragGroup() ||
      '';
    this.dragGroup.set(null);
    if (!AD_PALETTE_GROUPS.some((g) => g.id === raw)) {
      this.dropHover.set(null);
      return;
    }
    const el = event.currentTarget as HTMLElement | null;
    let tone: AdActionTone = 'in';
    const hover = this.dropHover();
    if (hover && hover.terminalId === term.id) {
      tone = hover.tone;
    } else if (el) {
      const rect = el.getBoundingClientRect();
      tone = event.clientY < rect.top + rect.height / 2 ? 'in' : 'out';
    }
    this.dropHover.set(null);
    const groupId = raw as AdPaletteGroupId;
    const kind = adKindForDrop(groupId, tone);
    if (term.actions.some((a) => a.kind === kind)) return;
    this.addGroupToTerminal(term.id, groupId, tone);
  }

  protected addGroupToTerminal(
    terminalId: string,
    groupId: AdPaletteGroupId,
    tone: AdActionTone,
  ): void {
    const kind = adKindForDrop(groupId, tone);
    this.draft.update((d) => ({
      ...d,
      terminals: d.terminals.map((t) => {
        if (t.id !== terminalId) return t;
        if (t.actions.some((a) => a.kind === kind)) return t;
        return {
          ...t,
          actions: [...t.actions, createAdAction(kind, this.blockDefaults())],
        };
      }),
    }));
    this.scrollTerminalEventsToEnd(terminalId);
  }

  /** Keep the drop slot / newest block in view when the row overflows. */
  private scrollTerminalEventsToEnd(terminalId: string): void {
    setTimeout(() => {
      const row = document.querySelector(
        `.ad-term__events[data-term-scroll="${CSS.escape(terminalId)}"]`,
      ) as HTMLElement | null;
      if (!row) return;
      row.scrollTo({ left: row.scrollWidth, behavior: 'smooth' });
    }, 0);
  }


  protected removeAction(terminalId: string, kind: AdActionKind): void {
    this.draft.update((d) => ({
      ...d,
      terminals: d.terminals.map((t) =>
        t.id === terminalId ? { ...t, actions: t.actions.filter((a) => a.kind !== kind) } : t,
      ),
    }));
  }

  protected patchAction(terminalId: string, kind: AdActionKind, patch: Partial<AdAction>): void {
    this.draft.update((d) => ({
      ...d,
      terminals: d.terminals.map((t) => {
        if (t.id !== terminalId) return t;
        return {
          ...t,
          actions: t.actions.map((a) => (a.kind === kind ? ({ ...a, ...patch } as AdAction) : a)),
        };
      }),
    }));
  }

  /** Paint overlay before heavy Excel work so the UI does not look frozen. */
  private async withBusy<T>(label: string, work: () => Promise<T>): Promise<T> {
    this.busyLabel.set(label);
    this.busy.set(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      return await work();
    } finally {
      this.busy.set(false);
      this.busyLabel.set('');
    }
  }

  protected newDocument(): void {
    this.closeTerminalEditIfOpen();
    this.draft.set(this.buildSeed());
    this.selectedFile.set('');
    this.toast.show('New A&D document', 'info');
  }

  /** Detach the open file — keep current data as a new unsaved document. */
  protected copyAsNew(): void {
    if (!this.hasOpenFile()) return;
    this.closeTerminalEditIfOpen();
    this.selectedFile.set('');
    this.draft.update((d) => this.withProgramShip(d));
    this.toast.show('Copy — Save to write a new file', 'info');
  }

  private closeTerminalEditIfOpen(): void {
    if (this.editDraft()) this.closeTerminalEdit();
  }

  /** Reload draft from the currently open Excel file. */
  protected async refreshOpenFile(): Promise<void> {
    const path = this.filePath().trim();
    if (!path) return;
    await this.loadFileAt(path, 'Refreshing…');
  }

  protected async pickFolder(): Promise<void> {
    const api = window.electronAPI;
    if (!api?.pickDirectory) {
      this.toast.showError('Folder pick needs the desktop app');
      return;
    }
    const picked = await api.pickDirectory(this.folderPath().trim() || undefined);
    if (!picked) return;
    this.folderPath.set(picked);
    this.selectedFile.set('');
    await this.refreshFolderFiles();
    this.toast.show('Folder selected — pick a file from the list', 'info');
  }

  protected async refreshFolderFiles(): Promise<void> {
    const api = window.electronAPI;
    const folder = this.folderPath().trim();
    if (!folder || !api?.listExcelFiles) {
      this.folderFiles.set([]);
      return;
    }
    try {
      const names = await api.listExcelFiles(folder);
      this.folderFiles.set(names);
      const sel = this.selectedFile();
      if (sel && !names.includes(sel)) this.selectedFile.set('');
    } catch {
      this.folderFiles.set([]);
    }
  }

  protected async onFileSelect(fileName: string): Promise<void> {
    const name = (fileName ?? '').trim();
    if (!name) {
      this.selectedFile.set('');
      return;
    }
    const folder = this.folderPath().trim();
    if (!folder) {
      this.toast.showError('Choose a folder first');
      return;
    }
    await this.loadFileAt(joinAdPath(folder, name));
  }

  /** RMB on the Excel select — open the chosen workbook in the system app. */
  protected onExcelSelectContextMenu(event: MouseEvent): void {
    event.preventDefault();
    void this.openSelectedExcelFile();
  }

  private async openSelectedExcelFile(): Promise<void> {
    const path = this.filePath().trim();
    if (!path) {
      this.toast.showError('Select an Excel file first');
      return;
    }
    const api = window.electronAPI;
    if (!api?.openFilePath) {
      this.toast.showError('Open file needs the desktop app');
      return;
    }
    const res = await api.openFilePath(path);
    if (!res.ok) this.toast.showError(res.error || 'Could not open Excel file');
  }

  /**
   * LMB — open that folder in Explorer (last crumb = current folderPath).
   * RMB on last crumb — drop it so the previous folder becomes current.
   */
  protected onPathSegmentPress(seg: AdPathSegment, last: boolean, event: MouseEvent): void {
    event.preventDefault();
    if (event.button === 2) {
      if (last) this.popLastFolder();
      return;
    }
    if (event.button !== 0) return;
    void this.openFolderInExplorer(last ? this.folderPath().trim() || seg.openPath : seg.openPath);
  }

  /** Drop the trailing folder from the working path (RMB on last crumb). */
  protected popLastFolder(): void {
    const current = this.folderPath().trim().replace(/[\\/]+$/, '');
    if (!current) return;
    const parent = dirnameAdPath(current);
    if (!parent || parent === current) return;
    this.folderPath.set(parent);
    this.selectedFile.set('');
    void this.refreshFolderFiles();
  }

  private async openFolderInExplorer(dirPath: string): Promise<void> {
    const api = window.electronAPI;
    if (!api?.openDirectory) {
      this.toast.showError('Open folder only works in the desktop app');
      return;
    }
    const p = dirPath.trim();
    if (!p) return;
    const res = await api.openDirectory(p);
    if (!res.ok) this.toast.showError(res.error || 'Could not open folder');
  }

  private async loadFileAt(fullPath: string, busyText = 'Opening Excel…'): Promise<void> {
    const api = window.electronAPI;
    if (!api?.readFileBase64) {
      this.toast.showError('Open file needs the desktop app');
      return;
    }
    this.closeTerminalEditIfOpen();
    try {
      await this.withBusy(busyText, async () => {
        const read = await api.readFileBase64(fullPath);
        if (!read.ok || !read.base64) {
          this.toast.showError(read.error ?? 'Could not read file');
          return;
        }
        const draft = await parseAdReportFromXlsxBytes(base64ToUint8(read.base64));
        this.draft.set(this.withProgramShip(draft));
        const folder = dirnameAdPath(fullPath);
        const name = basenameAdPath(fullPath);
        if (folder) this.folderPath.set(folder);
        this.selectedFile.set(name);
        await this.refreshFolderFiles();
        this.toast.showSaved(
          busyText.startsWith('Refresh') ? `Refreshed ${name}` : `Opened ${name}`,
        );
      });
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Could not open A&D file');
    }
  }

  protected async saveDocument(): Promise<void> {
    // Apply open terminal modal before validating / writing Excel.
    if (this.editDraft()) this.commitTerminalEdit();
    const d = this.draft();
    if (!d.portCode.trim()) {
      this.toast.showError('Enter Port code');
      return;
    }
    if (!d.portCallId.trim()) {
      this.toast.showError('Enter Port call ID');
      return;
    }
    if (!d.terminals.some((t) => t.code.trim())) {
      this.toast.showError('Add at least one terminal code');
      return;
    }

    try {
      const toSave = this.withProgramShip(d);
      this.draft.set(toSave);
      const suggested = buildAdFileNameFromPattern(
        this.fileNamePattern(),
        toSave,
        this.folderFiles(),
      );
      const api = window.electronAPI;

      // Ask for path first (no overlay) when this is a new / Copy document.
      let targetPath = this.filePath().trim();
      if (api?.writeFileBase64 && !targetPath) {
        if (!api.pickSaveExcelFile) {
          const bytes = await this.withBusy('Saving Excel…', () => buildAdReportXlsxBytes(toSave));
          await openExcelBytes(suggested, bytes);
          this.syncWorkspaceToStore(true);
          this.toast.showSaved(`Downloaded ${suggested}`);
          return;
        }
        const folder = this.folderPath().trim();
        const defaultPath = folder ? joinAdPath(folder, suggested) : suggested;
        const picked = await api.pickSaveExcelFile(defaultPath);
        if (!picked) return;
        targetPath = picked;
      }

      await this.withBusy('Saving Excel…', async () => {
        const bytes = await buildAdReportXlsxBytes(toSave);
        if (api?.writeFileBase64 && targetPath) {
          const write = await api.writeFileBase64(targetPath, uint8ToBase64(bytes));
          if (!write.ok) {
            this.toast.showError(write.error ?? 'Could not write file');
            return;
          }
          const dir = dirnameAdPath(targetPath);
          const name = basenameAdPath(targetPath);
          if (dir) this.folderPath.set(dir);
          this.selectedFile.set(name);
          await this.refreshFolderFiles();
          this.syncWorkspaceToStore(true);
          this.toast.showSaved(`Saved ${name}`);
          return;
        }
        await openExcelBytes(suggested, bytes);
        this.syncWorkspaceToStore(true);
        this.toast.showSaved(`Downloaded ${suggested}`);
      });
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Could not save A&D Excel');
    }
  }
}

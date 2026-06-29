import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { PkgBarComponent } from './components/pkg-bar/pkg-bar.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ToastComponent } from './components/toast/toast.component';
import { StorageService } from './services/storage.service';
import { DocumentSettingsStore } from './services/document-settings.store';
import { FolderAccessService } from './services/folder-access.service';
import { ToastService } from './services/toast.service';
import { TitleTooltipService } from './services/title-tooltip.service';
import { DgPageArchiveService } from './services/dg-page-archive.service';
import { ReeferPageArchiveService } from './services/reefer-page-archive.service';
import { AppSnapshotArchiveService } from './services/app-snapshot-archive.service';
import { CrewListHtmlFormExcelService } from './services/crew-list-html-form-excel.service';
import { AppStateStore } from './services/app-state.store';
import { SectionLockService } from './services/section-lock.service';
import { SectionReadonlyDomService } from './services/section-readonly-dom.service';
import { sectionFromRoutePath, AppSection } from './utils/app-data-section.util';
import { uint8ToBase64 } from './utils/base64.util';

interface FolderOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PkgBarComponent,
    ConfirmDialogComponent,
    ToastComponent,
    FormsModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private static readonly FOLDER_HOLD_MS = 500;

  private readonly storage = inject(StorageService);
  private readonly docSettings = inject(DocumentSettingsStore);
  private readonly folderAccess = inject(FolderAccessService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly titleTooltips = inject(TitleTooltipService);
  private readonly dgPageArchive = inject(DgPageArchiveService);
  private readonly reeferPageArchive = inject(ReeferPageArchiveService);
  private readonly appSnapshotArchive = inject(AppSnapshotArchiveService);
  private readonly htmlFormExcel = inject(CrewListHtmlFormExcelService);
  private readonly appState = inject(AppStateStore);
  protected readonly sectionLock = inject(SectionLockService);
  private readonly sectionReadonlyDom = inject(SectionReadonlyDomService);
  private folderHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private folderHoldTriggered = false;

  protected readonly outputSettings = this.storage.outputSettings;
  /** Desktop build writes to a typed absolute path. */
  protected readonly hasElectron = !!window.electronAPI;
  /** Website (Chrome/Edge) writes via granted folder handles. */
  protected readonly fsSupported = this.folderAccess.supported;
  /** Whether folder saving is possible at all in this environment. */
  protected readonly canSaveToFolder = this.hasElectron || this.fsSupported;

  /** Unified folder list for the dropdown (desktop paths or website folders). */
  protected readonly folderOptions = computed<FolderOption[]>(() =>
    this.hasElectron
      ? this.outputSettings().savedPaths.map((p) => ({ id: p, label: p }))
      : this.folderAccess.folders().map((f) => ({ id: f.id, label: f.name })),
  );

  protected readonly activeFolderId = computed(() =>
    this.hasElectron ? this.outputSettings().activePath : this.folderAccess.activeId(),
  );

  /** Package bar — hidden on DG / Reefer inventory pages. */
  protected readonly showPkgBar = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => !this.isStandaloneInventoryRoute()),
      startWith(!this.isStandaloneInventoryRoute()),
    ),
    { initialValue: !this.isStandaloneInventoryRoute() },
  );

  protected readonly sectionLockBanner = this.sectionLock.lockBanner;
  protected readonly sectionReadOnly = computed(
    () => this.sectionLock.readOnly() || !!this.sectionLock.displacedBy(),
  );
  protected readonly cooperativeSharing = this.sectionLock.cooperativeMode;
  protected readonly refreshBusy = signal(false);
  protected readonly takeOverBusy = signal(false);

  constructor() {
    effect(() => {
      const tick = this.sectionLock.lockLostTick();
      if (tick > 0) {
        void this.reloadCurrentSectionAfterLockLost();
      }
    });
  }

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const embeddedExcel = params.get('embed') === '1' && !!params.get('htmlFormExcel');
    if (embeddedExcel) {
      document.documentElement.classList.add('html-form-excel-embed');
    }

    this.titleTooltips.install();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.onMainSectionNav(e.urlAfterRedirects);
      });
    void this.storage.init().then(async () => {
      if (embeddedExcel) {
        await this.runEmbeddedHtmlFormExcelExport();
        return;
      }
      this.dgPageArchive.restoreSession();
      this.reeferPageArchive.restoreSession();
      this.appSnapshotArchive.restoreSession();
      await this.onMainSectionNav(this.router.url);
    });
    void this.folderAccess.restore();
    window.electronAPI?.onAppRestoredFromTray?.(() => {
      void this.onRestoredFromTray();
    });
  }

  /** Hidden iframe from an HTML form editor — build Excel and post bytes to the parent page. */
  private async runEmbeddedHtmlFormExcelExport(): Promise<void> {
    let ok = false;
    let error: string | undefined;
    let fileName: string | undefined;
    let bytesBase64: string | undefined;
    try {
      const built = await this.htmlFormExcel.buildFromSessionStorage();
      if (!built) {
        error = 'Could not export Excel — form data missing or invalid';
      } else {
        ok = true;
        fileName = built.fileName;
        bytesBase64 = uint8ToBase64(built.bytes);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Excel export failed';
      console.error('Embedded HTML form Excel export failed', err);
    }
    try {
      window.parent.postMessage(
        {
          type: 'crewHtmlFormExcelDone',
          ok,
          error,
          fileName,
          bytesBase64,
        },
        window.location.origin,
      );
    } catch {
      /* parent may be gone */
    }
  }

  protected toggleSaveToFolder(saveToFolder: boolean): void {
    this.docSettings.updateOutputSettings({ saveToFolder });
  }

  protected selectFolder(id: string): void {
    if (this.hasElectron) {
      this.docSettings.updateOutputSettings({ activePath: id });
    } else {
      this.folderAccess.setActive(id);
      this.docSettings.updateOutputSettings({ activePath: this.folderAccess.activeName() });
    }
  }

  protected async addFolder(): Promise<void> {
    if (this.hasElectron) {
      const picked = await window.electronAPI?.pickDirectory();
      if (picked) this.docSettings.addSavedPath(picked);
      else return;
    } else {
      const name = await this.folderAccess.pick();
      if (!name) return;
      this.docSettings.updateOutputSettings({ activePath: name });
    }
    this.docSettings.updateOutputSettings({ saveToFolder: true });
  }

  protected async removeActiveFolder(): Promise<void> {
    const id = this.activeFolderId();
    if (!id) return;
    if (this.hasElectron) {
      this.docSettings.removeSavedPath(id);
    } else {
      await this.folderAccess.remove(id);
      this.docSettings.updateOutputSettings({ activePath: this.folderAccess.activeName() });
    }
  }

  protected folderBtnTitle(): string {
    return this.hasElectron ? 'ADD A FOLDER OR HOLD TO OPEN' : 'Add a folder';
  }

  protected onFolderBtnDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.folderHoldTriggered = false;
    this.clearFolderHoldTimer();
    if (!this.hasElectron) return;
    this.folderHoldTimer = setTimeout(() => {
      this.folderHoldTriggered = true;
      void this.openActiveFolder();
    }, App.FOLDER_HOLD_MS);
  }

  protected onFolderBtnUp(): void {
    this.clearFolderHoldTimer();
    if (this.folderHoldTriggered) {
      this.folderHoldTriggered = false;
      return;
    }
    void this.addFolder();
  }

  protected onFolderBtnLeave(): void {
    if (this.folderHoldTriggered) return;
    this.clearFolderHoldTimer();
  }

  private clearFolderHoldTimer(): void {
    if (this.folderHoldTimer != null) {
      clearTimeout(this.folderHoldTimer);
      this.folderHoldTimer = null;
    }
  }

  private async openActiveFolder(): Promise<void> {
    const dir = this.activeFolderId();
    if (!dir) {
      this.toast.showError('Choose a folder first');
      return;
    }
    const res = await window.electronAPI?.openDirectory(dir);
    if (res && !res.ok) {
      this.toast.showError(res.error ?? 'Could not open folder');
    }
  }

  private isStandaloneInventoryRoute(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/dg' || path === '/reefer' || path === '/eta';
  }

  private shouldSkipSectionReload(section: NonNullable<ReturnType<typeof sectionFromRoutePath>>): boolean {
    if (section === 'home' && this.appSnapshotArchive.loaded()) return true;
    if (section === 'dg' && this.dgPageArchive.loaded()) return true;
    if (section === 'reefer' && this.reeferPageArchive.loaded()) return true;
    return false;
  }

  private async onMainSectionNav(url: string): Promise<void> {
    const section = sectionFromRoutePath(url);
    if (section && this.hasElectron && !this.shouldSkipSectionReload(section)) {
      await this.appState.reloadSectionFromDisk(section);
    }
    await this.sectionLock.onNavigate(section);
  }

  protected navLockTooltip(section: AppSection): string {
    return this.sectionLock.navLockTooltip(section);
  }

  protected navLockBadge(section: AppSection): string | null {
    return this.sectionLock.navLockBadge(section);
  }

  protected navLockState(section: AppSection): string {
    return this.sectionLock.navLockState(section);
  }

  protected async refreshFromDisk(): Promise<void> {
    if (!this.hasElectron || this.refreshBusy()) return;
    const section = sectionFromRoutePath(this.router.url);
    if (!section) return;
    if (this.shouldSkipSectionReload(section)) {
      this.toast.show('Cannot refresh while an archive snapshot is loaded', 'warning');
      return;
    }
    this.refreshBusy.set(true);
    try {
      await this.appState.reloadSectionFromDisk(section);
      await this.sectionLock.refreshPeerLocks();
      await this.sectionLock.refreshCurrentLockState();
      this.toast.show('Data refreshed from shared folder', 'success');
    } catch (err) {
      console.error(err);
      this.toast.showError('Could not refresh data');
    } finally {
      this.refreshBusy.set(false);
    }
  }

  private async onRestoredFromTray(): Promise<void> {
    if (!this.hasElectron) return;
    try {
      await this.appState.reloadAllFromDisk();
      await this.sectionLock.refreshPeerLocks();
      await this.sectionLock.refreshCurrentLockState();
      this.toast.show('Data refreshed from shared folder', 'success');
    } catch (err) {
      console.error(err);
      this.toast.showError('Could not refresh data');
    }
  }

  protected async takeOverSection(): Promise<void> {
    if (!this.hasElectron || this.takeOverBusy()) return;
    this.takeOverBusy.set(true);
    try {
      const ok = await this.sectionLock.takeOverControl();
      if (!ok) {
        this.toast.showError('Could not take over this section');
        return;
      }
      const section = sectionFromRoutePath(this.router.url);
      if (section && !this.shouldSkipSectionReload(section)) {
        await this.appState.reloadSectionFromDisk(section);
      }
      this.toast.show('You now have control of this section', 'success');
    } catch (err) {
      console.error(err);
      this.toast.showError('Could not take over this section');
    } finally {
      this.takeOverBusy.set(false);
    }
  }

  private async reloadCurrentSectionAfterLockLost(): Promise<void> {
    if (!this.hasElectron) return;
    const section = sectionFromRoutePath(this.router.url);
    if (!section || this.shouldSkipSectionReload(section)) return;
    try {
      await this.appState.reloadSectionFromDisk(section);
      await this.sectionLock.refreshPeerLocks();
      this.toast.show('Another user took control — your view was refreshed', 'warning');
    } catch (err) {
      console.error(err);
    }
  }
}

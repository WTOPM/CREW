import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NavigationEnd,
  RouteReuseStrategy,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
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
import { TextCaseHotkeyService } from './services/text-case-hotkey.service';
import { DgPageArchiveService } from './services/dg-page-archive.service';
import { ReeferPageArchiveService } from './services/reefer-page-archive.service';
import { AppSnapshotArchiveService } from './services/app-snapshot-archive.service';
import { CrewListHtmlFormExcelService } from './services/crew-list-html-form-excel.service';
import { DataSetupComponent } from './components/data-setup/data-setup.component';
import { AppStateStore, type AppInitResult } from './services/app-state.store';
import { DgUnReferenceStore } from './services/dg-un-reference.store';
import { ElectronLocalPrefsService } from './services/electron-local-prefs.service';
import { NetworkForceQuitService } from './services/network-force-quit.service';
import { SectionLockService } from './services/section-lock.service';
import { AppRouteReuseStrategy } from './routing/app-route-reuse.strategy';
import { sectionFromRoutePath } from './utils/app-data-section.util';
import {
  getOutputFolderPrefs,
  outputFolderSectionFromRoute,
} from './utils/output-folder-section.util';
import type { OutputFolderSection } from './models/crew.models';
import { uint8ToBase64 } from './utils/base64.util';

/** Main nav pages — warmed once after startup so tab switches stay in RAM. */
const MAIN_NAV_WARM_PATHS = ['/', '/dg', '/eta', '/fuel', '/phone', '/settings'] as const;

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
    DataSetupComponent,
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
  private readonly textCaseHotkeys = inject(TextCaseHotkeyService);
  private readonly dgPageArchive = inject(DgPageArchiveService);
  private readonly reeferPageArchive = inject(ReeferPageArchiveService);
  private readonly appSnapshotArchive = inject(AppSnapshotArchiveService);
  private readonly htmlFormExcel = inject(CrewListHtmlFormExcelService);
  private readonly appState = inject(AppStateStore);
  /**
   * Injected for its side effect: keeps the UN-number lookup helpers on the imported
   * IMDG list. Tooltips and DG autofill would silently use the bundled list otherwise.
   */
  private readonly unReference = inject(DgUnReferenceStore);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly networkForceQuit = inject(NetworkForceQuitService);
  private readonly sectionLock = inject(SectionLockService);
  private readonly routeReuse = inject(RouteReuseStrategy);
  private folderHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private folderHoldTriggered = false;

  protected readonly outputSettings = this.storage.outputSettings;
  /** Desktop build writes to a typed absolute path. */
  protected readonly hasElectron = !!window.electronAPI;
  protected readonly minimizeToTray = this.localPrefs.minimizeToTray;
  /** Website (Chrome/Edge) writes via granted folder handles. */
  protected readonly fsSupported = this.folderAccess.supported;
  /** Whether folder saving is possible at all in this environment. */
  protected readonly canSaveToFolder = this.hasElectron || this.fsSupported;

  /** Home / DG / Reefer show the save-folder bar; ETA / Settings hide it. */
  protected readonly outputFolderSection = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => outputFolderSectionFromRoute(this.router.url)),
      startWith(outputFolderSectionFromRoute(this.router.url)),
    ),
    { initialValue: outputFolderSectionFromRoute(this.router.url) },
  );

  protected readonly showOutputBar = computed(() => this.outputFolderSection() != null);

  protected readonly sectionOutputPrefs = computed(() => {
    const section = this.outputFolderSection();
    if (!section) return null;
    return getOutputFolderPrefs(this.outputSettings(), section);
  });

  /** Unified folder list for the dropdown (desktop paths or website folders). */
  protected readonly folderOptions = computed<FolderOption[]>(() => {
    if (!this.hasElectron) {
      return this.folderAccess.folders().map((f) => ({ id: f.id, label: f.name }));
    }
    const prefs = this.sectionOutputPrefs();
    return (prefs?.savedPaths ?? []).map((p) => ({ id: p, label: p }));
  });

  protected readonly activeFolderId = computed(() => {
    if (!this.hasElectron) return this.folderAccess.activeId();
    return this.sectionOutputPrefs()?.activePath ?? '';
  });

  /** Package bar — hidden on DG / Reefer inventory pages. */
  protected readonly showPkgBar = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => !this.isStandaloneInventoryRoute()),
      startWith(!this.isStandaloneInventoryRoute()),
    ),
    { initialValue: !this.isStandaloneInventoryRoute() },
  );

  protected readonly refreshBusy = signal(false);
  protected readonly dataSetup = signal<{ reason: AppInitResult } | null>(null);

  ngOnInit(): void {
    void this.localPrefs.load();

    const params = new URLSearchParams(window.location.search);
    const embeddedExcel = params.get('embed') === '1' && !!params.get('htmlFormExcel');
    if (embeddedExcel) {
      document.documentElement.classList.add('html-form-excel-embed');
    }

    this.titleTooltips.install();
    this.textCaseHotkeys.install();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.onMainSectionNav(e.urlAfterRedirects);
      });
    void this.storage.init().then(async (result) => {
      if (embeddedExcel) {
        if (result !== 'loaded') {
          if (this.hasElectron) {
            this.dataSetup.set({ reason: result });
          }
          return;
        }
        await this.runEmbeddedHtmlFormExcelExport();
        return;
      }
      if (result !== 'loaded' && this.hasElectron) {
        this.dataSetup.set({ reason: result });
        return;
      }
      await this.finishAppStartup();
    });
    void this.folderAccess.restore();
    window.electronAPI?.onAppRestoredFromTray?.(() => {
      void this.onRestoredFromTray();
    });
    // Full Quit only: write shared data, then main copies the local on-close backup.
    // No flush on tab switch / blur / minimize / tray — slow on weak LAN.
    window.electronAPI?.onPrepareQuit?.(() => this.flushPendingToDisk());
  }

  /** Write RAM edits to the shared/local data file only when dirty (no toast). */
  private async flushPendingToDisk(): Promise<void> {
    if (!this.appState.hasPendingPersist()) return;
    try {
      // Quit path: keep open Settings-modal edits and merge every dirty section.
      await this.appState.flushPersistForQuit();
    } catch {
      /* ignore — quit path */
    }
  }

  protected onDataSetupResolved(): void {
    this.dataSetup.set(null);
    void this.finishAppStartup();
  }

  private async finishAppStartup(): Promise<void> {
    this.appSnapshotArchive.migrateLegacyLocalStorage();
    this.dgPageArchive.migrateLegacyLocalStorage();
    this.reeferPageArchive.migrateLegacyLocalStorage();
    this.dgPageArchive.restoreSession();
    this.reeferPageArchive.restoreSession();
    this.appSnapshotArchive.restoreSession();
    this.networkForceQuit.startWatching();
    await this.onMainSectionNav(this.router.url);
    // AppData is already fully in RAM from init(); warm page components so
    // later tab clicks do not pay first-mount cost (Fuel/DG tables, etc.).
    void this.warmMainNavRoutes();
  }

  /** While true, NavigationEnd must not move sectionLock (dirty-section tracking). */
  private warmingRoutes = false;

  /**
   * Quietly visit each main nav route (URL bar unchanged) so RouteReuseStrategy
   * keeps the pages ready. Runs after first paint of the current tab.
   */
  private async warmMainNavRoutes(): Promise<void> {
    const returnUrl = this.router.url;
    const currentPath = returnUrl.split('?')[0].split('#')[0] || '/';
    this.warmingRoutes = true;
    try {
      for (const path of MAIN_NAV_WARM_PATHS) {
        if (path === currentPath) continue;
        try {
          await this.router.navigateByUrl(path, { skipLocationChange: true });
        } catch {
          /* ignore failed warm nav */
        }
      }
      try {
        await this.router.navigateByUrl(returnUrl, { skipLocationChange: true });
      } catch {
        /* ignore */
      }
    } finally {
      this.warmingRoutes = false;
      // Restore section lock to the visible tab after warm navigations.
      await this.onMainSectionNav(this.router.url);
    }
  }

  private clearCachedRoutes(): void {
    const strategy = this.routeReuse;
    if (strategy instanceof AppRouteReuseStrategy) strategy.clear();
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

  protected onMinimizeToTrayChange(enabled: boolean): void {
    void this.localPrefs.setMinimizeToTray(enabled);
  }

  protected toggleSaveToFolder(saveToFolder: boolean): void {
    const section = this.requireOutputSection();
    if (!section) return;
    this.docSettings.updateOutputFolderPrefs(section, { saveToFolder });
  }

  protected selectFolder(id: string): void {
    const section = this.requireOutputSection();
    if (!section) return;
    if (this.hasElectron) {
      this.docSettings.updateOutputFolderPrefs(section, { activePath: id });
    } else {
      this.folderAccess.setActive(id);
      this.docSettings.updateOutputFolderPrefs(section, {
        activePath: this.folderAccess.activeName(),
      });
    }
  }

  protected async addFolder(): Promise<void> {
    const section = this.requireOutputSection();
    if (!section) return;
    if (this.hasElectron) {
      const picked = await window.electronAPI?.pickDirectory();
      if (picked) this.docSettings.addSavedPath(section, picked);
      else return;
    } else {
      const name = await this.folderAccess.pick();
      if (!name) return;
      this.docSettings.updateOutputFolderPrefs(section, { activePath: name });
    }
    this.docSettings.updateOutputFolderPrefs(section, { saveToFolder: true });
  }

  protected async removeActiveFolder(): Promise<void> {
    const section = this.requireOutputSection();
    if (!section) return;
    const id = this.activeFolderId();
    if (!id) return;
    if (this.hasElectron) {
      this.docSettings.removeSavedPath(section, id);
    } else {
      await this.folderAccess.remove(id);
      this.docSettings.updateOutputFolderPrefs(section, {
        activePath: this.folderAccess.activeName(),
      });
    }
  }

  private requireOutputSection(): OutputFolderSection | null {
    return this.outputFolderSection();
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
    return path === '/dg' || path === '/reefer' || path === '/eta' || path === '/fuel';
  }

  private shouldSkipSectionReload(
    section: NonNullable<ReturnType<typeof sectionFromRoutePath>>,
  ): boolean {
    if (section === 'home' && this.appSnapshotArchive.loaded()) return true;
    if (section === 'dg' && this.dgPageArchive.loaded()) return true;
    if (section === 'reefer' && this.reeferPageArchive.loaded()) return true;
    return false;
  }

  private async onMainSectionNav(url: string): Promise<void> {
    // Warm-up navigations must not rotate activeSection (dirty merge keys).
    if (this.warmingRoutes) return;
    const section = sectionFromRoutePath(url);
    const folderSection = outputFolderSectionFromRoute(url);
    if (folderSection) {
      this.folderAccess.setSection(folderSection);
    }
    // No disk write on tab switch — Save / Done / Quit only (weak LAN).
    await this.sectionLock.onNavigate(section);
  }

  protected async refreshFromDisk(): Promise<void> {
    if (!this.hasElectron || this.refreshBusy()) return;
    const section = sectionFromRoutePath(this.router.url);
    if (!section) return;
    if (this.shouldSkipSectionReload(section)) {
      this.toast.show('Cannot refresh while an archive snapshot is loaded', 'warning');
      return;
    }
    if (this.appState.hasPendingPersist()) {
      // Include open Settings-modal edits; never reload over unsaved RAM.
      await this.appState.flushPersistForQuit();
      if (this.appState.hasPendingPersist()) {
        this.toast.showError('Could not save pending edits — refresh cancelled');
        return;
      }
    }
    this.refreshBusy.set(true);
    try {
      // One shared-folder read → full AppData (all tabs stay in sync).
      await this.appState.reloadAllFromDisk();
      this.clearCachedRoutes();
      await this.router.navigateByUrl(this.router.url, {
        onSameUrlNavigation: 'reload',
        skipLocationChange: true,
      });
      void this.warmMainNavRoutes();
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
      // Keep unsaved RAM edits — do not write on tray restore (weak LAN).
      if (this.appState.hasPendingPersist()) {
        this.toast.show('Unsaved edits kept in memory — use Save or Quit to write', 'info');
        return;
      }
      await this.appState.reloadAllFromDisk();
      this.clearCachedRoutes();
      await this.router.navigateByUrl(this.router.url, {
        onSameUrlNavigation: 'reload',
        skipLocationChange: true,
      });
      void this.warmMainNavRoutes();
      this.toast.show('Data refreshed from shared folder', 'success');
    } catch (err) {
      console.error(err);
      this.toast.showError('Could not refresh data');
    }
  }
}

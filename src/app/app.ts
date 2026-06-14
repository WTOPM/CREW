import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { PkgBarComponent } from './components/pkg-bar/pkg-bar.component';
import { ToastComponent } from './components/toast/toast.component';
import { StorageService } from './services/storage.service';
import { FolderAccessService } from './services/folder-access.service';
import { ToastService } from './services/toast.service';

interface FolderOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PkgBarComponent, ToastComponent, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private static readonly FOLDER_HOLD_MS = 500;

  private readonly storage = inject(StorageService);
  private readonly folderAccess = inject(FolderAccessService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
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

  ngOnInit(): void {
    void this.storage.init();
    void this.folderAccess.restore();
  }

  protected toggleSaveToFolder(saveToFolder: boolean): void {
    this.storage.updateOutputSettings({ saveToFolder });
  }

  protected selectFolder(id: string): void {
    if (this.hasElectron) {
      this.storage.updateOutputSettings({ activePath: id });
    } else {
      this.folderAccess.setActive(id);
      this.storage.updateOutputSettings({ activePath: this.folderAccess.activeName() });
    }
  }

  protected async addFolder(): Promise<void> {
    if (this.hasElectron) {
      const picked = await window.electronAPI?.pickDirectory();
      if (picked) this.storage.addSavedPath(picked);
      else return;
    } else {
      const name = await this.folderAccess.pick();
      if (!name) return;
      this.storage.updateOutputSettings({ activePath: name });
    }
    this.storage.updateOutputSettings({ saveToFolder: true });
  }

  protected async removeActiveFolder(): Promise<void> {
    const id = this.activeFolderId();
    if (!id) return;
    if (this.hasElectron) {
      this.storage.removeSavedPath(id);
    } else {
      await this.folderAccess.remove(id);
      this.storage.updateOutputSettings({ activePath: this.folderAccess.activeName() });
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
    return path === '/dg' || path === '/reefer';
  }
}

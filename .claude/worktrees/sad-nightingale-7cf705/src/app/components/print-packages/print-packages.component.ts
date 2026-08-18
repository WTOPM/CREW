import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortPackage, PortPackageItem } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { DocumentSettingsStore } from '../../services/document-settings.store';
import { DocumentCatalogService } from '../../services/document-catalog.service';
import { PackageRunnerService } from '../../services/package-runner.service';
import { ToastService } from '../../services/toast.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { NumberSpinDirective } from '../../directives/number-spin.directive';

@Component({
  selector: 'app-print-packages',
  imports: [FormsModule, ClickOutsideDirective, NumberSpinDirective],
  templateUrl: './print-packages.component.html',
  styleUrl: './print-packages.component.css',
})
export class PrintPackagesComponent implements OnInit {
  readonly closed = output<void>();

  private readonly storage = inject(StorageService);
  private readonly docSettings = inject(DocumentSettingsStore);
  private readonly catalog = inject(DocumentCatalogService);
  private readonly toast = inject(ToastService);
  protected readonly runner = inject(PackageRunnerService);

  protected readonly hasElectron = !!window.electronAPI;
  protected readonly ports = this.storage.ports;
  protected readonly packages = this.storage.printPackages;
  protected readonly outputSettings = this.storage.outputSettings;

  protected readonly printers = signal<{ name: string; displayName: string }[]>([]);
  protected readonly newPort = signal('');
  /** Which port card is expanded (accordion). */
  protected readonly expanded = signal<string>('');

  protected readonly currentPort = computed(() => this.storage.ship().portOfCall);

  protected readonly catalogDocs = computed(() => this.catalog.available());

  /** Ports not yet configured (for the add dropdown). */
  protected readonly addablePorts = computed(() => {
    const used = new Set(this.packages().map((p) => p.port));
    return this.ports()
      .map((p) => p.name)
      .filter((name) => !used.has(name));
  });

  ngOnInit(): void {
    // Expand the current port's card by default if it has a package.
    const cur = this.currentPort();
    if (this.packages().some((p) => p.port === cur)) this.expanded.set(cur);
    if (this.hasElectron) {
      void window.electronAPI?.listPrinters().then((list) => {
        this.printers.set(list.map((p) => ({ name: p.name, displayName: p.displayName })));
      });
    }
  }

  protected close(): void {
    this.storage.finishFormSession();
    this.closed.emit();
  }

  protected portDocCount(pkg: PortPackage): number {
    return pkg.authorities.reduce(
      (sum, a) => sum + a.items.filter((it) => it.documentId.trim()).length,
      0,
    );
  }

  protected hasRunnableItems(items: PortPackageItem[]): boolean {
    return items.some((it) => it.documentId.trim());
  }

  protected toggle(port: string): void {
    this.expanded.update((cur) => (cur === port ? '' : port));
  }

  // --- ports ---
  protected addPort(): void {
    const port = this.newPort();
    if (!port) return;
    this.docSettings.upsertPortPackage(port);
    this.expanded.set(port);
    this.newPort.set('');
  }

  protected removePort(port: string): void {
    this.docSettings.removePortPackage(port);
  }

  // --- authorities ---
  protected addAuthority(port: string): void {
    this.docSettings.addAuthority(port, '');
  }

  protected removeAuthority(port: string, authIndex: number): void {
    this.docSettings.removeAuthority(port, authIndex);
  }

  protected renameAuthority(port: string, authIndex: number, name: string): void {
    this.docSettings.renameAuthority(port, authIndex, name);
  }

  protected setAuthorityIncludeInPrint(
    port: string,
    authIndex: number,
    authorityName: string,
    include: boolean,
  ): void {
    this.docSettings.setAuthorityIncludeInPrint(port, authIndex, include);
    const label = authorityName.trim() || 'Authority';
    if (include) {
      this.toast.show(`${label}: included in Print all`, 'success');
    } else {
      this.toast.showError(`${label}: excluded from Print all`);
    }
  }

  // --- documents within an authority ---
  protected addItem(pkg: PortPackage, authIndex: number): void {
    const items = [...pkg.authorities[authIndex].items, { documentId: '', copies: 1 }];
    this.docSettings.setAuthorityItems(pkg.port, authIndex, items);
  }

  protected updateItem(
    pkg: PortPackage,
    authIndex: number,
    itemIndex: number,
    patch: Partial<PortPackageItem>,
  ): void {
    const items = pkg.authorities[authIndex].items.map((it, i) =>
      i === itemIndex ? { ...it, ...patch } : it,
    );
    this.docSettings.setAuthorityItems(pkg.port, authIndex, items);
  }

  protected removeItem(pkg: PortPackage, authIndex: number, itemIndex: number): void {
    const items = pkg.authorities[authIndex].items.filter((_, i) => i !== itemIndex);
    this.docSettings.setAuthorityItems(pkg.port, authIndex, items);
  }

  // --- per-authority actions (only meaningful for the current Port of Call) ---
  protected openAuthority(items: PortPackageItem[]): void {
    void this.runner.openItems(items);
  }

  protected printAuthority(items: PortPackageItem[]): void {
    void this.runner.printItems(items);
  }

  protected onPrinterChange(name: string): void {
    this.docSettings.setPrinterName(name);
  }
}

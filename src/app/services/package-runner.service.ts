import { Injectable, computed, inject, signal } from '@angular/core';
import { PortPackageItem } from '../models/crew.models';
import { fileNameWithCopyCount } from '../utils/package-save-path.util';
import { StorageService } from './storage.service';
import { DocumentCatalogService } from './document-catalog.service';
import { PdfDeliveryService } from './pdf-delivery.service';
import { ToastService } from './toast.service';
import { uint8ToBase64 } from '../utils/base64.util';

interface AuthorityOpenGroup {
  name: string;
  items: PortPackageItem[];
}

/**
 * Runs the document package for the current Port of Call:
 * opens each document in its own window, or prints each with its copy count.
 * Shared by the header bar and the Settings popup.
 */
@Injectable({ providedIn: 'root' })
export class PackageRunnerService {
  private readonly storage = inject(StorageService);
  private readonly catalog = inject(DocumentCatalogService);
  private readonly delivery = inject(PdfDeliveryService);
  private readonly toast = inject(ToastService);

  private readonly hasElectron = !!window.electronAPI;
  readonly busy = signal(false);

  readonly currentPort = computed(() => this.storage.ship().portOfCall);
  readonly currentPackage = computed(() =>
    this.storage.printPackages().find((p) => p.port === this.storage.ship().portOfCall),
  );
  /** All documents across every authority of the current port. */
  readonly currentItems = computed<PortPackageItem[]>(() =>
    (this.currentPackage()?.authorities ?? []).flatMap((a) => a.items),
  );
  /** Documents in authorities marked for Print all. */
  readonly currentPrintItems = computed<PortPackageItem[]>(() =>
    (this.currentPackage()?.authorities ?? [])
      .filter((a) => a.includeInPrint !== false)
      .flatMap((a) => a.items),
  );
  readonly currentItemCount = computed(
    () => this.currentItems().filter((it) => it.documentId.trim()).length,
  );
  readonly currentPrintItemCount = computed(
    () => this.currentPrintItems().filter((it) => it.documentId.trim()).length,
  );

  /**
   * Click panel summary for the current port: every authority (unchecked = open-only / gray),
   * plus print totals for authorities included in Print all.
   */
  readonly currentBreakdown = computed(() => {
    const pkg = this.currentPackage();
    if (!pkg || pkg.authorities.length === 0) return null;
    const authorities = pkg.authorities.map((a) => {
      const includeInPrint = a.includeInPrint !== false;
      const runnable = a.items.filter((it) => it.documentId.trim());
      return {
        name: a.name?.trim() || '(unnamed)',
        includeInPrint,
        items: runnable.map((it) => ({
          label: this.catalog.label(it.documentId),
          copies: it.copies,
          includeInPrint,
        })),
        packageItems: runnable,
      };
    });
    const totals = new Map<string, number>();
    for (const a of pkg.authorities) {
      if (a.includeInPrint === false) continue;
      for (const it of a.items) {
        if (!it.documentId.trim()) continue;
        totals.set(it.documentId, (totals.get(it.documentId) ?? 0) + it.copies);
      }
    }
    const summary = [...totals.entries()].map(([id, copies]) => ({
      label: this.catalog.label(id),
      copies,
    }));
    return { authorities, summary };
  });

  /** Open every document of the current port (ignores Print-all checkbox). */
  openAll(): Promise<void> {
    const pkg = this.currentPackage();
    if (!pkg) return Promise.resolve();
    const groups: AuthorityOpenGroup[] = pkg.authorities.map((a) => ({
      name: a.name?.trim() || 'Authority',
      items: a.items.filter((it) => it.documentId.trim()),
    }));
    return this.openAuthorityGroups(groups);
  }

  /** Print documents from authorities included in Print all. */
  printAll(): Promise<void> {
    return this.printItems(this.currentPrintItems());
  }

  /**
   * Open documents for one authority (panel / settings).
   * When Save-to-folder is on, files go into that authority's subfolder with `_xN` copy suffix.
   */
  openItems(items: PortPackageItem[], authorityName = 'Authority'): Promise<void> {
    return this.openAuthorityGroups([{ name: authorityName, items }]);
  }

  private async openAuthorityGroups(groups: AuthorityOpenGroup[]): Promise<void> {
    if (this.busy()) return;
    const enabled = this.enabledIds();
    const openOrder: string[] = [];
    const seen = new Set<string>();
    for (const group of groups) {
      for (const item of group.items) {
        const id = item.documentId.trim();
        if (!id) continue;
        if (!enabled.has(id)) {
          this.skip(id);
          continue;
        }
        if (!seen.has(id)) {
          seen.add(id);
          openOrder.push(id);
        }
      }
    }
    if (openOrder.length === 0) return;

    this.busy.set(true);
    const cache = new Map<string, { bytes: Uint8Array; fileName: string }>();
    let opened = 0;
    let saved = 0;

    for (const id of openOrder) {
      try {
        const built = await this.catalog.buildBytes(id);
        cache.set(id, built);
        this.delivery.openBytes(built.bytes);
        opened++;
      } catch (err) {
        this.fail(id, err);
      }
    }

    for (const group of groups) {
      for (const item of group.items) {
        const id = item.documentId.trim();
        const built = cache.get(id);
        if (!built) continue;
        const named = fileNameWithCopyCount(built.fileName, item.copies);
        if (
          await this.delivery.saveBytesIfEnabled(built.bytes, named, {
            subdir: group.name,
            quiet: true,
          })
        ) {
          saved++;
        }
      }
    }

    this.busy.set(false);
    this.toast.show(
      `Opened ${opened} document(s)${saved ? `, saved ${saved} under authority folders` : ''}`,
      'success',
    );
  }

  /**
   * Print each unique document once with its TOTAL copy count (summed across
   * authorities), and save with `_xN` in the name when Save-to-folder is on.
   */
  async printItems(items: PortPackageItem[]): Promise<void> {
    if (this.busy()) return;
    const enabled = this.enabledIds();
    const copiesById = new Map<string, number>();
    for (const item of items) {
      if (!item.documentId.trim()) continue;
      if (!enabled.has(item.documentId)) {
        this.skip(item.documentId);
        continue;
      }
      copiesById.set(
        item.documentId,
        (copiesById.get(item.documentId) ?? 0) + Math.max(1, item.copies),
      );
    }
    if (copiesById.size === 0) return;
    this.busy.set(true);
    const printer = this.storage.outputSettings().printerName;
    let printed = 0;
    let saved = 0;
    for (const [id, copies] of copiesById) {
      try {
        const { bytes, fileName } = await this.catalog.buildBytes(id);
        if (this.hasElectron && window.electronAPI) {
          const res = await window.electronAPI.printPdf(uint8ToBase64(bytes), copies, printer);
          if (!res.ok) throw new Error(res.error || 'print failed');
        } else {
          this.printInBrowser(bytes);
        }
        const named = fileNameWithCopyCount(fileName, copies);
        if (await this.delivery.saveBytesIfEnabled(bytes, named, { quiet: true })) saved++;
        printed++;
      } catch (err) {
        this.fail(id, err);
      }
    }
    this.busy.set(false);
    this.toast.show(`Printed ${printed} document(s)${saved ? `, saved ${saved}` : ''}`, 'success');
  }

  private enabledIds(): Set<string> {
    return new Set(
      this.catalog
        .available()
        .filter((d) => d.enabled)
        .map((d) => d.id),
    );
  }

  private skip(id: string): void {
    this.toast.show(
      `Skipped ${this.catalog.label(id)} — not available for the current Crew List type`,
      'warning',
    );
  }

  private fail(id: string, err: unknown): void {
    this.toast.showError(
      `${this.catalog.label(id)}: ${err instanceof Error ? err.message : 'failed'}`,
    );
  }

  private printInBrowser(bytes: Uint8Array): void {
    const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.src = url;
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 400);
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };
    document.body.appendChild(iframe);
  }
}

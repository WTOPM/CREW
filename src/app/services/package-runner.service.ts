import { Injectable, computed, inject, signal } from '@angular/core';
import { PortPackageItem } from '../models/crew.models';
import { StorageService } from './storage.service';
import { DocumentCatalogService } from './document-catalog.service';
import { PdfDeliveryService } from './pdf-delivery.service';
import { ToastService } from './toast.service';
import { uint8ToBase64 } from '../utils/base64.util';

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

  /** Hover summary for the current port: per-authority lines + summed totals. */
  readonly currentBreakdown = computed(() => {
    const pkg = this.currentPackage();
    if (!pkg || pkg.authorities.length === 0) return null;
    const authorities = pkg.authorities
      .filter((a) => a.includeInPrint !== false)
      .map((a) => ({
        name: a.name?.trim() || '(unnamed)',
        items: a.items
          .filter((it) => it.documentId.trim())
          .map((it) => ({ label: this.catalog.label(it.documentId), copies: it.copies })),
      }));
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

  /** Open all documents of the current port (every authority). */
  openAll(): Promise<void> {
    return this.openItems(this.currentItems());
  }

  /** Print all documents of the current port (every enabled authority). */
  printAll(): Promise<void> {
    return this.printItems(this.currentPrintItems());
  }

  async openItems(items: PortPackageItem[]): Promise<void> {
    const ids = this.uniqueEnabledIds(items);
    if (ids.length === 0 || this.busy()) return;
    this.busy.set(true);
    let ok = 0;
    let saved = 0;
    for (const id of ids) {
      try {
        const { bytes, fileName } = await this.catalog.buildBytes(id);
        this.delivery.openBytes(bytes);
        if (await this.delivery.saveBytesIfEnabled(bytes, fileName)) saved++;
        ok++;
      } catch (err) {
        this.fail(id, err);
      }
    }
    this.busy.set(false);
    this.toast.show(`Opened ${ok} document(s)${saved ? `, saved ${saved}` : ''}`, 'success');
  }

  /**
   * Print each unique document once with its TOTAL copy count (summed across
   * authorities), and save just one copy per document if saving is enabled.
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
        if (await this.delivery.saveBytesIfEnabled(bytes, fileName)) saved++;
        printed++;
      } catch (err) {
        this.fail(id, err);
      }
    }
    this.busy.set(false);
    this.toast.show(`Printed ${printed} document(s)${saved ? `, saved ${saved}` : ''}`, 'success');
  }

  /** Unique, enabled document ids in first-seen order (skips disabled with a toast). */
  private uniqueEnabledIds(items: PortPackageItem[]): string[] {
    const enabled = this.enabledIds();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      if (!item.documentId.trim()) continue;
      if (!enabled.has(item.documentId)) {
        this.skip(item.documentId);
        continue;
      }
      if (!seen.has(item.documentId)) {
        seen.add(item.documentId);
        out.push(item.documentId);
      }
    }
    return out;
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

  /** Browser fallback: load the PDF in a hidden iframe and invoke the print dialog. */
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

import { Injectable, inject } from '@angular/core';
import {
  createDefaultPhoneLibrary,
  normalizePhoneLibrary,
  type PhoneDirectoryRow,
} from '../models/phone.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class PhoneStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  replaceFromImport(partial: {
    rows: PhoneDirectoryRow[];
    sourcePath: string;
    sourceFileName: string;
    sheetName: string;
    title: string;
  }): void {
    this.data.update((d) => {
      const prev = d.phoneLibrary ?? createDefaultPhoneLibrary();
      return {
        ...d,
        phoneLibrary: normalizePhoneLibrary({
          ...prev,
          rows: partial.rows,
          sourcePath: partial.sourcePath,
          sourceFileName: partial.sourceFileName,
          sheetName: partial.sheetName,
          title: partial.title,
          importedAt: new Date().toISOString(),
        }),
      };
    });
    void this.state.persist('saved');
  }

  setSourcePath(path: string): void {
    const p = path.trim();
    this.data.update((d) => {
      const prev = d.phoneLibrary ?? createDefaultPhoneLibrary();
      const fileName = p.replace(/^.*[\\/]/, '') || prev.sourceFileName;
      return {
        ...d,
        phoneLibrary: normalizePhoneLibrary({
          ...prev,
          sourcePath: p,
          sourceFileName: fileName || prev.sourceFileName,
        }),
      };
    });
    void this.state.persist('silent');
  }

  updateRow(excelRow: number, patch: Partial<PhoneDirectoryRow>): void {
    this.data.update((d) => {
      const prev = d.phoneLibrary ?? createDefaultPhoneLibrary();
      return {
        ...d,
        phoneLibrary: normalizePhoneLibrary({
          ...prev,
          rows: prev.rows.map((row) =>
            row.excelRow === excelRow
              ? {
                  ...row,
                  ...patch,
                  excelRow: row.excelRow,
                }
              : row,
          ),
        }),
      };
    });
    void this.state.persist('silent');
  }

  setRows(rows: PhoneDirectoryRow[]): void {
    this.data.update((d) => {
      const prev = d.phoneLibrary ?? createDefaultPhoneLibrary();
      return {
        ...d,
        phoneLibrary: normalizePhoneLibrary({
          ...prev,
          rows,
        }),
      };
    });
    void this.state.persist('silent');
  }

  clearDirectory(): void {
    this.data.update((d) => {
      const prev = d.phoneLibrary ?? createDefaultPhoneLibrary();
      return {
        ...d,
        phoneLibrary: normalizePhoneLibrary({
          ...prev,
          rows: [],
          importedAt: '',
          sheetName: '',
          title: '',
        }),
      };
    });
    void this.state.persist('saved');
  }
}

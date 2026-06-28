import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  HTML_FORM_PDF_DATA_PARAM,
  HTML_FORM_PDF_SNAPSHOT_STORAGE_KEY,
} from '../models/html-form-pdf-snapshot.model';
import { resolvePdfCaptureUrl, htmlFormPdfRelativeUrl } from './html-form-pdf-capture.util';

describe('resolvePdfCaptureUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('stores snapshot in sessionStorage and adds pdfData param', () => {
    const snapshot = { ship: { name: 'Test' }, crew: [{ familyName: 'A' }] };
    const url = resolvePdfCaptureUrl('/forms/crew-list-form-01/?mode=arrival&pdfExport=1', snapshot);

    expect(url).toContain(`${HTML_FORM_PDF_DATA_PARAM}=1`);
    expect(url).not.toContain('data=');
    expect(JSON.parse(sessionStorage.getItem(HTML_FORM_PDF_SNAPSHOT_STORAGE_KEY)!)).toEqual(snapshot);
  });
});

describe('htmlFormPdfRelativeUrl', () => {
  it('keeps path-only URLs unchanged', () => {
    expect(htmlFormPdfRelativeUrl('/forms/crew-list-form-01/?mode=arrival&pdfExport=1')).toBe(
      '/forms/crew-list-form-01/?mode=arrival&pdfExport=1',
    );
  });

  it('strips origin from absolute URLs', () => {
    expect(
      htmlFormPdfRelativeUrl('http://localhost:4200/forms/crew-list-form-01/?mode=departure'),
    ).toBe('/forms/crew-list-form-01/?mode=departure');
  });
});

import { Injectable, inject } from '@angular/core';
import { AppData, portCountry } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import { crewVaccinePdfFileName } from '../utils/pdf-filename.util';
import { arrivalVoyageDate } from '../utils/voyage-date.util';
import { formatDisplayDate } from '../utils/date.util';

const CREW_VACCINE_TEMPLATE_URL = '/crew-vaccine-empty.pdf';

/** Crew Vaccine — template + ship / crew fill. */
@Injectable({ providedIn: 'root' })
export class PdfCrewVaccineService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  /** Bump when public/crew-vaccine-empty.pdf is regenerated. */
  private readonly templateVersion = 2;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.crewVaccine);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = arrivalVoyageDate(ship);
    return crewVaccinePdfFileName(ship.name, ship.portOfCall, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    const { ship, crew } = data;
    const activeCrew = crew.filter((m) => !m.archived && m.onArrivalList);

    // Header fields - coordinates from actual PDF
    const headerFontSize = 10;

    // X at 259, 749 — mark as Arrival document
    page.drawText('X', {
      x: 259,
      y: 749,
      size: headerFontSize,
      font,
      color: black,
    });

    // Charterer at 61, 761
    page.drawText(ship.charterer || '', {
      x: 61,
      y: 761,
      size: headerFontSize,
      font,
      color: black,
    });

    // Page number "1" at 542, 759
    page.drawText('1', {
      x: 542,
      y: 759,
      size: headerFontSize,
      font,
      color: black,
    });

    // Ship name / Call sign at 47, 719
    const shipNameCallSign = `${ship.name || ''}${ship.name && ship.callSign ? ' / ' : ''}${ship.callSign || ''}`;
    page.drawText(shipNameCallSign, {
      x: 47,
      y: 719,
      size: headerFontSize,
      font,
      color: black,
    });

    // Gross tonnage / Net tonnage at 215, 717
    const tonnage = `${ship.grossTonnage || ''}${ship.grossTonnage && ship.netTonnage ? ' / ' : ''}${ship.netTonnage || ''}`;
    page.drawText(tonnage, {
      x: 215,
      y: 717,
      size: headerFontSize,
      font,
      color: black,
    });

    // Current port at 289, 716
    page.drawText(ship.portOfCall || '', {
      x: 289,
      y: 716,
      size: headerFontSize,
      font,
      color: black,
    });

    // Date of arrival at 450, 717
    page.drawText(formatDisplayDate(ship.dateOfArrival) || '', {
      x: 450,
      y: 717,
      size: headerFontSize,
      font,
      color: black,
    });

    // Port of registry / Nationality at 37, 677
    const homeportNationality = `${ship.homeport || ''}${ship.homeport && ship.nationality ? ' / ' : ''}${ship.nationality || ''}`;
    page.drawText(homeportNationality, {
      x: 37,
      y: 677,
      size: headerFontSize,
      font,
      color: black,
    });

    // IMO number at 224, 678
    page.drawText(ship.imoNo || '', {
      x: 224,
      y: 678,
      size: headerFontSize,
      font,
      color: black,
    });

    // Last port / Country at 285, 678
    const lastPortName = ship.lastPortOfCall || '';
    const lastPortCountryName = lastPortName ? portCountry(lastPortName, data.ports) : '';
    const lastPortWithCountry = `${lastPortName}${lastPortName && lastPortCountryName ? ' / ' : ''}${lastPortCountryName}`;
    page.drawText(lastPortWithCountry, {
      x: 285,
      y: 678,
      size: headerFontSize,
      font,
      color: black,
    });

    // Date of arrival at port at 211, 97
    page.drawText(formatDisplayDate(ship.dateOfArrival) || '', {
      x: 211,
      y: 97,
      size: headerFontSize,
      font,
      color: black,
    });

    // Captain name at 279, 94
    const captain = activeCrew.find((m) => m.rank?.toLowerCase().includes('master'));
    const captainName = captain
      ? `${captain.familyName || ''}${captain.familyName && captain.givenNames ? ', ' : ''}${captain.givenNames || ''}`
      : '';
    page.drawText(captainName, {
      x: 279,
      y: 94,
      size: headerFontSize,
      font,
      color: black,
    });

    // Table rows - first row starts at Y = 637
    const tableStartY = 637;
    const rowHeight = 22; // Distance between rows (637 - 615 = 22)
    const fontSize = 9;
    const maxRowsPerPage = 16; // Maximum 16 crew members per page
    const colX = {
      no: 35, // Column 7: No
      familyGivenNames: 56, // Column 8: Family Name, Given Names
      rank: 211, // Column: Rank
      nationality: 278, // Column: Nationality
      vaccineMedicalProduct: 336, // Column 11: Vaccine medical product
      dateOfVaccination: 503, // Column: Date of vaccination
    };
    const colMaxWidth = {
      familyGivenNames: colX.rank - colX.familyGivenNames - 4,
      rank: colX.nationality - colX.rank - 4,
      nationality: colX.vaccineMedicalProduct - colX.nationality - 4,
      vaccineMedicalProduct: colX.dateOfVaccination - colX.vaccineMedicalProduct - 4,
      dateOfVaccination: 72,
    };

    activeCrew.forEach((member, index) => {
      let y = tableStartY - index * rowHeight;

      // Manual adjustments for specific rows
      const rowNum = index + 1;
      if (rowNum === 1) y -= 2;
      else if (rowNum === 5) y -= 2;
      else if (rowNum === 6) y -= 1;
      else if (rowNum === 9) y += 2;
      else if (rowNum === 10) y += 2;
      else if (rowNum === 11) y += 2;
      else if (rowNum === 12) y += 4;
      else if (rowNum === 13) y += 5;
      else if (rowNum === 14) y += 5;
      else if (rowNum === 15) y = 337;
      else if (rowNum === 16) y = 315;

      // No.
      page.drawText(String(index + 1), {
        x: colX.no,
        y,
        size: fontSize,
        font,
        color: black,
      });

      // Family name, Given names
      const fullName = `${member.familyName || ''}${member.familyName && member.givenNames ? ', ' : ''}${member.givenNames || ''}`;
      this.drawTableCell(
        page,
        font,
        black,
        fullName,
        colX.familyGivenNames,
        y,
        fontSize,
        colMaxWidth.familyGivenNames,
      );

      // Rank
      this.drawTableCell(
        page,
        font,
        black,
        member.rank || '',
        colX.rank,
        y,
        fontSize,
        colMaxWidth.rank,
      );

      // Nationality — narrow column (~54 pt); shrink / truncate long values
      this.drawTableCell(
        page,
        font,
        black,
        member.nationality || '',
        colX.nationality,
        y,
        fontSize,
        colMaxWidth.nationality,
      );

      // Vaccine medical product
      this.drawTableCell(
        page,
        font,
        black,
        member.vaccineMedicalProduct || '',
        colX.vaccineMedicalProduct,
        y,
        fontSize,
        colMaxWidth.vaccineMedicalProduct,
      );

      // Date of vaccination
      this.drawTableCell(
        page,
        font,
        black,
        formatDisplayDate(member.dateOfVaccination) || '',
        colX.dateOfVaccination,
        y,
        fontSize,
        colMaxWidth.dateOfVaccination,
      );
    });

    return new Uint8Array(await doc.save());
  }

  /** One line — shrink font, then truncate; avoids pdf-lib maxWidth wrap into next column. */
  private drawTableCell(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    maxWidth?: number,
  ): void {
    const value = text.trim();
    if (!value) return;
    let size = fontSize;
    let line = value;
    if (maxWidth != null) {
      size = this.fitFontSize(font, line, maxWidth, fontSize);
      line = this.truncateToWidth(font, line, size, maxWidth);
    }
    page.drawText(line, { x, y, size, font, color: black });
  }

  private fitFontSize(
    font: import('pdf-lib').PDFFont,
    text: string,
    maxWidth: number,
    baseSize: number,
  ): number {
    let size = baseSize;
    while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  private truncateToWidth(
    font: import('pdf-lib').PDFFont,
    text: string,
    size: number,
    maxWidth: number,
  ): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return text;
    }
    let trimmed = text;
    while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed.length < text.length ? `${trimmed}…` : trimmed;
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }

    const res = await fetch(`${CREW_VACCINE_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Crew Vaccine template not found (public/crew-vaccine-empty.pdf)');
    }

    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}

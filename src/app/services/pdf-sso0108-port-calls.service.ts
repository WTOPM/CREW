import { Injectable, inject } from '@angular/core';

import {

  AppData,

  normalizePortSecLvl,
  portCode,
  resolveShipSecurityOfficer,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';

import { PdfDeliveryService } from './pdf-delivery.service';

import { formatDisplayDate } from '../utils/date.util';

import { sso0108PortCallsPdfFileName } from '../utils/pdf-filename.util';

import {

  SSO0108_FONT,

  SSO0108_HEADER,

  SSO0108_MAX_ROWS,

  SSO0108_TABLE_COL,

  type Sso0108TextPlacement,

  sso0108PdfLibY,

  sso0108RowBaselineY,

} from './sso0108-field-positions';

import { PdfOverlayService } from './pdf-overlay.service';



const SSO0108_PORT_CALLS_TEMPLATE_URL = '/sso-0108-port-calls-empty.pdf';



const MARSEC_LEVEL_WORD: Record<string, string> = {

  '1': 'one',

  '2': 'two',

  '3': 'three',

};



/** Present Ships MARSEC Level — e.g. `1 (one) 1` with closing parenthesis. */

function formatPresentShipMarsecLevel(level: string): string {

  const digit = (level || '1').trim() || '1';

  const word = MARSEC_LEVEL_WORD[digit] ?? digit;

  return `${digit} (${word}) ${digit}`;

}



/** SSO-0108 Port Calls — template + ship / port-call history fill. */

@Injectable({ providedIn: 'root' })

export class PdfSso0108PortCallsService {

  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);



  private templateBytes: Uint8Array | null = null;

  private loadedVersion = 0;

  /** Bump when public/sso-0108-port-calls-empty.pdf is regenerated. */

  private readonly templateVersion = 7;



  async buildFinalBytes(data: AppData): Promise<Uint8Array> {

    const bytes = await this.build(data);

    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.sso0108PortCalls);

  }



  async openPreview(data: AppData): Promise<boolean> {

    const bytes = await this.buildFinalBytes(data);

    return this.delivery.deliver(bytes, this.fileName(data));

  }



  fileName(data: AppData): string {

    const { ship } = data;

    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;

    return sso0108PortCallsPdfFileName(ship.name, voyageDate);

  }



  async build(data: AppData): Promise<Uint8Array> {

    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

    const template = await this.loadTemplate();

    const doc = await PDFDocument.load(template);

    const page = doc.getPages()[0];

    const font = await doc.embedFont(StandardFonts.Helvetica);

    const black = rgb(0, 0, 0);



    const draw = (text: string, placement: Sso0108TextPlacement) => {

      const value = text.trim();

      if (!value) return;

      page.drawText(value, {

        x: placement.x,

        y: placement.y,

        size: placement.fontSize ?? SSO0108_FONT,

        font,

        color: black,

      });

    };



    const drawAtBaseline = (text: string, x: number, baselineY: number) => {

      const value = text.trim();

      if (!value) return;

      page.drawText(value, {

        x,

        y: sso0108PdfLibY(baselineY),

        size: SSO0108_FONT,

        font,

        color: black,

      });

    };



    const { ship } = data;

    const ssoName = resolveShipSecurityOfficer(ship, data.crew);

    const marsecLevel = (ship.presentMarsecLevel || '1').trim() || '1';



    draw(ship.name, SSO0108_HEADER.vesselName);

    draw(ssoName, SSO0108_HEADER.shipSecurityOfficer);

    draw(formatDisplayDate(ship.isscIssueDate), SSO0108_HEADER.isscIssueDate);

    draw(formatDisplayDate(ship.isscExpiryDate), SSO0108_HEADER.isscExpiryDate);

    draw(ship.isscIssuedByRso || 'BV', SSO0108_HEADER.isscIssuedByRso);

    draw(formatPresentShipMarsecLevel(marsecLevel), SSO0108_HEADER.presentMarsecLevel);



    const rows = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);

    let rowIndex = 0;

    for (const entry of rows) {

      if (rowIndex >= SSO0108_MAX_ROWS) break;

      const port = portCode(entry.portName, data.ports);

      if (!port && !entry.arrivalDate && !entry.departureDate) continue;



      const baselineY = sso0108RowBaselineY(rowIndex);

      drawAtBaseline(port, SSO0108_TABLE_COL.port, baselineY);

      drawAtBaseline(formatDisplayDate(entry.arrivalDate), SSO0108_TABLE_COL.arrival, baselineY);

      drawAtBaseline(formatDisplayDate(entry.departureDate), SSO0108_TABLE_COL.departure, baselineY);

      const rowSecLvl = normalizePortSecLvl(entry.secLvl);
      drawAtBaseline(rowSecLvl, SSO0108_TABLE_COL.marsecPort, baselineY);
      drawAtBaseline(rowSecLvl, SSO0108_TABLE_COL.marsecShip, baselineY);

      drawAtBaseline('NIL', SSO0108_TABLE_COL.measures, baselineY);

      rowIndex += 1;

    }



    return new Uint8Array(await doc.save());

  }



  private async loadTemplate(): Promise<Uint8Array> {

    if (this.templateBytes && this.loadedVersion === this.templateVersion) {

      return this.templateBytes;

    }

    const res = await fetch(`${SSO0108_PORT_CALLS_TEMPLATE_URL}?v=${this.templateVersion}`, {

      cache: 'no-store',

    });

    if (!res.ok) {

      throw new Error(

        'SSO-0108 Port Calls template not found (public/sso-0108-port-calls-empty.pdf)',

      );

    }

    this.templateBytes = new Uint8Array(await res.arrayBuffer());

    this.loadedVersion = this.templateVersion;

    return this.templateBytes;

  }

}



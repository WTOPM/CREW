import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { AppData, CrewMember } from '../models/crew.models';
import {
  CREW_LIST_BOXES,
  CREW_LIST_LINE_PT,
  createCoordScale,
  type CoordScale,
} from './crew-list-coordinates';

export { CREW_LIST_ROW_COUNT } from './crew-list-coordinates';

@Injectable({ providedIn: 'root' })
export class PdfCrewArrService {
  build(_data: AppData, _crew: CrewMember[]): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    this.drawCoordinateGrid(doc, createCoordScale());
    return doc;
  }

  generate(data: AppData, crew: CrewMember[]): void {
    this.build(data, crew).save('Crew_List_Grid.pdf');
  }

  openPreview(data: AppData, crew: CrewMember[]): boolean {
    const blob = this.build(data, crew).output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      return false;
    }
    win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
    return true;
  }

  private drawCoordinateGrid(doc: jsPDF, s: CoordScale): void {
    doc.setDrawColor(0);
    doc.setLineWidth(CREW_LIST_LINE_PT);

    for (const box of CREW_LIST_BOXES) {
      const r = s.rect(box.x1, box.y1, box.x2, box.y2);
      doc.rect(r.x, r.y, r.w, r.h);

      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const fontSize = Math.max(7, Math.min(28, Math.min(r.w, r.h) * 0.22));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.text(box.id, cx, cy, { align: 'center', baseline: 'middle' });
    }
  }
}

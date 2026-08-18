import { describe, expect, it } from 'vitest';
import {
  isUsableCrewEffectHtmlCssBox,
  normalizeCrewSignatureCellByRow,
  readCrewEffectHtmlOverlayBox,
  sanitizeCrewEffectHtmlCssBox,
} from './crew-effect-html-overlay.util';

describe('crew-effect-html-overlay.util', () => {
  it('rejects corner garbage CSS boxes', () => {
    expect(
      isUsableCrewEffectHtmlCssBox({
        left: '0px',
        top: '0px',
        width: '55px',
        height: '12px',
      }),
    ).toBe(false);
  });

  it('keeps valid px stamp box', () => {
    const box = {
      left: '120px',
      top: '240px',
      width: '65px',
      height: '28px',
    };
    expect(sanitizeCrewEffectHtmlCssBox(box)).toEqual(box);
  });

  it('drops legacy pdf signature when stamp is already CSS', () => {
    const stampCss = { left: '120mm', top: '240mm', width: '65mm', height: '28mm' };
    const pdfSig = { x: 478, y: 200, width: 50, height: 14 };
    expect(
      readCrewEffectHtmlOverlayBox(pdfSig, {
        stampIsCss: true,
        isMasterSignature: true,
      }),
    ).toBeUndefined();
    expect(readCrewEffectHtmlOverlayBox(stampCss)).toEqual(stampCss);
  });

  it('normalizes crew signature row to cell fields only', () => {
    expect(
      normalizeCrewSignatureCellByRow({
        '0': {
          cellLeft: '4px',
          cellTop: '2px',
          cellWidth: '48px',
          cellHeight: '14px',
          offsetX: 12,
          offsetY: -3,
        },
        bad: { cellLeft: '1px' },
      }),
    ).toEqual({
      '0': {
        cellLeft: '4px',
        cellTop: '2px',
        cellWidth: '48px',
        cellHeight: '14px',
      },
    });
  });
});
